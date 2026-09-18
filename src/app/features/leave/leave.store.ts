import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of, switchMap } from 'rxjs';
import { DocumentsApi } from '../../core/api/documents.api';
import { FacultyApi } from '../../core/api/faculty.api';
import type { LeaveRequestDto } from '../../core/api/faculty.types';
import { FacultyIdentityService } from '../../core/auth/faculty-identity.service';
import { putFileToPresignedUrl } from '../../core/http/presigned-upload.util';
import { computeLeaveAssignmentOverlaps, type LeaveOverlapWarning } from './leave-overlap';
import type { AttachmentUploadState } from './leave.types';

/**
 * Leave feature store (FWEB-24 through FWEB-26). This app's own UI scope is the applicant side
 * only -- submit, view balance (see below), track the fixed approval chain, cancel while pending,
 * and a retained full history -- `Faculty`'s own Department-Head/Authority approval ACTIONS exist
 * on {@link FacultyApi} for completeness but have no screen here (no ticket in FWEB-24..26 names a
 * "review someone else's leave" screen for this app).
 *
 * **Confirmed backend gap: no leave-balance concept exists anywhere in `ums-core`** --
 * `faculty.types.ts`'s own doc comment on {@link LeaveRequestDto} carries the detail. {@link
 * leaveBalance} is therefore always `null`; the Leave page renders an honest "not available"
 * state rather than a fabricated number.
 */
@Injectable({ providedIn: 'root' })
export class LeaveStore {
  private readonly facultyApi = inject(FacultyApi);
  private readonly documentsApi = inject(DocumentsApi);
  private readonly facultyIdentity = inject(FacultyIdentityService);
  private readonly http = inject(HttpClient);

  private readonly leaveRequestsState = signal<readonly LeaveRequestDto[]>([]);
  private readonly assignmentsState = signal<
    readonly { courseOfferingId: string; assignedAt: string }[]
  >([]);
  private readonly isLoadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly attachmentUploadState = signal<AttachmentUploadState | null>(null);

  /** In-memory only, held only long enough to retry a failed attachment upload -- never persisted, matching Materials' own posture toward raw file bytes. */
  private pendingAttachmentFile: File | null = null;

  readonly leaveRequests = this.leaveRequestsState.asReadonly();
  readonly isLoading = this.isLoadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly attachmentUpload = this.attachmentUploadState.asReadonly();

  /** Confirmed backend gap -- see class doc. Always `null`. */
  readonly leaveBalance: null = null;

  readonly overlapWarnings = computed<readonly LeaveOverlapWarning[]>(() =>
    computeLeaveAssignmentOverlaps(this.leaveRequestsState(), this.assignmentsState()),
  );

  refresh(): void {
    const facultyMemberId = this.facultyIdentity.facultyMemberId();
    if (!facultyMemberId) {
      this.errorState.set('leave.error.noFacultyMember');
      return;
    }

    this.isLoadingState.set(true);
    this.errorState.set(null);
    forkJoin({
      leave: this.facultyApi.listLeaveRequests(facultyMemberId),
      assignments: this.facultyApi.listCourseAssignments(facultyMemberId),
    }).subscribe({
      next: ({ leave, assignments }) => {
        this.leaveRequestsState.set(leave.items);
        this.assignmentsState.set(
          assignments.map((a) => ({
            courseOfferingId: a.courseOfferingId,
            assignedAt: a.assignedAt,
          })),
        );
        this.isLoadingState.set(false);
      },
      error: () => {
        this.errorState.set('leave.error.loadFailed');
        this.isLoadingState.set(false);
      },
    });
  }

  /** FWEB-24: submit a new LeaveRequest, optionally with a supporting-document attachment. A failed attachment never loses the already-submitted request (edge-cases.md). */
  submit(
    request: { readonly startDate: string; readonly endDate: string; readonly reason: string },
    file: File | null,
  ): void {
    const facultyMemberId = this.facultyIdentity.facultyMemberId();
    if (!facultyMemberId) {
      this.errorState.set('leave.error.noFacultyMember');
      return;
    }

    this.facultyApi
      .submitLeaveRequest({
        facultyMemberId,
        startDate: request.startDate,
        endDate: request.endDate,
        reason: request.reason,
      })
      .subscribe({
        next: (dto) => {
          this.leaveRequestsState.update((requests) => [dto, ...requests]);
          if (file) {
            this.uploadAttachment(dto.id, dto.version, file);
          }
        },
        error: () => this.errorState.set('leave.error.submitFailed'),
      });
  }

  /** FWEB-24's scoped attachment retry -- reuses the held File handle, never re-asks the faculty member to retype the form. */
  retryAttachment(): void {
    const state = this.attachmentUploadState();
    if (!state || !this.pendingAttachmentFile) {
      return;
    }
    this.uploadAttachment(
      state.leaveRequestId,
      state.leaveRequestVersion,
      this.pendingAttachmentFile,
    );
  }

  dismissAttachmentUpload(): void {
    this.attachmentUploadState.set(null);
    this.pendingAttachmentFile = null;
  }

  /** FWEB-25: cancel a still-pending request. */
  cancel(leaveRequest: LeaveRequestDto): void {
    this.facultyApi
      .cancelLeaveRequest(leaveRequest.id, { version: leaveRequest.version })
      .subscribe({
        next: (dto) => this.replaceInList(dto),
        error: () => this.errorState.set('leave.error.cancelFailed'),
      });
  }

  private uploadAttachment(leaveRequestId: string, leaveRequestVersion: number, file: File): void {
    this.pendingAttachmentFile = file;
    this.attachmentUploadState.set({
      leaveRequestId,
      leaveRequestVersion,
      fileName: file.name,
      phase: 'requesting',
      progress: 0,
      errorKey: null,
    });

    const facultyMemberId = this.facultyIdentity.facultyMemberId();
    if (!facultyMemberId) {
      return;
    }

    this.documentsApi
      .requestUpload({
        ownerId: facultyMemberId,
        artifactType: 'LeaveSupportingDocument',
        mimeType: file.type || 'application/octet-stream',
      })
      .pipe(
        switchMap((artifact) => {
          if (!artifact.uploadUrl) {
            throw new Error('missing upload url');
          }
          this.updateAttachmentState({ phase: 'uploading' });
          return putFileToPresignedUrl(this.http, artifact.uploadUrl, file).pipe(
            switchMap((progress) => {
              this.updateAttachmentState({ progress });
              return progress === 100 ? of(artifact.id) : of(null);
            }),
          );
        }),
      )
      .subscribe({
        next: (artifactId) => {
          if (artifactId) {
            this.confirmAndAttach(leaveRequestId, leaveRequestVersion, artifactId);
          }
        },
        error: () =>
          this.updateAttachmentState({
            phase: 'error',
            errorKey: 'leave.error.attachmentUploadFailed',
          }),
      });
  }

  private confirmAndAttach(
    leaveRequestId: string,
    leaveRequestVersion: number,
    artifactId: string,
  ): void {
    this.updateAttachmentState({ phase: 'confirming' });
    this.documentsApi.confirmUpload(artifactId).subscribe({
      next: () => {
        this.updateAttachmentState({ phase: 'attaching' });
        this.facultyApi
          .attachSupportingDocument(leaveRequestId, {
            generatedDocumentId: artifactId,
            version: leaveRequestVersion,
          })
          .subscribe({
            next: (dto) => {
              this.replaceInList(dto);
              this.updateAttachmentState({ phase: 'success' });
              this.pendingAttachmentFile = null;
            },
            error: () =>
              this.updateAttachmentState({
                phase: 'error',
                errorKey: 'leave.error.attachmentAttachFailed',
              }),
          });
      },
      error: () =>
        this.updateAttachmentState({
          phase: 'error',
          errorKey: 'leave.error.attachmentUploadFailed',
        }),
    });
  }

  private updateAttachmentState(
    patch: Partial<
      Omit<AttachmentUploadState, 'leaveRequestId' | 'leaveRequestVersion' | 'fileName'>
    >,
  ): void {
    this.attachmentUploadState.update((s) => (s ? { ...s, ...patch } : s));
  }

  private replaceInList(dto: LeaveRequestDto): void {
    this.leaveRequestsState.update((requests) => requests.map((r) => (r.id === dto.id ? dto : r)));
  }
}

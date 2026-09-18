import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { putFileToPresignedUrl } from '../../core/http/presigned-upload.util';
import { LearningApi } from '../../core/api/learning.api';
import type { LectureMaterialDto, LectureMaterialTypeCode } from '../../core/api/learning.types';
import { validateMaterialFile } from './materials-validation';
import type { PendingUpload, UploadPhase } from './materials.types';

const SCHEDULE_CHECK_INTERVAL_MS = 30_000;

interface ScheduledUploadRecord {
  readonly localId: string;
  readonly artifactId: string;
  readonly materialType: LectureMaterialTypeCode;
  readonly moduleGroup: string;
  readonly title: string;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly replacesMaterialId: string | null;
  readonly scheduledFor: string;
}

const DEFAULT_MATERIAL_TYPE: LectureMaterialTypeCode = 'Document';

function storageKey(courseOfferingId: string): string {
  return `fweb.materials.scheduled.${courseOfferingId}`;
}

/**
 * Materials feature store (FWEB-22/FWEB-23): drag-and-drop upload with client-side type/size
 * validation, version history (an append-only server-side new-version call, never an overwrite),
 * and scheduled (publish-at-a-future-date) release.
 *
 * **Upload-now, publish-later design for FWEB-23's scheduled release**: `Learning`'s
 * `LectureMaterialDto`/domain model has no `publishAt`/scheduled-release field at all (confirmed
 * against `LectureMaterial.cs`/`LectureMaterialDto.cs` source) -- there is no server-side scheduler
 * this app can hand a future timestamp to. The resolved mechanism: the file's bytes are uploaded
 * and CONFIRMED with Documents/Learning's own presigned-upload flow immediately (this is invisible
 * to students -- an UploadedArtifact existing in storage carries no visibility of its own until a
 * LectureMaterial record references it), and only the actual `createMaterial`/`publishVersion`
 * call -- the act that makes it visible -- is deferred until the scheduled moment. A scheduled
 * item's metadata (never the raw file bytes) is persisted to `localStorage` so it survives a page
 * reload on the SAME device, and {@link checkScheduledReleases} (called periodically and on store
 * open) fires the deferred publish once due. **Honestly limited**: this only fires while some
 * browser tab on this device has the app open at or after the scheduled moment -- there is no
 * background server-side cron backing it, flagged here as the confirmed gap this mechanism works
 * within rather than pretends to solve.
 *
 * **Resumable upload**: a true resumable (chunked, cross-session) upload isn't feasible against a
 * single presigned S3-style PUT URL without a multipart-upload API `ums-core` doesn't expose here
 * -- per edge-cases.md's own explicitly-allowed fallback ("at minimum a clean retry-from-scratch
 * that never leaves a silently-truncated file looking successful"), a failure during the PUT
 * itself retries from a fresh upload slot; a failure AFTER the artifact was already confirmed
 * (e.g. only the publish call failed) resumes from that point instead of re-uploading the file.
 */
@Injectable({ providedIn: 'root' })
export class MaterialsStore {
  private readonly learningApi = inject(LearningApi);
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  private readonly courseOfferingIdState = signal<string | null>(null);
  private readonly materialsState = signal<readonly LectureMaterialDto[]>([]);
  private readonly uploadsState = signal<readonly PendingUpload[]>([]);
  private readonly isLoadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  /** In-memory only -- the raw `File` for an upload still in progress (or eligible for a from-scratch retry); never in the reactive/serializable state, never persisted. */
  private readonly fileHandles = new Map<string, File>();
  private scheduleCheckHandle: ReturnType<typeof setInterval> | null = null;

  readonly materials = this.materialsState.asReadonly();
  readonly uploads = this.uploadsState.asReadonly();
  readonly isLoading = this.isLoadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly activeUploads = computed(() =>
    this.uploads().filter((u) => u.phase !== 'success' && u.phase !== 'scheduled'),
  );
  readonly scheduledUploads = computed(() => this.uploads().filter((u) => u.phase === 'scheduled'));

  openCourseOffering(courseOfferingId: string): void {
    this.courseOfferingIdState.set(courseOfferingId);
    this.materialsState.set([]);
    this.errorState.set(null);
    this.uploadsState.set(this.readScheduled(courseOfferingId));
    this.refresh();
    this.checkScheduledReleases();
    this.startScheduleChecker();
  }

  closeCourseOffering(): void {
    if (this.scheduleCheckHandle !== null) {
      clearInterval(this.scheduleCheckHandle);
      this.scheduleCheckHandle = null;
    }
    this.fileHandles.clear();
  }

  refresh(): void {
    const courseOfferingId = this.courseOfferingIdState();
    if (!courseOfferingId) {
      return;
    }
    this.isLoadingState.set(true);
    this.learningApi.listMaterials(courseOfferingId).subscribe({
      next: (materials) => {
        this.materialsState.set(materials);
        this.isLoadingState.set(false);
      },
      error: () => {
        this.errorState.set('materials.error.loadFailed');
        this.isLoadingState.set(false);
      },
    });
  }

  /**
   * Begins uploading one file (FWEB-22 drag-and-drop). `replacesMaterialId` names an existing
   * LectureMaterial to version rather than create fresh (never a silent overwrite);
   * `scheduledFor` (ISO datetime) defers the actual publish (FWEB-23).
   */
  startUpload(
    file: File,
    options: {
      readonly materialType: LectureMaterialTypeCode;
      readonly moduleGroup: string;
      readonly title: string;
      readonly replacesMaterialId?: string | null;
      readonly scheduledFor?: string | null;
    },
  ): string {
    const localId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const validation = validateMaterialFile(file);

    if (!validation.valid) {
      this.pushUpload({
        localId,
        materialType: options.materialType,
        fileName: file.name,
        fileSizeBytes: file.size,
        moduleGroup: options.moduleGroup,
        title: options.title,
        replacesMaterialId: options.replacesMaterialId ?? null,
        scheduledFor: options.scheduledFor ?? null,
        phase: 'error',
        progress: 0,
        errorKey: validation.errorKey,
        artifactId: null,
      });
      return localId;
    }

    this.fileHandles.set(localId, file);
    this.pushUpload({
      localId,
      materialType: options.materialType,
      fileName: file.name,
      fileSizeBytes: file.size,
      moduleGroup: options.moduleGroup,
      title: options.title,
      replacesMaterialId: options.replacesMaterialId ?? null,
      scheduledFor: options.scheduledFor ?? null,
      phase: 'requesting',
      progress: 0,
      errorKey: null,
      artifactId: null,
    });
    this.runUploadPipeline(localId, file);
    return localId;
  }

  /** FWEB-22's "one-tap retry" -- resumes from the artifact-confirm step if already past it, otherwise starts a clean from-scratch upload. */
  retryUpload(localId: string): void {
    const upload = this.uploads().find((u) => u.localId === localId);
    if (!upload) {
      return;
    }
    if (upload.artifactId) {
      this.updateUpload(localId, { phase: 'publishing', errorKey: null });
      this.publishNow(localId, upload.artifactId, upload);
      return;
    }
    const file = this.fileHandles.get(localId);
    if (!file) {
      // The original File handle didn't survive (e.g. a page reload) -- honest failure, cannot
      // silently resume without the bytes; the faculty member must re-select the file.
      this.updateUpload(localId, { phase: 'error', errorKey: 'materials.error.reselectRequired' });
      return;
    }
    this.updateUpload(localId, { phase: 'requesting', progress: 0, errorKey: null });
    this.runUploadPipeline(localId, file);
  }

  removeUpload(localId: string): void {
    this.fileHandles.delete(localId);
    this.uploadsState.update((uploads) => uploads.filter((u) => u.localId !== localId));
    this.persistScheduled();
  }

  /** Called periodically (and on open) -- fires any scheduled publish whose time has come (FWEB-23, see class doc's honesty note). */
  checkScheduledReleases(): void {
    const now = Date.now();
    for (const upload of this.uploads()) {
      if (
        upload.phase === 'scheduled' &&
        upload.scheduledFor &&
        new Date(upload.scheduledFor).getTime() <= now
      ) {
        if (upload.artifactId) {
          this.updateUpload(upload.localId, { phase: 'publishing' });
          this.publishNow(upload.localId, upload.artifactId, upload);
        }
      }
    }
  }

  private startScheduleChecker(): void {
    if (this.scheduleCheckHandle !== null) {
      return;
    }
    this.scheduleCheckHandle = setInterval(
      () => this.checkScheduledReleases(),
      SCHEDULE_CHECK_INTERVAL_MS,
    );
  }

  private runUploadPipeline(localId: string, file: File): void {
    const courseOfferingId = this.courseOfferingIdState();
    if (!courseOfferingId) {
      return;
    }

    this.learningApi
      .requestUpload(courseOfferingId, { mimeType: file.type || 'application/octet-stream' })
      .subscribe({
        next: (slot) => {
          if (!slot.uploadUrl) {
            this.updateUpload(localId, {
              phase: 'error',
              errorKey: 'materials.error.uploadFailed',
            });
            return;
          }
          this.updateUpload(localId, { phase: 'uploading', artifactId: slot.artifactId });
          putFileToPresignedUrl(this.http, slot.uploadUrl, file).subscribe({
            next: (progress) => this.updateUpload(localId, { progress }),
            error: () =>
              this.updateUpload(localId, {
                phase: 'error',
                errorKey: 'materials.error.uploadFailed',
              }),
            complete: () => this.confirmAndMaybePublish(localId, courseOfferingId, slot.artifactId),
          });
        },
        error: () =>
          this.updateUpload(localId, { phase: 'error', errorKey: 'materials.error.uploadFailed' }),
      });
  }

  private confirmAndMaybePublish(
    localId: string,
    courseOfferingId: string,
    artifactId: string,
  ): void {
    this.updateUpload(localId, { phase: 'confirming' });
    this.learningApi.confirmUpload(courseOfferingId, { artifactId }).subscribe({
      next: () => {
        const upload = this.uploads().find((u) => u.localId === localId);
        if (!upload) {
          return;
        }
        this.fileHandles.delete(localId);
        if (upload.scheduledFor && new Date(upload.scheduledFor).getTime() > Date.now()) {
          this.updateUpload(localId, { phase: 'scheduled' });
          this.persistScheduled();
          return;
        }
        this.updateUpload(localId, { phase: 'publishing' });
        this.publishNow(localId, artifactId, upload);
      },
      error: () =>
        this.updateUpload(localId, { phase: 'error', errorKey: 'materials.error.confirmFailed' }),
    });
  }

  private publishNow(localId: string, artifactId: string, upload: PendingUpload): void {
    const courseOfferingId = this.courseOfferingIdState();
    if (!courseOfferingId) {
      return;
    }

    const onSuccess = () => {
      this.updateUpload(localId, { phase: 'success' });
      this.persistScheduled();
      this.refresh();
    };
    const onError = () =>
      this.updateUpload(localId, { phase: 'error', errorKey: 'materials.error.publishFailed' });

    if (upload.replacesMaterialId) {
      this.learningApi
        .publishVersion(upload.replacesMaterialId, {
          artifactId,
          externalUrl: null,
          changeNote: upload.title,
        })
        .subscribe({ next: onSuccess, error: onError });
      return;
    }

    this.learningApi
      .createMaterial(courseOfferingId, {
        materialType: upload.materialType,
        moduleGroup: upload.moduleGroup,
        sortOrder: 0,
        titleEn: upload.title,
        descriptionEn: null,
        titleBn: null,
        descriptionBn: null,
        artifactId,
        externalUrl: null,
      })
      .subscribe({ next: onSuccess, error: onError });
  }

  private pushUpload(upload: PendingUpload): void {
    this.uploadsState.update((uploads) => [...uploads, upload]);
  }

  private updateUpload(localId: string, patch: Partial<Omit<PendingUpload, 'localId'>>): void {
    this.uploadsState.update((uploads) =>
      uploads.map((u) => (u.localId === localId ? { ...u, ...patch } : u)),
    );
  }

  private readScheduled(courseOfferingId: string): readonly PendingUpload[] {
    try {
      const raw = this.document.defaultView?.localStorage.getItem(storageKey(courseOfferingId));
      if (!raw) {
        return [];
      }
      const records = JSON.parse(raw) as ScheduledUploadRecord[];
      return records.map((r) => ({
        localId: r.localId,
        materialType: r.materialType ?? DEFAULT_MATERIAL_TYPE,
        fileName: r.fileName,
        fileSizeBytes: r.fileSizeBytes,
        moduleGroup: r.moduleGroup,
        title: r.title,
        replacesMaterialId: r.replacesMaterialId,
        scheduledFor: r.scheduledFor,
        phase: 'scheduled' as UploadPhase,
        progress: 100,
        errorKey: null,
        artifactId: r.artifactId,
      }));
    } catch {
      return [];
    }
  }

  private persistScheduled(): void {
    const courseOfferingId = this.courseOfferingIdState();
    if (!courseOfferingId) {
      return;
    }
    const records: ScheduledUploadRecord[] = this.uploads()
      .filter(
        (u): u is PendingUpload & { artifactId: string; scheduledFor: string } =>
          u.phase === 'scheduled' && u.artifactId !== null && u.scheduledFor !== null,
      )
      .map((u) => ({
        localId: u.localId,
        artifactId: u.artifactId,
        materialType: u.materialType,
        moduleGroup: u.moduleGroup,
        title: u.title,
        fileName: u.fileName,
        fileSizeBytes: u.fileSizeBytes,
        replacesMaterialId: u.replacesMaterialId,
        scheduledFor: u.scheduledFor,
      }));
    try {
      this.document.defaultView?.localStorage.setItem(
        storageKey(courseOfferingId),
        JSON.stringify(records),
      );
    } catch {
      // Storage unavailable -- the scheduled item still fires this session, just won't survive a reload.
    }
  }
}

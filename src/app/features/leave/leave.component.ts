import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsDateRangePickerComponent,
  UmsEmptyStateComponent,
  UmsFileUploadComponent,
  UmsStepperComponent,
  UmsTextareaComponent,
  type DateRange,
  type UploadableFile,
} from '@ums/design-system';
import type { LeaveRequestStatusCode } from '../../core/api/faculty.types';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { computeApprovalChain, isPending } from './leave-approval-chain';
import { LeaveStore } from './leave.store';
import type { LeaveRequestDto } from './leave.types';

/**
 * Leave page (FWEB-24 through FWEB-26): submission form with a scoped-retry attachment, a
 * per-request approval-chain stepper, cancel-while-pending, a retained full history list, leave
 * balance (honest "not available" -- confirmed backend gap), and a non-blocking
 * CourseAssignment-overlap warning.
 */
@Component({
  selector: 'app-leave',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsDateRangePickerComponent,
    UmsEmptyStateComponent,
    UmsFileUploadComponent,
    UmsStepperComponent,
    UmsTextareaComponent,
    TranslatePipe,
  ],
  templateUrl: './leave.component.html',
  styleUrl: './leave.component.scss',
})
export class LeaveComponent implements OnInit {
  private readonly translation = inject(TranslationService);
  protected readonly store = inject(LeaveStore);

  protected readonly dateRange = signal<DateRange>({ start: null, end: null });
  protected readonly reason = signal('');
  protected readonly attachmentFile = signal<File | null>(null);

  protected readonly canSubmit = computed(
    () => !!this.dateRange().start && !!this.dateRange().end && this.reason().trim().length > 0,
  );

  protected readonly attachmentAsUploadable = computed<readonly UploadableFile[]>(() => {
    const upload = this.store.attachmentUpload();
    if (!upload) {
      return [];
    }
    return [
      {
        id: upload.leaveRequestId,
        name: upload.fileName,
        sizeBytes: 0,
        progress: upload.progress,
        status:
          upload.phase === 'error' ? 'error' : upload.phase === 'success' ? 'success' : 'uploading',
        errorMessage: upload.errorKey ? this.translation.t(upload.errorKey) : undefined,
      },
    ];
  });

  ngOnInit(): void {
    this.store.refresh();
  }

  protected overlapsFor(leaveRequestId: string): boolean {
    return this.store.overlapWarnings().some((w) => w.leaveRequestId === leaveRequestId);
  }

  protected chainSteps(leaveRequest: LeaveRequestDto) {
    const chain = computeApprovalChain(
      leaveRequest.status as LeaveRequestStatusCode,
      leaveRequest.routedDirectlyToAuthority,
    );
    return {
      currentIndex: chain.currentIndex,
      steps: chain.steps.map((s) => ({
        label: this.translation.t(s.labelKey),
        description: s.descriptionKey ? this.translation.t(s.descriptionKey) : undefined,
      })),
    };
  }

  protected isPending(leaveRequest: LeaveRequestDto): boolean {
    return isPending(leaveRequest.status as LeaveRequestStatusCode);
  }

  protected statusBadgeVariant(
    status: string,
  ): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'Approved':
        return 'success';
      case 'Rejected':
        return 'danger';
      case 'Cancelled':
        return 'neutral';
      case 'Submitted':
      case 'DeptHeadApproved':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  protected onFileSelected(fileList: FileList): void {
    this.attachmentFile.set(fileList.item(0));
  }

  protected onSubmit(): void {
    const range = this.dateRange();
    if (!range.start || !range.end || !this.canSubmit()) {
      return;
    }
    this.store.submit(
      { startDate: range.start, endDate: range.end, reason: this.reason().trim() },
      this.attachmentFile(),
    );
    this.dateRange.set({ start: null, end: null });
    this.reason.set('');
    this.attachmentFile.set(null);
  }

  protected onRetryAttachment(): void {
    this.store.retryAttachment();
  }

  protected onDismissAttachment(): void {
    this.store.dismissAttachmentUpload();
  }

  protected onCancel(leaveRequest: LeaveRequestDto): void {
    this.store.cancel(leaveRequest);
  }
}

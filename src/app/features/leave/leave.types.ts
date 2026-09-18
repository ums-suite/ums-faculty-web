import type { LeaveRequestDto } from '../../core/api/faculty.types';

/** FWEB-24..26 domain types. */

export type AttachmentUploadPhase =
  'idle' | 'requesting' | 'uploading' | 'confirming' | 'attaching' | 'success' | 'error';

/**
 * FWEB-24's "scoped retry of just the failed attachment on partial upload failure" (edge-cases.md
 * "Leave-document upload fails partway"): the LeaveRequest itself is already safely submitted by
 * the time this exists, so a failure here never forces the whole application to be re-typed -- only
 * this attachment's own pipeline is retried.
 */
export interface AttachmentUploadState {
  readonly leaveRequestId: string;
  readonly leaveRequestVersion: number;
  readonly fileName: string;
  readonly phase: AttachmentUploadPhase;
  readonly progress: number;
  readonly errorKey: string | null;
}

export { type LeaveRequestDto };

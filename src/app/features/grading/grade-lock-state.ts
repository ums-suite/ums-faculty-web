import type { GradeWorkflowStatus } from './grading.types';

/**
 * Pure lock-state-machine helpers (FWEB-18/FWEB-19/FWEB-21) -- the second module §4's
 * ≥90%-coverage bar names by name ("...and Grading's mark-validation/lock-state logic"). Every
 * predicate here is a direct mirror of `ResultPublicationService`'s own server-side guards
 * (verified against `ums-core` source, not guessed) -- this is the SINGLE place every edit/action
 * control in the Grading feature consults before rendering itself as interactive, so invariant
 * §8.2 ("grade edits are impossible, not just hidden, after lock") holds by construction: a
 * control that would violate one of these predicates is never wired to call the corresponding
 * store method in the first place, not merely styled as disabled.
 */

const BANNER_LABEL_KEY: Readonly<Record<GradeWorkflowStatus, string>> = {
  Draft: 'grading.status.draft',
  Calculated: 'grading.status.submitted',
  Verified: 'grading.status.underReview',
  Approved: 'grading.status.approved',
  Published: 'grading.status.published',
  Archived: 'grading.status.archived',
};

export type StatusBadgeVariant = 'neutral' | 'info' | 'warning' | 'success';

const BADGE_VARIANT: Readonly<Record<GradeWorkflowStatus, StatusBadgeVariant>> = {
  Draft: 'neutral',
  Calculated: 'info',
  Verified: 'warning',
  Approved: 'info',
  Published: 'success',
  Archived: 'neutral',
};

/** requirement-spec.md §7's banner wording (Draft/Submitted/Under Review/Approved/Published) mapped onto the real `ResultPublicationStatus` enum -- `Verified` is the real "locked, Department-Head-review-eligible" state (the transition that produces it is literally named `lock`). */
export function bannerLabelKey(status: GradeWorkflowStatus): string {
  return BANNER_LABEL_KEY[status];
}

export function badgeVariant(status: GradeWorkflowStatus): StatusBadgeVariant {
  return BADGE_VARIANT[status];
}

/**
 * Invariant §8.2's load-bearing gate: marks are editable ONLY while `Draft`/`Calculated`, the
 * exact guard `GradeService.SubmitAsync` enforces server-side
 * (`WHERE status IN (Draft, Calculated)`, rejecting with `grade.already_locked` otherwise). Once a
 * Department Head's lock moves the batch to `Verified` (or further), this returns `false`
 * unconditionally -- there is no cached/local override path back to `true`.
 */
export function canEditMarks(status: GradeWorkflowStatus): boolean {
  return status === 'Draft' || status === 'Calculated';
}

/** The Department-Head review-lock action (`academic.grade.lock`, `Calculated` -> `Verified`). */
export function canLock(status: GradeWorkflowStatus): boolean {
  return status === 'Calculated';
}

/** Returns the batch to Faculty for re-entry (`Verified` -> `Calculated`). */
export function canReject(status: GradeWorkflowStatus): boolean {
  return status === 'Verified';
}

/** `academic.result.approve`, `Verified` -> `Approved`. */
export function canApprove(status: GradeWorkflowStatus): boolean {
  return status === 'Verified';
}

/** `academic.result.publish`, `Approved` -> `Published`. */
export function canPublish(status: GradeWorkflowStatus): boolean {
  return status === 'Approved';
}

/** `academic.result.publish`, `Published` -> `Archived`. */
export function canArchive(status: GradeWorkflowStatus): boolean {
  return status === 'Published';
}

/**
 * FWEB-19: the correction-request path is the ONLY way to change a value once locked, and even it
 * only ever applies to an already-`Published` result (`grade.correction_requires_published`,
 * `GradeCorrectionService`) -- edge-cases.md "Correction requested on an already-Published
 * result".
 */
export function canRequestCorrection(status: GradeWorkflowStatus): boolean {
  return status === 'Published';
}

/** Whether ANY faculty-facing routine cell-editing UI should be shown at all, vs. a read-only historical view (edge-cases.md "CourseAssignment revoked mid-semester... already-locked grade history... remains visible as read-only"). */
export function isReadOnlyHistorical(status: GradeWorkflowStatus): boolean {
  return status === 'Archived';
}

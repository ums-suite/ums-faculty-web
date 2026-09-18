/**
 * FWEB-26's non-blocking overlap warning (design-decisions.md "Leave/CourseAssignment Overlap
 * Warning" -- "a pure client-side cross-reference of two already-loaded feature stores [...] no
 * new API call, no new backend dependency"). Pure and Angular-free for the same reason every other
 * named-invariant module in this app is.
 *
 * **A note on "grades due" vs. what's actually implemented**: requirement-spec.md §9's own
 * motivating example is "a leave application spans a period during which grades are due" --
 * but no explicit grade-due-DATE field exists anywhere in Academic's real domain model
 * (`ResultPublication` carries no deadline of any kind, confirmed against source). The resolved,
 * actually-specified mechanism (design-decisions.md) is the proxy this module implements instead:
 * an active `CourseAssignment` overlapping the leave window is treated as "you have a live
 * teaching obligation here, grading is a plausible near-term duty" -- the closest honest signal
 * this app's already-loaded data can produce without a new backend dependency.
 */

export interface LeaveOverlapInput {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: string;
}

export interface CourseAssignmentOverlapInput {
  readonly courseOfferingId: string;
  readonly assignedAt: string;
}

export interface LeaveOverlapWarning {
  readonly leaveRequestId: string;
  readonly overlappingCourseOfferingIds: readonly string[];
}

const ACTIVE_LEAVE_STATUSES: ReadonlySet<string> = new Set([
  'Submitted',
  'DeptHeadApproved',
  'Approved',
]);

/**
 * Flags every still-relevant (pending or approved -- never a rejected/cancelled one) LeaveRequest
 * that overlaps an active CourseAssignment, in either direction named by the design decision: a
 * course assigned before the leave's own end date is a real, currently-held teaching obligation
 * whose window plausibly reaches into the requested leave period.
 */
export function computeLeaveAssignmentOverlaps(
  leaveRequests: readonly LeaveOverlapInput[],
  assignments: readonly CourseAssignmentOverlapInput[],
): readonly LeaveOverlapWarning[] {
  const warnings: LeaveOverlapWarning[] = [];

  for (const leave of leaveRequests) {
    if (!ACTIVE_LEAVE_STATUSES.has(leave.status)) {
      continue;
    }
    const overlapping = assignments
      .filter((assignment) => assignment.assignedAt <= leave.endDate)
      .map((assignment) => assignment.courseOfferingId);

    if (overlapping.length > 0) {
      warnings.push({
        leaveRequestId: leave.id,
        overlappingCourseOfferingIds: [...new Set(overlapping)],
      });
    }
  }

  return warnings;
}

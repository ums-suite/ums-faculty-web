import { computeLeaveAssignmentOverlaps } from './leave-overlap';

describe('computeLeaveAssignmentOverlaps', () => {
  it('flags a pending leave request overlapping an already-held CourseAssignment', () => {
    const warnings = computeLeaveAssignmentOverlaps(
      [{ id: 'lr-1', startDate: '2026-10-01', endDate: '2026-10-10', status: 'Submitted' }],
      [{ courseOfferingId: 'off-1', assignedAt: '2026-09-01T00:00:00Z' }],
    );
    expect(warnings).toEqual([{ leaveRequestId: 'lr-1', overlappingCourseOfferingIds: ['off-1'] }]);
  });

  it('never flags a Rejected or Cancelled leave request', () => {
    const warnings = computeLeaveAssignmentOverlaps(
      [
        { id: 'lr-1', startDate: '2026-10-01', endDate: '2026-10-10', status: 'Rejected' },
        { id: 'lr-2', startDate: '2026-10-01', endDate: '2026-10-10', status: 'Cancelled' },
      ],
      [{ courseOfferingId: 'off-1', assignedAt: '2026-09-01T00:00:00Z' }],
    );
    expect(warnings).toEqual([]);
  });

  it('does not flag when the assignment was made AFTER the leave already ended', () => {
    const warnings = computeLeaveAssignmentOverlaps(
      [{ id: 'lr-1', startDate: '2026-10-01', endDate: '2026-10-10', status: 'Submitted' }],
      [{ courseOfferingId: 'off-1', assignedAt: '2026-11-01T00:00:00Z' }],
    );
    expect(warnings).toEqual([]);
  });

  it('flags a new assignment landing during an already-approved leave', () => {
    const warnings = computeLeaveAssignmentOverlaps(
      [{ id: 'lr-1', startDate: '2026-10-01', endDate: '2026-10-10', status: 'Approved' }],
      [{ courseOfferingId: 'off-2', assignedAt: '2026-10-05T00:00:00Z' }],
    );
    expect(warnings).toEqual([{ leaveRequestId: 'lr-1', overlappingCourseOfferingIds: ['off-2'] }]);
  });

  it('deduplicates multiple assignments to the same CourseOffering', () => {
    const warnings = computeLeaveAssignmentOverlaps(
      [{ id: 'lr-1', startDate: '2026-10-01', endDate: '2026-10-10', status: 'Submitted' }],
      [
        { courseOfferingId: 'off-1', assignedAt: '2026-09-01T00:00:00Z' },
        { courseOfferingId: 'off-1', assignedAt: '2026-09-05T00:00:00Z' },
      ],
    );
    expect(warnings).toEqual([{ leaveRequestId: 'lr-1', overlappingCourseOfferingIds: ['off-1'] }]);
  });

  it('returns no warnings when there are no active CourseAssignments at all', () => {
    expect(
      computeLeaveAssignmentOverlaps(
        [{ id: 'lr-1', startDate: '2026-10-01', endDate: '2026-10-10', status: 'Submitted' }],
        [],
      ),
    ).toEqual([]);
  });
});

import type { AttendanceRecordDto } from '../../core/api/academic.types';
import {
  applyBulkMarkPresent,
  applyLocalMark,
  applyRosterRefresh,
  applyServerSnapshot,
  computeTally,
  markQueuedOffline,
  markSyncFailed,
  markSyncing,
} from './attendance-reconciliation';
import {
  EMPTY_ATTENDANCE_STATE,
  type AttendanceState,
  type RosterStudent,
} from './attendance.types';

const alice: RosterStudent = { enrollmentId: 'e-alice', studentId: 's-alice', name: 'Alice' };
const bob: RosterStudent = { enrollmentId: 'e-bob', studentId: 's-bob', name: 'Bob' };
const carol: RosterStudent = { enrollmentId: 'e-carol', studentId: 's-carol', name: 'Carol' };

const T0 = '2026-09-18T09:00:00.000Z';
const T1 = '2026-09-18T09:00:05.000Z';

describe('applyRosterRefresh', () => {
  it('inserts brand-new students as Unmarked/not explicitly set', () => {
    const state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice, bob]);
    expect(state.knownEnrollmentIds).toEqual(['e-alice', 'e-bob']);
    expect(state.marks['e-alice']).toEqual({
      status: 'Unmarked',
      explicitlySet: false,
      syncState: 'synced',
    });
    expect(state.marks['e-bob'].explicitlySet).toBe(false);
  });

  it('never touches the mark of an already-known student on a later refresh', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    state = applyLocalMark(state, 'e-alice', 'Present', T0);

    const refreshed = applyRosterRefresh(state, [alice]);
    expect(refreshed.marks['e-alice'].status).toBe('Present');
    expect(refreshed.marks['e-alice'].explicitlySet).toBe(true);
  });

  it('refreshes display data (name/photo) for an already-known student without touching their mark', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    state = applyLocalMark(state, 'e-alice', 'Absent', T0);

    const renamedAlice: RosterStudent = { ...alice, name: 'Alice Updated' };
    const refreshed = applyRosterRefresh(state, [renamedAlice]);
    expect(refreshed.roster['e-alice'].name).toBe('Alice Updated');
    expect(refreshed.marks['e-alice'].status).toBe('Absent');
  });

  it('the critical FWEB-12/§9 case: a student appearing after a bulk mark-all-present is inserted Unmarked, never Present', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice, bob]);
    state = applyBulkMarkPresent(state, T0);
    expect(state.marks['e-alice'].status).toBe('Present');
    expect(state.marks['e-bob'].status).toBe('Present');

    // Carol enrolls late and appears on a subsequent roster refresh, AFTER bulk-mark-all-present
    // already ran once for this session.
    const refreshed = applyRosterRefresh(state, [alice, bob, carol]);
    expect(refreshed.marks['e-carol'].status).toBe('Unmarked');
    expect(refreshed.marks['e-carol'].explicitlySet).toBe(false);
    // Alice/Bob's prior bulk-applied Present marks are untouched by the refresh.
    expect(refreshed.marks['e-alice'].status).toBe('Present');
  });
});

describe('applyBulkMarkPresent', () => {
  it('sets every currently-known roster member to Present, explicitly set, queued for sync', () => {
    const state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice, bob]);
    const marked = applyBulkMarkPresent(state, T0);

    expect(marked.marks['e-alice']).toEqual({
      status: 'Present',
      explicitlySet: true,
      markedAt: T0,
      syncState: 'pending',
    });
    expect(marked.pendingSync['e-alice']).toEqual({
      enrollmentId: 'e-alice',
      status: 'Present',
      queuedAt: T0,
      attempt: 1,
    });
    expect(marked.pendingSync['e-bob'].status).toBe('Present');
  });

  it('is scoped only to the roster snapshot at call time -- never retroactively applied to a later refresh (design-decisions.md)', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    state = applyBulkMarkPresent(state, T0);

    // A second, independent bulk-mark call is never triggered automatically by refresh -- only a
    // deliberate second tap would re-scan the roster, which applyRosterRefresh alone never does.
    const refreshed = applyRosterRefresh(state, [alice, bob]);
    expect(refreshed.marks['e-bob'].status).toBe('Unmarked');
  });

  it('overwrites an already-manually-set mark within the snapshot (bulk is the deliberate baseline reset)', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    state = applyLocalMark(state, 'e-alice', 'Absent', T0);
    const marked = applyBulkMarkPresent(state, T1);
    expect(marked.marks['e-alice'].status).toBe('Present');
  });
});

describe('applyLocalMark', () => {
  it('sets the status, marks it pending for sync, and is a no-op for an unknown enrollmentId', () => {
    const state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    const marked = applyLocalMark(state, 'e-alice', 'Late', T0);
    expect(marked.marks['e-alice'].status).toBe('Late');
    expect(marked.marks['e-alice'].syncState).toBe('pending');
    expect(marked.pendingSync['e-alice'].attempt).toBe(1);

    const unchanged = applyLocalMark(state, 'e-unknown', 'Present', T0);
    expect(unchanged).toBe(state);
  });

  it('increments the pending attempt counter on a second edit before the first ever syncs', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    state = applyLocalMark(state, 'e-alice', 'Present', T0);
    state = applyLocalMark(state, 'e-alice', 'Excused', T1);
    expect(state.marks['e-alice'].status).toBe('Excused');
    expect(state.pendingSync['e-alice']).toEqual({
      enrollmentId: 'e-alice',
      status: 'Excused',
      queuedAt: T1,
      attempt: 2,
    });
  });
});

describe('markSyncing / markQueuedOffline / markSyncFailed', () => {
  function markedState(): AttendanceState {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    state = applyLocalMark(state, 'e-alice', 'Present', T0);
    return state;
  }

  it('markSyncing flips syncState to syncing', () => {
    expect(markSyncing(markedState(), 'e-alice').marks['e-alice'].syncState).toBe('syncing');
  });

  it('markQueuedOffline flips syncState to queued-offline', () => {
    expect(markQueuedOffline(markedState(), 'e-alice').marks['e-alice'].syncState).toBe(
      'queued-offline',
    );
  });

  it('markSyncFailed flips syncState to failed', () => {
    expect(markSyncFailed(markedState(), 'e-alice').marks['e-alice'].syncState).toBe('failed');
  });

  it('is a no-op for an enrollmentId with no existing mark', () => {
    const state = markedState();
    expect(markSyncing(state, 'e-nobody')).toBe(state);
  });
});

describe('applyServerSnapshot', () => {
  function record(overrides: Partial<AttendanceRecordDto> = {}): AttendanceRecordDto {
    return {
      enrollmentId: 'e-alice',
      status: 'Present',
      markedByFacultyMemberId: 'fac-1',
      markedAt: T0,
      ...overrides,
    };
  }

  it('case 1 -- clears the pending entry and marks synced when the response matches our own queued write', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    state = applyLocalMark(state, 'e-alice', 'Present', T0);

    const { state: merged, updatedElsewhere } = applyServerSnapshot(state, [record()]);
    expect(merged.marks['e-alice']).toEqual({
      status: 'Present',
      explicitlySet: true,
      markedByFacultyMemberId: 'fac-1',
      markedAt: T0,
      syncState: 'synced',
    });
    expect(merged.pendingSync['e-alice']).toBeUndefined();
    expect(updatedElsewhere).toEqual([]);
  });

  it('case 2 -- never downgrades a newer, still-pending local edit that disagrees with the snapshot', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    state = applyLocalMark(state, 'e-alice', 'Excused', T1); // newer local edit, not yet synced

    // A stale/slow response reports the OLDER "Present" value.
    const { state: merged, updatedElsewhere } = applyServerSnapshot(state, [
      record({ status: 'Present', markedAt: T0 }),
    ]);
    expect(merged.marks['e-alice'].status).toBe('Excused'); // untouched
    expect(merged.marks['e-alice'].syncState).toBe('pending'); // still pending its own sync
    expect(merged.pendingSync['e-alice']).toBeDefined(); // never cleared
    expect(updatedElsewhere).toEqual([]);
  });

  it('case 3a -- adopts a genuinely-changed value from elsewhere and flags updatedElsewhere', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    state = applyLocalMark(state, 'e-alice', 'Present', T0);
    // First sync response confirms Present as synced (case 1).
    ({ state } = applyServerSnapshot(state, [record({ status: 'Present' })]));

    // A second device now marks the same student Absent; our next merge (e.g. this device's own
    // subsequent unrelated write response also carrying the full session) sees the change.
    const { state: merged, updatedElsewhere } = applyServerSnapshot(state, [
      record({ status: 'Absent', markedByFacultyMemberId: 'fac-2', markedAt: T1 }),
    ]);
    expect(merged.marks['e-alice'].status).toBe('Absent');
    expect(merged.marks['e-alice'].updatedFromAnotherDevice).toBe(true);
    expect(updatedElsewhere).toEqual(['e-alice']);
  });

  it('case 3b -- silently populates a student with no prior explicit status (normal initial load, not a conflict)', () => {
    const state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    const { state: merged, updatedElsewhere } = applyServerSnapshot(state, [record()]);
    expect(merged.marks['e-alice'].status).toBe('Present');
    expect(merged.marks['e-alice'].updatedFromAnotherDevice).toBeFalsy();
    expect(updatedElsewhere).toEqual([]);
  });

  it('ignores a record for an enrollmentId not present in the local roster', () => {
    const state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice]);
    const { state: merged, updatedElsewhere } = applyServerSnapshot(state, [
      record({ enrollmentId: 'e-ghost' }),
    ]);
    expect(merged.marks['e-ghost']).toBeUndefined();
    expect(updatedElsewhere).toEqual([]);
  });

  it('handles multiple records in one snapshot independently', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice, bob]);
    state = applyLocalMark(state, 'e-alice', 'Present', T0);

    const { state: merged } = applyServerSnapshot(state, [
      record({ enrollmentId: 'e-alice', status: 'Present' }),
      record({ enrollmentId: 'e-bob', status: 'Late' }),
    ]);
    expect(merged.marks['e-alice'].syncState).toBe('synced');
    expect(merged.marks['e-bob'].status).toBe('Late');
  });
});

describe('computeTally', () => {
  it('counts every known student exactly once, defaulting missing marks to unmarked', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice, bob, carol]);
    state = applyLocalMark(state, 'e-alice', 'Present', T0);
    state = applyLocalMark(state, 'e-bob', 'Absent', T0);
    // carol left Unmarked.

    const tally = computeTally(state);
    expect(tally).toEqual({ present: 1, absent: 1, late: 0, excused: 0, unmarked: 1 });
  });

  it('returns all zeros for an empty roster', () => {
    expect(computeTally(EMPTY_ATTENDANCE_STATE)).toEqual({
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      unmarked: 0,
    });
  });

  it('tallies Late and Excused correctly', () => {
    let state = applyRosterRefresh(EMPTY_ATTENDANCE_STATE, [alice, bob]);
    state = applyLocalMark(state, 'e-alice', 'Late', T0);
    state = applyLocalMark(state, 'e-bob', 'Excused', T0);
    expect(computeTally(state)).toEqual({
      present: 0,
      absent: 0,
      late: 1,
      excused: 1,
      unmarked: 0,
    });
  });
});

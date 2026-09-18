import type { AttendanceRecordDto, AttendanceStatusCode } from '../../core/api/academic.types';
import {
  EMPTY_ATTENDANCE_STATE,
  type AttendanceState,
  type AttendanceTally,
  type PendingSyncEntry,
  type RosterStudent,
} from './attendance.types';

/**
 * Pure state-transition functions over {@link AttendanceState} (FWEB-11/FWEB-12/FWEB-13). Kept
 * entirely free of Angular/RxJS/HTTP so the ≥90%-coverage bar §4 sets for "Attendance's
 * offline-merge logic" is trivial to hit with plain unit tests -- `AttendanceStore` is a thin
 * orchestration layer over these functions plus {@link AttendanceSequenceGate} plus side effects
 * (persistence, network, connectivity).
 */

/**
 * Roster refresh (FWEB-12, §9: "clearly flags any newly-added student as 'not yet marked' rather
 * than defaulting them to Present"). Any `enrollmentId` not already in `knownEnrollmentIds` is
 * inserted as `Unmarked`/`explicitlySet: false`, regardless of how many bulk actions have already
 * run for this session (design-decisions.md "Bulk 'Mark All Present' Is a One-Time,
 * Snapshot-Scoped Action" -- satisfied here simply by never re-running the bulk default on
 * refresh, only ever inserting new entries as unset). A student already known keeps their current
 * mark untouched, but their roster display data (name/photo) is refreshed to the latest value.
 */
export function applyRosterRefresh(
  state: AttendanceState,
  entries: readonly RosterStudent[],
): AttendanceState {
  const knownSet = new Set(state.knownEnrollmentIds);
  const roster = { ...state.roster };
  const marks = { ...state.marks };
  const newIds: string[] = [];

  for (const entry of entries) {
    roster[entry.enrollmentId] = entry;
    if (!knownSet.has(entry.enrollmentId)) {
      knownSet.add(entry.enrollmentId);
      newIds.push(entry.enrollmentId);
      marks[entry.enrollmentId] = {
        status: 'Unmarked',
        explicitlySet: false,
        syncState: 'synced',
      };
    }
  }

  return {
    ...state,
    knownEnrollmentIds: [...state.knownEnrollmentIds, ...newIds],
    roster,
    marks,
  };
}

/**
 * Bulk "mark all Present" (FWEB-11, §3.2's dominant-pattern default). Scoped ONLY to the roster
 * snapshot as it exists in `state` at the moment this is called -- a student who appears later via
 * {@link applyRosterRefresh} was never part of this snapshot and is therefore never retroactively
 * defaulted to Present, satisfying design-decisions.md's snapshot-scoping decision by construction
 * (this function only ever touches `Object.keys(state.roster)` as they exist right now).
 *
 * Overwrites every currently-known student's mark to Present -- the dominant real-world workflow
 * is tapping this FIRST, then flipping exceptions, so a deliberate re-tap after some manual marks
 * is expected to reset the visible baseline, not skip already-marked students.
 */
export function applyBulkMarkPresent(
  state: AttendanceState,
  clientTimestamp: string,
): AttendanceState {
  const marks = { ...state.marks };
  const pendingSync = { ...state.pendingSync };

  for (const enrollmentId of Object.keys(state.roster)) {
    marks[enrollmentId] = {
      status: 'Present',
      explicitlySet: true,
      markedAt: clientTimestamp,
      syncState: 'pending',
    };
    pendingSync[enrollmentId] = nextPendingEntry(
      pendingSync[enrollmentId],
      enrollmentId,
      'Present',
      clientTimestamp,
    );
  }

  return { ...state, marks, pendingSync };
}

/** A single manual mark (FWEB-10/FWEB-13) -- always optimistic-local-first, never blocks on network (§7). */
export function applyLocalMark(
  state: AttendanceState,
  enrollmentId: string,
  status: AttendanceStatusCode,
  clientTimestamp: string,
): AttendanceState {
  if (!(enrollmentId in state.roster)) {
    return state;
  }

  return {
    ...state,
    marks: {
      ...state.marks,
      [enrollmentId]: {
        status,
        explicitlySet: true,
        markedAt: clientTimestamp,
        syncState: 'pending',
      },
    },
    pendingSync: {
      ...state.pendingSync,
      [enrollmentId]: nextPendingEntry(
        state.pendingSync[enrollmentId],
        enrollmentId,
        status,
        clientTimestamp,
      ),
    },
  };
}

function nextPendingEntry(
  existing: PendingSyncEntry | undefined,
  enrollmentId: string,
  status: AttendanceStatusCode,
  queuedAt: string,
): PendingSyncEntry {
  return { enrollmentId, status, queuedAt, attempt: (existing?.attempt ?? 0) + 1 };
}

/** Marks one pending entry as actively syncing (an online POST currently in flight). */
export function markSyncing(state: AttendanceState, enrollmentId: string): AttendanceState {
  return updateSyncState(state, enrollmentId, 'syncing');
}

/** Marks one pending entry as queued-offline (FWEB-12 -- a distinct state from "syncing", surfaced in the UI per-row indicator, §7). */
export function markQueuedOffline(state: AttendanceState, enrollmentId: string): AttendanceState {
  return updateSyncState(state, enrollmentId, 'queued-offline');
}

/** Marks one pending entry as failed (a real network/server error, distinct from "queued offline"). */
export function markSyncFailed(state: AttendanceState, enrollmentId: string): AttendanceState {
  return updateSyncState(state, enrollmentId, 'failed');
}

function updateSyncState(
  state: AttendanceState,
  enrollmentId: string,
  syncState: 'syncing' | 'queued-offline' | 'failed',
): AttendanceState {
  const existing = state.marks[enrollmentId];
  if (!existing) {
    return state;
  }
  return { ...state, marks: { ...state.marks, [enrollmentId]: { ...existing, syncState } } };
}

export interface SnapshotMergeResult {
  readonly state: AttendanceState;
  /** enrollmentIds whose value changed due to something other than this device's own in-flight write -- surface a per-row "updated from another device" notice for these (§9/edge-cases.md). */
  readonly updatedElsewhere: readonly string[];
}

/**
 * Merges an authoritative {@link AttendanceRecordDto} snapshot into local state -- the single
 * function every session-state-producing response (a sync-worker upload's own response, or a
 * future manual re-fetch) is merged through, AFTER the caller's own {@link AttendanceSequenceGate}
 * has already confirmed the response is not stale. This function itself is unconditional (it does
 * not know about sequence numbers) -- the gate decision is made by the caller.
 *
 * Merge rule per record:
 * 1. If a pending (not-yet-synced) local edit exists for this student and its queued status
 *    matches the incoming record: this is our own write landing -- clear the pending entry, adopt
 *    the record as `synced`, no notice (this is expected, not a conflict).
 * 2. If a pending local edit exists but its queued status DIFFERS from the incoming record: our
 *    own newer, not-yet-uploaded edit is still in flight and must not be downgraded by an older
 *    snapshot -- leave local state untouched; the pending edit's own eventual response is the
 *    thing that will actually settle this student's final value.
 * 3. Otherwise (no pending edit): if the student was previously `synced` with an explicit status
 *    that differs from the incoming one, this is a genuine change made elsewhere (another device,
 *    invariant §8.1) -- adopt the incoming value and flag it in {@link SnapshotMergeResult.updatedElsewhere}.
 *    If the student had no explicit status yet (first time seeing real data for them, e.g. initial
 *    session load), adopt it silently -- this is normal population, not a conflict.
 *
 * A record for an enrollmentId this client doesn't yet know about (not in `state.roster`) is
 * ignored -- a subsequent roster refresh will pick that student up as `Unmarked` per
 * {@link applyRosterRefresh}'s own rule, and a later merge will reconcile their real status then.
 */
export function applyServerSnapshot(
  state: AttendanceState,
  records: readonly AttendanceRecordDto[],
): SnapshotMergeResult {
  const marks = { ...state.marks };
  const pendingSync = { ...state.pendingSync };
  const settledEnrollmentIds = new Set<string>();
  const updatedElsewhere: string[] = [];

  for (const record of records) {
    const enrollmentId = record.enrollmentId;
    if (!(enrollmentId in state.roster)) {
      continue;
    }

    const status = record.status as AttendanceStatusCode;
    const pending = pendingSync[enrollmentId];
    const existing = marks[enrollmentId];

    if (pending && pending.status === status) {
      settledEnrollmentIds.add(enrollmentId);
      marks[enrollmentId] = {
        status,
        explicitlySet: true,
        markedByFacultyMemberId: record.markedByFacultyMemberId,
        markedAt: record.markedAt,
        syncState: 'synced',
      };
      continue;
    }

    if (pending && pending.status !== status) {
      // Our own newer edit hasn't synced yet -- never let an older snapshot downgrade it.
      continue;
    }

    const changedElsewhere =
      existing?.explicitlySet && existing.syncState === 'synced' && existing.status !== status;

    marks[enrollmentId] = {
      status,
      explicitlySet: true,
      markedByFacultyMemberId: record.markedByFacultyMemberId,
      markedAt: record.markedAt,
      syncState: 'synced',
      updatedFromAnotherDevice: changedElsewhere,
    };

    if (changedElsewhere) {
      updatedElsewhere.push(enrollmentId);
    }
  }

  const remainingPendingSync =
    settledEnrollmentIds.size === 0
      ? pendingSync
      : Object.fromEntries(
          Object.entries(pendingSync).filter(
            ([enrollmentId]) => !settledEnrollmentIds.has(enrollmentId),
          ),
        );

  return { state: { ...state, marks, pendingSync: remainingPendingSync }, updatedElsewhere };
}

/** Live present/absent/late/excused/unmarked tally (FWEB-11's persistent header). */
export function computeTally(state: AttendanceState): AttendanceTally {
  const tally: { -readonly [K in keyof AttendanceTally]: number } = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    unmarked: 0,
  };

  for (const enrollmentId of state.knownEnrollmentIds) {
    switch (state.marks[enrollmentId]?.status ?? 'Unmarked') {
      case 'Present':
        tally.present += 1;
        break;
      case 'Absent':
        tally.absent += 1;
        break;
      case 'Late':
        tally.late += 1;
        break;
      case 'Excused':
        tally.excused += 1;
        break;
      default:
        tally.unmarked += 1;
    }
  }

  return tally;
}

export { EMPTY_ATTENDANCE_STATE };

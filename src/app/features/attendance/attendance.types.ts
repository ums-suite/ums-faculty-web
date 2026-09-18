import type { AttendanceStatusCode } from '../../core/api/academic.types';

/** FWEB-10..16 domain types. `'Unmarked'` is a client-only concept (never sent to the server) representing "not yet marked" (§9's "newly-added roster student" rule). */
export type MarkStatus = AttendanceStatusCode | 'Unmarked';

export type SyncState = 'synced' | 'pending' | 'syncing' | 'queued-offline' | 'failed';

/** One row of the roster this app displays -- photo/name/id (§7 Attendance marking key screen). */
export interface RosterStudent {
  readonly enrollmentId: string;
  readonly studentId: string;
  readonly name: string;
  readonly photoUrl?: string;
}

/** The current mark state for one (Student, session) pair, including FWEB-13's audit fields. */
export interface AttendanceMarkRecord {
  readonly status: MarkStatus;
  /** True once a real status has been set (bulk or manual) -- false means "not yet marked" (§9/design-decisions.md snapshot-scoping). */
  readonly explicitlySet: boolean;
  readonly markedByFacultyMemberId?: string;
  readonly markedAt?: string;
  readonly syncState: SyncState;
  /** Set when a merge discovers this student's status changed from what THIS device last confirmed (edge-cases.md "two devices racing"). Cleared once acknowledged by the UI. */
  readonly updatedFromAnotherDevice?: boolean;
}

/** FWEB-12's explicit local-dirty/pending-sync queue entry -- modeled as its own state, never folded into a generic "loading" flag. */
export interface PendingSyncEntry {
  readonly enrollmentId: string;
  readonly status: AttendanceStatusCode;
  readonly queuedAt: string;
  readonly attempt: number;
}

/** The full, serializable Attendance store state for one session -- plain data so it can be persisted (FWEB-7) and reconciled with pure functions (FWEB-12). */
export interface AttendanceState {
  /** Every enrollmentId ever seen via `applyRosterRefresh`, in first-seen order -- drives display order and the snapshot-scoping rule for bulk mark-all-present. */
  readonly knownEnrollmentIds: readonly string[];
  readonly roster: Readonly<Record<string, RosterStudent>>;
  readonly marks: Readonly<Record<string, AttendanceMarkRecord>>;
  readonly pendingSync: Readonly<Record<string, PendingSyncEntry>>;
}

export const EMPTY_ATTENDANCE_STATE: AttendanceState = {
  knownEnrollmentIds: [],
  roster: {},
  marks: {},
  pendingSync: {},
};

export interface AttendanceSessionKey {
  readonly courseOfferingId: string;
  /** `yyyy-MM-dd`, matching `.NET`'s `DateOnly` wire format. */
  readonly sessionDate: string;
}

export interface AttendanceTally {
  readonly present: number;
  readonly absent: number;
  readonly late: number;
  readonly excused: number;
  readonly unmarked: number;
}

/** One row for the roster UI -- the join of roster display data + current mark state. */
export interface AttendanceRosterRow extends RosterStudent {
  readonly mark: AttendanceMarkRecord;
}

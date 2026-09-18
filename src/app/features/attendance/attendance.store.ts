import { Injectable, computed, inject, signal } from '@angular/core';
import { AcademicApi } from '../../core/api/academic.api';
import type { AttendanceSessionDto, AttendanceStatusCode } from '../../core/api/academic.types';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { ConnectivityReconciliationService } from '../../core/pwa/connectivity-reconciliation.service';
import { registerAttendanceSync } from '../../core/pwa/background-sync.util';
import { LowAttendanceAlertsService } from '../../core/state/low-attendance-alerts.service';
import { AttendanceOfflineStorageService } from './attendance-offline-storage.service';
import { AttendanceSequenceGate } from './attendance-sequence-gate';
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
  computeLowAttendanceEnrollmentIds,
  computeStudentHistory,
  computeStudentStats,
  type StudentAttendanceStat,
  type StudentSessionHistoryEntry,
} from './attendance-stats.util';
import {
  EMPTY_ATTENDANCE_STATE,
  type AttendanceRosterRow,
  type AttendanceSessionKey,
  type AttendanceState,
  type RosterStudent,
} from './attendance.types';

const DEFAULT_LOW_ATTENDANCE_THRESHOLD_PERCENT = 75;

/**
 * The Attendance feature store (FWEB-10 through FWEB-16) -- the single highest-scrutiny piece of
 * this app's scope. Orchestrates the pure {@link AttendanceSequenceGate}/`attendance-
 * reconciliation.ts` logic against real side effects (the `AcademicApi.markAttendance` write,
 * connectivity, persistence) without embedding any of that merge logic itself, so the ≥90%-
 * coverage bar (§4) is carried almost entirely by the already-thoroughly-tested pure modules this
 * store simply calls.
 *
 * **Roster loading -- a confirmed, load-bearing backend gap.** `academic.types.ts`'s
 * `CourseOfferingDto` doc already flags this: there is no `ums-core` endpoint that lists enrolled
 * students for a CourseOffering. {@link loadRoster} therefore accepts roster entries directly from
 * its caller (`AttendanceComponent`) rather than fetching them itself -- this keeps the store's own
 * reconciliation/offline-merge logic fully real and testable today, with the roster SOURCE as the
 * one clearly isolated seam a real `GET /course-offerings/{id}/enrollments`-shaped endpoint plugs
 * into later without touching anything else in this store.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceStore {
  private readonly academicApi = inject(AcademicApi);
  private readonly connectivity = inject(ConnectivityService);
  private readonly connectivityReconciliation = inject(ConnectivityReconciliationService);
  private readonly offlineStorage = inject(AttendanceOfflineStorageService);
  private readonly lowAttendanceAlerts = inject(LowAttendanceAlertsService);

  private readonly gate = new AttendanceSequenceGate();

  private readonly sessionKeyState = signal<AttendanceSessionKey | null>(null);
  private readonly stateState = signal<AttendanceState>(EMPTY_ATTENDANCE_STATE);
  private readonly correctionWindowCloseState = signal<string | null>(null);
  private readonly updatedElsewhereState = signal<readonly string[]>([]);
  /** Every session snapshot this store has itself observed, keyed by session date -- see the class doc's "confirmed gap" note; `attendance-stats.util.ts` computes stats/history from this. */
  private readonly sessionLogState = signal<Readonly<Record<string, AttendanceSessionDto>>>({});
  private readonly lowAttendanceThresholdPercent = signal(DEFAULT_LOW_ATTENDANCE_THRESHOLD_PERCENT);

  readonly sessionKey = this.sessionKeyState.asReadonly();
  readonly isOffline = computed(() => !this.connectivity.isOnline());
  readonly updatedElsewhere = this.updatedElsewhereState.asReadonly();
  readonly correctionWindowClose = this.correctionWindowCloseState.asReadonly();

  readonly tally = computed(() => computeTally(this.stateState()));

  readonly roster = computed<readonly AttendanceRosterRow[]>(() => {
    const state = this.stateState();
    return state.knownEnrollmentIds.map((enrollmentId) => ({
      ...state.roster[enrollmentId],
      mark: state.marks[enrollmentId],
    }));
  });

  readonly stats = computed<readonly StudentAttendanceStat[]>(() =>
    computeStudentStats(this.sessionLogState(), this.stateState().knownEnrollmentIds),
  );

  readonly lowAttendanceEnrollmentIds = computed(() =>
    computeLowAttendanceEnrollmentIds(this.stats(), this.lowAttendanceThresholdPercent()),
  );

  constructor() {
    this.connectivityReconciliation.reconciled$.subscribe(() => this.flushPendingSync());
  }

  /** Opens (or re-opens) a session tied to one CourseOffering/date (FWEB-10), rehydrating any locally-persisted state for it. */
  openSession(key: AttendanceSessionKey): void {
    this.sessionKeyState.set(key);
    this.gate.reset();
    this.stateState.set(this.offlineStorage.load(key) ?? EMPTY_ATTENDANCE_STATE);
    this.updatedElsewhereState.set([]);
    this.flushPendingSync();
  }

  setLowAttendanceThreshold(percent: number): void {
    this.lowAttendanceThresholdPercent.set(percent);
  }

  /** Loads/refreshes the roster (FWEB-10/FWEB-12) -- see class doc for why this takes entries directly rather than fetching them. */
  loadRoster(entries: readonly RosterStudent[]): void {
    this.stateState.update((s) => applyRosterRefresh(s, entries));
    this.persist();
  }

  /** Bulk "mark all Present" (FWEB-11), scoped to the current roster snapshot only. */
  markAllPresent(): void {
    this.stateState.update((s) => applyBulkMarkPresent(s, new Date().toISOString()));
    this.persist();
    this.flushPendingSync();
  }

  /** A single mark (FWEB-10/FWEB-13) -- optimistic-local-first, never blocks on network (§7). */
  mark(enrollmentId: string, status: AttendanceStatusCode): void {
    this.stateState.update((s) =>
      applyLocalMark(s, enrollmentId, status, new Date().toISOString()),
    );
    this.persist();
    this.dispatch(enrollmentId);
  }

  /** Clears one student's "updated from another device" notice once the faculty member has seen it. */
  acknowledgeUpdatedElsewhere(enrollmentId: string): void {
    this.updatedElsewhereState.update((ids) => ids.filter((id) => id !== enrollmentId));
  }

  studentHistory(enrollmentId: string): readonly StudentSessionHistoryEntry[] {
    return computeStudentHistory(this.sessionLogState(), enrollmentId);
  }

  /**
   * Dispatches a manual session re-fetch (edge-cases.md "Background-Sync Merge Races a Manual
   * Reconnect Re-Fetch"). Stamped at DISPATCH time, not response time, per the design decision --
   * see {@link AttendanceSequenceGate}'s own doc.
   *
   * **Confirmed backend gap**: there is currently no `GET` endpoint for an existing
   * AttendanceSession to actually call here (`academic.types.ts`'s `AttendanceSessionDto` doc).
   * This method and {@link handleManualRefreshResponse} exist so the exact reconciliation
   * mechanism §4's ≥90%-coverage bar targets is fully built and tested end-to-end at the store
   * level -- {@link handleManualRefreshResponse} is the seam a real `GET` plugs into once one
   * ships, rather than this being left unimplemented pending that endpoint.
   */
  dispatchManualRefresh(): number {
    return this.gate.stampRead();
  }

  /** See {@link dispatchManualRefresh}. */
  handleManualRefreshResponse(session: AttendanceSessionDto, dispatchSequence: number): void {
    if (!this.gate.tryApply(dispatchSequence)) {
      return;
    }
    this.applySnapshot(session);
  }

  private dispatch(enrollmentId: string): void {
    const key = this.sessionKeyState();
    const entry = this.stateState().pendingSync[enrollmentId];
    if (!key || !entry) {
      return;
    }

    if (!this.connectivity.isOnline()) {
      this.stateState.update((s) => markQueuedOffline(s, enrollmentId));
      this.persist();
      void registerAttendanceSync();
      return;
    }

    this.stateState.update((s) => markSyncing(s, enrollmentId));
    this.academicApi
      .markAttendance({
        courseOfferingId: key.courseOfferingId,
        sessionDate: key.sessionDate,
        correctionWindowClose: this.correctionWindowCloseState(),
        enrollmentId,
        status: entry.status,
      })
      .subscribe({
        next: (session) => {
          const sequence = this.gate.stampWriteResponse();
          if (this.gate.tryApply(sequence)) {
            this.applySnapshot(session);
          }
        },
        error: () => {
          this.stateState.update((s) => markSyncFailed(s, enrollmentId));
          this.persist();
        },
      });
  }

  private applySnapshot(session: AttendanceSessionDto): void {
    const { state, updatedElsewhere } = applyServerSnapshot(this.stateState(), session.records);
    this.stateState.set(state);
    this.correctionWindowCloseState.set(session.correctionWindowClose);
    if (updatedElsewhere.length > 0) {
      this.updatedElsewhereState.update((ids) => [...new Set([...ids, ...updatedElsewhere])]);
    }
    this.sessionLogState.update((log) => ({ ...log, [session.sessionDate]: session }));
    this.persist();
    this.lowAttendanceAlerts.setCount(this.lowAttendanceEnrollmentIds().length);
  }

  /** Flushes every still-pending mark (FWEB-12) -- called on reconnect and on session open, so a device that queued marks offline and was later closed/reopened still syncs them. */
  private flushPendingSync(): void {
    if (!this.connectivity.isOnline()) {
      return;
    }
    for (const enrollmentId of Object.keys(this.stateState().pendingSync)) {
      this.dispatch(enrollmentId);
    }
  }

  private persist(): void {
    const key = this.sessionKeyState();
    if (key) {
      this.offlineStorage.save(key, this.stateState());
    }
  }
}

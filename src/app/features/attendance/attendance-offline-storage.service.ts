import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { ATTENDANCE_STORAGE_PREFIX } from '../../core/pwa/attendance-cache-clear.service';
import type { AttendanceSessionKey, AttendanceState } from './attendance.types';

/**
 * Persists one session's {@link AttendanceState} to `localStorage` (FWEB-7's "service-worker
 * caching of roster/marks... explicit local-dirty/pending-sync queue" -- the pending-sync queue is
 * modeled inside `AttendanceState` itself, see `attendance.types.ts`). Persisting synchronously to
 * `localStorage` (not IndexedDB) is a deliberate simplicity choice: a session's state is small
 * (at most ~60 marks, §4's own batch-size figure) and this only ever needs to survive a page
 * reload/app restart, not store large binary data.
 *
 * Every key lives under {@link ATTENDANCE_STORAGE_PREFIX} so {@link AttendanceCacheClearService}'s
 * logout-time sweep (requirement-spec.md §5: offline-queued attendance data is sensitive student
 * data and must never survive a device-level logout) catches it without this service needing its
 * own separate clear-on-logout wiring.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceOfflineStorageService {
  private readonly document = inject(DOCUMENT);

  save(key: AttendanceSessionKey, state: AttendanceState): void {
    try {
      this.document.defaultView?.localStorage.setItem(storageKey(key), JSON.stringify(state));
    } catch {
      // Storage unavailable (private browsing, quota) -- the in-memory state still works for this
      // tab's life; only cross-reload durability is lost.
    }
  }

  load(key: AttendanceSessionKey): AttendanceState | null {
    try {
      const raw = this.document.defaultView?.localStorage.getItem(storageKey(key));
      return raw ? (JSON.parse(raw) as AttendanceState) : null;
    } catch {
      return null;
    }
  }

  clear(key: AttendanceSessionKey): void {
    try {
      this.document.defaultView?.localStorage.removeItem(storageKey(key));
    } catch {
      // Nothing to clean up.
    }
  }
}

function storageKey(key: AttendanceSessionKey): string {
  return `${ATTENDANCE_STORAGE_PREFIX}session.${key.courseOfferingId}.${key.sessionDate}`;
}

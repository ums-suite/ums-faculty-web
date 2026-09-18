import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/** Prefix every attendance-offline persistence key uses -- see `attendance-offline-storage.ts`. */
export const ATTENDANCE_STORAGE_PREFIX = 'fweb.attendance.';

/**
 * Clears every locally-cached attendance artifact on logout (FWEB-7, requirement-spec.md §5:
 * "Offline-queued attendance data cached by the service worker is treated as sensitive student
 * data -- cache is scoped to the authenticated session and cleared on logout, never left
 * recoverable after a device-level logout").
 *
 * Two layers are cleared:
 * 1. This app's own `localStorage`-persisted pending-sync queue/roster snapshot (everything under
 *    {@link ATTENDANCE_STORAGE_PREFIX}, written by `attendance-offline-storage.ts`) -- the actual
 *    per-student marks a faculty member queued offline.
 * 2. The Angular Service Worker's own `ngsw` Cache Storage entries (best-effort -- the
 *    `CacheStorage` API has no "clear just this app's SW caches" primitive beyond enumerating and
 *    deleting by name, and a cache miss here just means the next load re-fetches from network, so
 *    a failure is never treated as fatal).
 *
 * Called from the app shell's logout action, alongside `AuthService.logout()` -- deliberately kept
 * as its own service rather than folded into `AuthService` itself, since `AuthService` is generic
 * session plumbing and knows nothing about Attendance's own offline-cache shape.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceCacheClearService {
  private readonly document = inject(DOCUMENT);

  async clear(): Promise<void> {
    this.clearLocalStorage();
    await this.clearCacheStorage();
  }

  private clearLocalStorage(): void {
    const win = this.document.defaultView;
    if (!win) {
      return;
    }
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < win.localStorage.length; i++) {
        const key = win.localStorage.key(i);
        if (key?.startsWith(ATTENDANCE_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => win.localStorage.removeItem(key));
    } catch {
      // Storage unavailable (private browsing) -- nothing was ever persisted to clear.
    }
  }

  private async clearCacheStorage(): Promise<void> {
    const win = this.document.defaultView;
    if (!win?.caches) {
      return;
    }
    try {
      const names = await win.caches.keys();
      await Promise.all(
        names.filter((name) => name.includes('ngsw')).map((name) => win.caches.delete(name)),
      );
    } catch {
      // Cache Storage unavailable/blocked -- best-effort only, never fatal to logout.
    }
  }
}

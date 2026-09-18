import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/**
 * The single source of truth for "is this device online right now" (FWEB-7, requirement-spec.md
 * §4 Offline tolerance row). Attendance marking never blocks on this (§7's optimistic-local-first
 * model) -- it only changes the visible "working offline" banner and the pending-sync queue's
 * behavior; every OTHER mutating feature in this app (Grading/Materials/Leave) reads
 * {@link isOnline} to degrade to a clear offline state per §4/§10.2's explicit scoping of offline
 * tolerance to Attendance alone.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly document = inject(DOCUMENT);

  private readonly onlineState = signal(this.readNavigatorOnline());

  readonly isOnline = this.onlineState.asReadonly();

  constructor() {
    const win = this.document.defaultView;
    win?.addEventListener('online', () => this.onlineState.set(true));
    win?.addEventListener('offline', () => this.onlineState.set(false));
  }

  private readNavigatorOnline(): boolean {
    const win = this.document.defaultView;
    // `navigator.onLine` defaults to `true` when unavailable (e.g. some test environments) --
    // never treat an unknown state as "definitely offline", which would incorrectly queue a write
    // that could actually succeed immediately.
    return win?.navigator?.onLine ?? true;
  }
}

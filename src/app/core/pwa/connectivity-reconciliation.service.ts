import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Fires the instant the browser reports `online`, independent of whether the tab is currently
 * focused (FWEB-7/FWEB-12) -- a faculty member can remain foregrounded on a cached, offline
 * attendance roster the whole time (a phone with the app open but no signal in a classroom), so
 * gating reconciliation on foreground-change alone would miss exactly that scenario.
 *
 * Deliberately a thin, injectable event bus rather than each feature store adding its own
 * `window.addEventListener('online', ...)` -- one listener, many subscribers ({@link
 * AttendanceStore}'s own Background-Sync-flush trigger, chiefly), so the "reconcile on reconnect"
 * rule is enforced in exactly one place.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityReconciliationService {
  private readonly document = inject(DOCUMENT);
  private readonly reconciledSubject = new Subject<void>();

  /** Fires once per `online` transition. Subscribers should flush any pending-sync work. */
  readonly reconciled$ = this.reconciledSubject.asObservable();

  constructor() {
    this.document.defaultView?.addEventListener('online', () => this.reconciledSubject.next());
  }
}

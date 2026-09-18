import { Injectable, signal } from '@angular/core';

/**
 * The one small cross-feature seam between Attendance and Dashboard (FWEB-15: "Low-attendance
 * threshold flagging against a university-configured threshold, surfaced on the roster and
 * rolled into Dashboard's pending-action list").
 *
 * `AttendanceStore` (FWEB-10 through FWEB-16) recomputes and reports the current count of
 * students below the configured threshold across whatever course/session is currently loaded;
 * `DashboardStore` (FWEB-9) reads it to render a pending-action row -- neither store imports the
 * other directly, keeping each feature module's own store the single owner of its own domain
 * state (requirement-spec.md §2 State management row).
 */
@Injectable({ providedIn: 'root' })
export class LowAttendanceAlertsService {
  private readonly countState = signal(0);
  readonly count = this.countState.asReadonly();

  setCount(count: number): void {
    this.countState.set(Math.max(0, count));
  }
}

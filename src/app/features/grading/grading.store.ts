import { Injectable, signal } from '@angular/core';

/**
 * Scaffold only (FWEB-6, requirement-spec.md §2 State management row: "per-feature signal-store
 * scaffolding (Dashboard, Attendance, Grading, Materials, Leave, Research -- scaffold now, flesh
 * out as their own tickets land)"). Grading's real store/mark-entry/lock-state logic is FWEB-17
 * through FWEB-21, out of this pass's scope -- this stub exists only so `app.routes.ts`'s route
 * tree and DI graph shape are stable before that ticket lands.
 */
@Injectable({ providedIn: 'root' })
export class GradingStore {
  private readonly isLoadingState = signal(false);
  readonly isLoading = this.isLoadingState.asReadonly();
}

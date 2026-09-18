import { Injectable, signal } from '@angular/core';

/** Scaffold only (FWEB-6) -- Leave's real store lands with FWEB-24 through FWEB-26, out of this pass's scope. */
@Injectable({ providedIn: 'root' })
export class LeaveStore {
  private readonly isLoadingState = signal(false);
  readonly isLoading = this.isLoadingState.asReadonly();
}

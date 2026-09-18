import { Injectable, signal } from '@angular/core';

/** Scaffold only (FWEB-6) -- Research Profile's real store lands with FWEB-27/FWEB-28, out of this pass's scope. */
@Injectable({ providedIn: 'root' })
export class ResearchStore {
  private readonly isLoadingState = signal(false);
  readonly isLoading = this.isLoadingState.asReadonly();
}

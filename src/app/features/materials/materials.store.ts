import { Injectable, signal } from '@angular/core';

/** Scaffold only (FWEB-6) -- Materials' real store lands with FWEB-22/FWEB-23, out of this pass's scope. */
@Injectable({ providedIn: 'root' })
export class MaterialsStore {
  private readonly isLoadingState = signal(false);
  readonly isLoading = this.isLoadingState.asReadonly();
}

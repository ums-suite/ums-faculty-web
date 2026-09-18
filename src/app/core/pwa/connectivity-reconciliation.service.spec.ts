import { TestBed } from '@angular/core/testing';
import { ConnectivityReconciliationService } from './connectivity-reconciliation.service';

describe('ConnectivityReconciliationService', () => {
  it('emits on reconciled$ when the window fires an "online" event', () => {
    const service = TestBed.inject(ConnectivityReconciliationService);
    const emissions: unknown[] = [];
    service.reconciled$.subscribe((v) => emissions.push(v));

    window.dispatchEvent(new Event('online'));

    expect(emissions.length).toBe(1);
  });
});

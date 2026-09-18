import { TestBed } from '@angular/core/testing';
import { ConnectivityService } from './connectivity.service';

describe('ConnectivityService', () => {
  it('reflects navigator.onLine at construction time', () => {
    spyOnProperty(navigator, 'onLine').and.returnValue(true);
    const service = TestBed.inject(ConnectivityService);
    expect(service.isOnline()).toBe(true);
  });

  it('flips to false on a window "offline" event and back to true on "online"', () => {
    const service = TestBed.inject(ConnectivityService);
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(service.isOnline()).toBe(true);
  });
});

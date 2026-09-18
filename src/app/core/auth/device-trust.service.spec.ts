import { TestBed } from '@angular/core/testing';
import { DeviceTrustService } from './device-trust.service';

describe('DeviceTrustService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.clear());

  it('defaults to treating the device as NOT personal (safe default)', () => {
    const service = TestBed.inject(DeviceTrustService);
    expect(service.isPersonalDevice()).toBe(false);
  });

  it('persists an explicit "this is my personal device" choice across instances', () => {
    const service = TestBed.inject(DeviceTrustService);
    service.setIsPersonalDevice(true);
    expect(service.isPersonalDevice()).toBe(true);

    const secondService = TestBed.inject(DeviceTrustService);
    expect(secondService).toBe(service); // singleton within one TestBed
    expect(localStorage.getItem('fweb.device-trust.is-personal')).toBe('true');
  });

  it('clear() resets to the safe (not personal) default and removes the stored value', () => {
    const service = TestBed.inject(DeviceTrustService);
    service.setIsPersonalDevice(true);
    service.clear();
    expect(service.isPersonalDevice()).toBe(false);
    expect(localStorage.getItem('fweb.device-trust.is-personal')).toBeNull();
  });
});

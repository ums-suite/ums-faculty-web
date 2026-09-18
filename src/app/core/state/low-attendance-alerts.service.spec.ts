import { TestBed } from '@angular/core/testing';
import { LowAttendanceAlertsService } from './low-attendance-alerts.service';

describe('LowAttendanceAlertsService', () => {
  it('starts at zero', () => {
    const service = TestBed.inject(LowAttendanceAlertsService);
    expect(service.count()).toBe(0);
  });

  it('reflects the count set by the reporting feature', () => {
    const service = TestBed.inject(LowAttendanceAlertsService);
    service.setCount(4);
    expect(service.count()).toBe(4);
  });

  it('clamps a negative count to zero', () => {
    const service = TestBed.inject(LowAttendanceAlertsService);
    service.setCount(-2);
    expect(service.count()).toBe(0);
  });
});

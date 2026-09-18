import { TestBed } from '@angular/core/testing';
import { AttendanceOfflineStorageService } from './attendance-offline-storage.service';
import { EMPTY_ATTENDANCE_STATE } from './attendance.types';

describe('AttendanceOfflineStorageService', () => {
  const key = { courseOfferingId: 'off-1', sessionDate: '2026-09-18' };

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns null when nothing has been saved yet', () => {
    const service = TestBed.inject(AttendanceOfflineStorageService);
    expect(service.load(key)).toBeNull();
  });

  it('round-trips a saved state', () => {
    const service = TestBed.inject(AttendanceOfflineStorageService);
    const state = { ...EMPTY_ATTENDANCE_STATE, knownEnrollmentIds: ['e-1'] };
    service.save(key, state);
    expect(service.load(key)).toEqual(state);
  });

  it('scopes storage per (courseOfferingId, sessionDate)', () => {
    const service = TestBed.inject(AttendanceOfflineStorageService);
    service.save(key, { ...EMPTY_ATTENDANCE_STATE, knownEnrollmentIds: ['e-1'] });
    const otherKey = { courseOfferingId: 'off-2', sessionDate: '2026-09-18' };
    expect(service.load(otherKey)).toBeNull();
  });

  it('clear() removes only that session key', () => {
    const service = TestBed.inject(AttendanceOfflineStorageService);
    service.save(key, EMPTY_ATTENDANCE_STATE);
    service.clear(key);
    expect(service.load(key)).toBeNull();
  });

  it('returns null for corrupted JSON rather than throwing', () => {
    const service = TestBed.inject(AttendanceOfflineStorageService);
    localStorage.setItem('fweb.attendance.session.off-1.2026-09-18', '{not json');
    expect(service.load(key)).toBeNull();
  });
});

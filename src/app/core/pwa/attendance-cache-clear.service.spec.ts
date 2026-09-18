import { TestBed } from '@angular/core/testing';
import {
  ATTENDANCE_STORAGE_PREFIX,
  AttendanceCacheClearService,
} from './attendance-cache-clear.service';

describe('AttendanceCacheClearService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('removes every localStorage key under the attendance prefix, leaving others untouched', async () => {
    localStorage.setItem(`${ATTENDANCE_STORAGE_PREFIX}session.abc`, '{"foo":1}');
    localStorage.setItem(`${ATTENDANCE_STORAGE_PREFIX}queue.abc`, '[]');
    localStorage.setItem('fweb.device-trust.is-personal', 'true');

    const service = TestBed.inject(AttendanceCacheClearService);
    await service.clear();

    expect(localStorage.getItem(`${ATTENDANCE_STORAGE_PREFIX}session.abc`)).toBeNull();
    expect(localStorage.getItem(`${ATTENDANCE_STORAGE_PREFIX}queue.abc`)).toBeNull();
    expect(localStorage.getItem('fweb.device-trust.is-personal')).toBe('true');
  });

  it('resolves even when the Cache Storage API is unavailable', async () => {
    const service = TestBed.inject(AttendanceCacheClearService);
    await expectAsync(service.clear()).toBeResolved();
  });
});

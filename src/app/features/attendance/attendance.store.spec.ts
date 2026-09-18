import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { AcademicApi } from '../../core/api/academic.api';
import type { AttendanceSessionDto } from '../../core/api/academic.types';
import { ConnectivityReconciliationService } from '../../core/pwa/connectivity-reconciliation.service';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { LowAttendanceAlertsService } from '../../core/state/low-attendance-alerts.service';
import { AttendanceOfflineStorageService } from './attendance-offline-storage.service';
import { AttendanceStore } from './attendance.store';
import type { RosterStudent } from './attendance.types';

describe('AttendanceStore', () => {
  let academicApiSpy: jasmine.SpyObj<AcademicApi>;
  let connectivityStub: { isOnline: ReturnType<typeof signal<boolean>> };
  let reconciled$: Subject<void>;
  let offlineStorageSpy: jasmine.SpyObj<AttendanceOfflineStorageService>;
  let lowAttendanceAlertsSpy: jasmine.SpyObj<LowAttendanceAlertsService>;
  let store: AttendanceStore;

  const key = { courseOfferingId: 'off-1', sessionDate: '2026-09-18' };
  const alice: RosterStudent = { enrollmentId: 'e-alice', studentId: 's-alice', name: 'Alice' };
  const bob: RosterStudent = { enrollmentId: 'e-bob', studentId: 's-bob', name: 'Bob' };

  function sessionDto(overrides: Partial<AttendanceSessionDto> = {}): AttendanceSessionDto {
    return {
      id: 'sess-1',
      courseOfferingId: 'off-1',
      sessionDate: '2026-09-18',
      correctionWindowClose: '2026-09-20T00:00:00Z',
      records: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    academicApiSpy = jasmine.createSpyObj('AcademicApi', ['markAttendance']);
    connectivityStub = { isOnline: signal(true) };
    reconciled$ = new Subject<void>();
    offlineStorageSpy = jasmine.createSpyObj('AttendanceOfflineStorageService', [
      'save',
      'load',
      'clear',
    ]);
    offlineStorageSpy.load.and.returnValue(null);
    lowAttendanceAlertsSpy = jasmine.createSpyObj('LowAttendanceAlertsService', ['setCount']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AcademicApi, useValue: academicApiSpy },
        { provide: ConnectivityService, useValue: connectivityStub },
        { provide: ConnectivityReconciliationService, useValue: { reconciled$ } },
        { provide: AttendanceOfflineStorageService, useValue: offlineStorageSpy },
        { provide: LowAttendanceAlertsService, useValue: lowAttendanceAlertsSpy },
      ],
    });
    store = TestBed.inject(AttendanceStore);
  });

  it('openSession rehydrates persisted state when present, otherwise starts empty', () => {
    store.openSession(key);
    expect(store.roster()).toEqual([]);
    expect(offlineStorageSpy.load).toHaveBeenCalledWith(key);
  });

  it('loadRoster inserts new students as Unmarked and persists', () => {
    store.openSession(key);
    store.loadRoster([alice, bob]);

    expect(store.roster().length).toBe(2);
    expect(store.roster()[0].mark.status).toBe('Unmarked');
    expect(offlineStorageSpy.save).toHaveBeenCalled();
  });

  it('markAllPresent sets every current roster member Present and dispatches sync for each', () => {
    academicApiSpy.markAttendance.and.returnValue(of(sessionDto()));
    store.openSession(key);
    store.loadRoster([alice, bob]);

    store.markAllPresent();

    expect(store.tally().present).toBe(2);
    expect(academicApiSpy.markAttendance).toHaveBeenCalledTimes(2);
  });

  it('mark() dispatches an online POST and, on success, clears the pending state as synced', () => {
    academicApiSpy.markAttendance.and.returnValue(
      of(
        sessionDto({
          records: [
            {
              enrollmentId: 'e-alice',
              status: 'Present',
              markedByFacultyMemberId: 'fac-1',
              markedAt: 't',
            },
          ],
        }),
      ),
    );
    store.openSession(key);
    store.loadRoster([alice]);

    store.mark('e-alice', 'Present');

    const row = store.roster().find((r) => r.enrollmentId === 'e-alice');
    expect(row?.mark.status).toBe('Present');
    expect(row?.mark.syncState).toBe('synced');
  });

  it('mark() surfaces a sync failure via the failed sync state', () => {
    academicApiSpy.markAttendance.and.returnValue(throwError(() => new Error('network down')));
    store.openSession(key);
    store.loadRoster([alice]);

    store.mark('e-alice', 'Absent');

    const row = store.roster().find((r) => r.enrollmentId === 'e-alice');
    expect(row?.mark.syncState).toBe('failed');
  });

  it('mark() while offline queues the mark instead of calling the API', () => {
    connectivityStub.isOnline.set(false);
    store.openSession(key);
    store.loadRoster([alice]);

    store.mark('e-alice', 'Late');

    expect(academicApiSpy.markAttendance).not.toHaveBeenCalled();
    const row = store.roster().find((r) => r.enrollmentId === 'e-alice');
    expect(row?.mark.syncState).toBe('queued-offline');
  });

  it('flushes pending marks automatically when connectivity is reconciled (reconnect)', () => {
    connectivityStub.isOnline.set(false);
    store.openSession(key);
    store.loadRoster([alice]);
    store.mark('e-alice', 'Present');
    expect(academicApiSpy.markAttendance).not.toHaveBeenCalled();

    connectivityStub.isOnline.set(true);
    academicApiSpy.markAttendance.and.returnValue(of(sessionDto()));
    reconciled$.next();

    expect(academicApiSpy.markAttendance).toHaveBeenCalled();
  });

  it('reports a low-attendance alert count derived from accumulated session history', () => {
    store.openSession(key);
    store.loadRoster([alice]);
    store.setLowAttendanceThreshold(75);

    // Simulate several sessions marking Alice Absent, accumulated via successful mark responses.
    academicApiSpy.markAttendance.and.returnValues(
      of(
        sessionDto({
          sessionDate: '2026-09-01',
          records: [
            {
              enrollmentId: 'e-alice',
              status: 'Absent',
              markedByFacultyMemberId: 'f',
              markedAt: 't',
            },
          ],
        }),
      ),
      of(
        sessionDto({
          sessionDate: '2026-09-08',
          records: [
            {
              enrollmentId: 'e-alice',
              status: 'Absent',
              markedByFacultyMemberId: 'f',
              markedAt: 't',
            },
          ],
        }),
      ),
    );
    store.mark('e-alice', 'Absent');
    store.mark('e-alice', 'Absent');

    expect(lowAttendanceAlertsSpy.setCount).toHaveBeenCalledWith(1);
  });

  it('the manual-refresh seam applies a response only when its dispatch sequence is not stale', () => {
    store.openSession(key);
    store.loadRoster([alice]);

    const staleSeq = store.dispatchManualRefresh();
    const freshSeq = store.dispatchManualRefresh();

    // The fresher-dispatched read's response arrives and is applied first.
    store.handleManualRefreshResponse(
      sessionDto({
        records: [
          {
            enrollmentId: 'e-alice',
            status: 'Present',
            markedByFacultyMemberId: 'f',
            markedAt: 't2',
          },
        ],
      }),
      freshSeq,
    );
    expect(store.roster()[0].mark.status).toBe('Present');

    // The stale, earlier-dispatched read resolves after -- must NOT overwrite the fresher value.
    store.handleManualRefreshResponse(
      sessionDto({
        records: [
          {
            enrollmentId: 'e-alice',
            status: 'Absent',
            markedByFacultyMemberId: 'f',
            markedAt: 't1',
          },
        ],
      }),
      staleSeq,
    );
    expect(store.roster()[0].mark.status).toBe('Present');
  });

  it('acknowledgeUpdatedElsewhere clears one enrollmentId from the notice list', () => {
    store.openSession(key);
    store.loadRoster([alice]);
    // Seed a synced explicit value first, then merge a genuinely different value from elsewhere.
    academicApiSpy.markAttendance.and.returnValue(
      of(
        sessionDto({
          records: [
            {
              enrollmentId: 'e-alice',
              status: 'Present',
              markedByFacultyMemberId: 'f',
              markedAt: 't',
            },
          ],
        }),
      ),
    );
    store.mark('e-alice', 'Present');

    const seq = store.dispatchManualRefresh();
    store.handleManualRefreshResponse(
      sessionDto({
        records: [
          {
            enrollmentId: 'e-alice',
            status: 'Absent',
            markedByFacultyMemberId: 'f2',
            markedAt: 't2',
          },
        ],
      }),
      seq,
    );
    expect(store.updatedElsewhere()).toEqual(['e-alice']);

    store.acknowledgeUpdatedElsewhere('e-alice');
    expect(store.updatedElsewhere()).toEqual([]);
  });

  it('mark()/markAllPresent() are no-ops when no session has been opened yet', () => {
    expect(() => store.mark('e-alice', 'Present')).not.toThrow();
    expect(academicApiSpy.markAttendance).not.toHaveBeenCalled();
  });

  it('studentHistory reflects accumulated session snapshots for one student', () => {
    store.openSession(key);
    store.loadRoster([alice]);
    academicApiSpy.markAttendance.and.returnValue(
      of(
        sessionDto({
          sessionDate: '2026-09-18',
          records: [
            {
              enrollmentId: 'e-alice',
              status: 'Present',
              markedByFacultyMemberId: 'f',
              markedAt: 't',
            },
          ],
        }),
      ),
    );
    store.mark('e-alice', 'Present');

    const history = store.studentHistory('e-alice');
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('Present');
  });
});

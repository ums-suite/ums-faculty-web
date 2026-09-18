import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AcademicApi } from '../../core/api/academic.api';
import { FacultyApi } from '../../core/api/faculty.api';
import { FacultyIdentityService } from '../../core/auth/faculty-identity.service';
import { GlobalStore } from '../../core/state/global.store';
import { LowAttendanceAlertsService } from '../../core/state/low-attendance-alerts.service';
import { DashboardStore } from './dashboard.store';

describe('DashboardStore', () => {
  let academicApiSpy: jasmine.SpyObj<AcademicApi>;
  let facultyApiSpy: jasmine.SpyObj<FacultyApi>;
  let facultyIdentityStub: { facultyMemberId: () => string | null };
  let lowAttendanceAlertsStub: { count: ReturnType<typeof signal<number>> };
  let globalStoreStub: { isDepartmentHead: () => boolean };
  let store: DashboardStore;

  const offering = {
    id: 'off-1',
    courseId: 'course-1',
    semesterId: 'sem-1',
    departmentId: 'dept-1',
    capacity: 40,
    enrolledCount: 30,
    hasAvailableSeats: true,
    instructorFacultyMemberId: 'fac-1',
    sections: [{ id: 'sec-1', code: 'A', dayOfWeek: 1, start: '09:00:00', end: '10:00:00' }],
    exams: [],
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    academicApiSpy = jasmine.createSpyObj('AcademicApi', ['getCourseOffering']);
    facultyApiSpy = jasmine.createSpyObj('FacultyApi', ['listCourseAssignments']);
    facultyIdentityStub = { facultyMemberId: () => 'fac-1' };
    lowAttendanceAlertsStub = { count: signal(0) };
    globalStoreStub = { isDepartmentHead: () => false };

    TestBed.configureTestingModule({
      providers: [
        { provide: AcademicApi, useValue: academicApiSpy },
        { provide: FacultyApi, useValue: facultyApiSpy },
        { provide: FacultyIdentityService, useValue: facultyIdentityStub },
        { provide: LowAttendanceAlertsService, useValue: lowAttendanceAlertsStub },
        { provide: GlobalStore, useValue: globalStoreStub },
      ],
    });
    store = TestBed.inject(DashboardStore);
  });

  it('loads assigned course offerings via Faculty projection then Academic detail calls', () => {
    facultyApiSpy.listCourseAssignments.and.returnValue(
      of([
        {
          id: 'ca-1',
          facultyMemberId: 'fac-1',
          courseOfferingId: 'off-1',
          departmentId: 'dept-1',
          assignedAt: '2026-01-01T00:00:00Z',
        },
      ]),
    );
    academicApiSpy.getCourseOffering.and.returnValue(of(offering));

    store.refresh();

    expect(facultyApiSpy.listCourseAssignments).toHaveBeenCalledWith('fac-1');
    expect(academicApiSpy.getCourseOffering).toHaveBeenCalledWith('off-1');
    expect(store.offerings()).toEqual([offering]);
    expect(store.isLoading()).toBe(false);
    expect(store.teachingLoad().studentsCount).toBe(30);
  });

  it('handles zero assignments without calling Academic at all', () => {
    facultyApiSpy.listCourseAssignments.and.returnValue(of([]));

    store.refresh();

    expect(academicApiSpy.getCourseOffering).not.toHaveBeenCalled();
    expect(store.offerings()).toEqual([]);
  });

  it('sets an error and stops loading when the assignment fetch fails', () => {
    facultyApiSpy.listCourseAssignments.and.returnValue(throwError(() => new Error('boom')));

    store.refresh();

    expect(store.error()).toBe('dashboard.error');
    expect(store.isLoading()).toBe(false);
  });

  it('sets an error immediately when facultyMemberId is not yet resolved', () => {
    facultyIdentityStub.facultyMemberId = () => null;
    store.refresh();
    expect(store.error()).toBe('dashboard.error');
    expect(facultyApiSpy.listCourseAssignments).not.toHaveBeenCalled();
  });

  it('surfaces a lowAttendance pending action once the alerts service reports a count', () => {
    lowAttendanceAlertsStub.count.set(3);
    const actions = store.pendingActions();
    expect(actions.length).toBe(1);
    expect(actions[0].kind).toBe('lowAttendance');
    expect(actions[0].params?.['count']).toBe(3);
  });

  it('reports no pending actions when nothing is flagged', () => {
    expect(store.pendingActions()).toEqual([]);
  });

  it('isDepartmentHead reflects GlobalStore', () => {
    globalStoreStub.isDepartmentHead = () => true;
    expect(store.isDepartmentHead()).toBe(true);
  });
});

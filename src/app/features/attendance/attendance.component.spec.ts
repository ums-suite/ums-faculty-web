import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AcademicApi } from '../../core/api/academic.api';
import type { CourseOfferingDto } from '../../core/api/academic.types';
import { AttendanceComponent } from './attendance.component';
import { AttendanceStore } from './attendance.store';
import type { AttendanceRosterRow, AttendanceTally } from './attendance.types';

describe('AttendanceComponent', () => {
  let fixture: ComponentFixture<AttendanceComponent>;
  let academicApiSpy: jasmine.SpyObj<AcademicApi>;
  let storeStub: {
    isOffline: ReturnType<typeof signal<boolean>>;
    tally: ReturnType<typeof signal<AttendanceTally>>;
    roster: ReturnType<typeof signal<readonly AttendanceRosterRow[]>>;
    stats: ReturnType<typeof signal<readonly unknown[]>>;
    openSession: jasmine.Spy;
    mark: jasmine.Spy;
    markAllPresent: jasmine.Spy;
    acknowledgeUpdatedElsewhere: jasmine.Spy;
    studentHistory: jasmine.Spy;
  };

  beforeEach(() => {
    const offering: CourseOfferingDto = {
      id: 'off-1',
      courseId: 'course-1',
      semesterId: 'sem-1',
      departmentId: 'dept-1',
      capacity: 40,
      enrolledCount: 0,
      hasAvailableSeats: true,
      instructorFacultyMemberId: 'fac-1',
      sections: [],
      exams: [],
      createdAt: '2026-01-01T00:00:00Z',
    };
    academicApiSpy = jasmine.createSpyObj('AcademicApi', ['getCourseOffering']);
    academicApiSpy.getCourseOffering.and.returnValue(of(offering));
    storeStub = {
      isOffline: signal(false),
      tally: signal({ present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 }),
      roster: signal([]),
      stats: signal([]),
      openSession: jasmine.createSpy('openSession'),
      mark: jasmine.createSpy('mark'),
      markAllPresent: jasmine.createSpy('markAllPresent'),
      acknowledgeUpdatedElsewhere: jasmine.createSpy('acknowledgeUpdatedElsewhere'),
      studentHistory: jasmine.createSpy('studentHistory').and.returnValue([]),
    };

    TestBed.configureTestingModule({
      imports: [AttendanceComponent],
      providers: [
        { provide: AcademicApi, useValue: academicApiSpy },
        { provide: AttendanceStore, useValue: storeStub },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({ courseOfferingId: 'off-1' }) },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(AttendanceComponent);
  });

  it('opens a session for the course offering from the query param, defaulting to today', () => {
    fixture.detectChanges();
    expect(storeStub.openSession).toHaveBeenCalledWith(
      jasmine.objectContaining({ courseOfferingId: 'off-1' }),
    );
    expect(academicApiSpy.getCourseOffering).toHaveBeenCalledWith('off-1');
  });

  it('renders the roster-unavailable empty state when the roster is empty (confirmed gap)', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Roster unavailable');
  });

  it('renders the roster component once rows are present', () => {
    storeStub.roster.set([
      {
        enrollmentId: 'e-1',
        studentId: 's-1',
        name: 'Alice',
        mark: { status: 'Unmarked', explicitlySet: false, syncState: 'synced' },
      },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-attendance-roster')).not.toBeNull();
  });

  it('markAllPresent button delegates to the store', () => {
    fixture.detectChanges();
    const button: HTMLElement = fixture.nativeElement.querySelectorAll('ums-button')[0];
    button.click();
    expect(storeStub.markAllPresent).toHaveBeenCalled();
  });

  it('toggling stats shows the stats component', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-attendance-stats')).toBeNull();

    const statsButton: HTMLElement = fixture.nativeElement.querySelectorAll('ums-button')[1];
    statsButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-attendance-stats')).not.toBeNull();
  });

  it('shows the offline banner when the store reports offline', () => {
    storeStub.isOffline.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ums-offline-banner')).not.toBeNull();
  });

  it('does nothing when there is no courseOfferingId query param', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AttendanceComponent],
      providers: [
        { provide: AcademicApi, useValue: academicApiSpy },
        { provide: AttendanceStore, useValue: storeStub },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    });
    const freshFixture = TestBed.createComponent(AttendanceComponent);
    freshFixture.detectChanges();
    expect(storeStub.openSession).not.toHaveBeenCalled();
  });
});

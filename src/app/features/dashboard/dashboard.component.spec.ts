import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { DashboardStore } from './dashboard.store';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let storeStub: {
    isLoading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    nextClass: ReturnType<typeof signal<unknown>>;
    teachingLoad: ReturnType<
      typeof signal<{
        sectionsCount: number;
        studentsCount: number;
        attendanceCompletionPercent: number | null;
      }>
    >;
    semesterSummary: ReturnType<
      typeof signal<{
        sectionsCount: number;
        studentsCount: number;
        attendanceCompletionPercent: number | null;
      }>
    >;
    pendingActions: ReturnType<typeof signal<unknown[]>>;
    isDepartmentHead: ReturnType<typeof signal<boolean>>;
    refresh: jasmine.Spy;
  };
  let router: Router;

  beforeEach(() => {
    storeStub = {
      isLoading: signal(false),
      error: signal<string | null>(null),
      nextClass: signal<unknown>(null),
      teachingLoad: signal({
        sectionsCount: 2,
        studentsCount: 50,
        attendanceCompletionPercent: null,
      }),
      semesterSummary: signal({
        sectionsCount: 2,
        studentsCount: 50,
        attendanceCompletionPercent: null,
      }),
      pendingActions: signal([]),
      isDepartmentHead: signal(false),
      refresh: jasmine.createSpy('refresh'),
    };

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), { provide: DashboardStore, useValue: storeStub }],
    });
    fixture = TestBed.createComponent(DashboardComponent);
    router = TestBed.inject(Router);
  });

  it('calls refresh on init', () => {
    fixture.detectChanges();
    expect(storeStub.refresh).toHaveBeenCalled();
  });

  it('renders the empty-classes state when there is no next class', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No more classes today.');
  });

  it('navigates to attendance with the course offering id when starting attendance', () => {
    storeStub.nextClass.set({
      courseOfferingId: 'off-1',
      sectionId: 'sec-1',
      sectionCode: 'A',
      dayOfWeek: 1,
      start: '09:00:00',
      end: '10:00:00',
      minutesUntilStart: 15,
      inProgress: false,
    });
    fixture.detectChanges();
    const navigateSpy = spyOn(router, 'navigate');

    (fixture.componentInstance as unknown as { startAttendance: () => void }).startAttendance();

    expect(navigateSpy).toHaveBeenCalledWith(['/attendance'], {
      queryParams: { courseOfferingId: 'off-1' },
    });
  });

  it('renders pending actions when present', () => {
    storeStub.pendingActions.set([
      {
        kind: 'lowAttendance',
        translationKey: 'dashboard.pendingActions.lowAttendance',
        params: { count: 2 },
      },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('below the attendance threshold');
  });
});

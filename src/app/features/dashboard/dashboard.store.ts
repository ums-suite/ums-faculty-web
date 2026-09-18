import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of, switchMap } from 'rxjs';
import { AcademicApi } from '../../core/api/academic.api';
import type { CourseOfferingDto } from '../../core/api/academic.types';
import { FacultyApi } from '../../core/api/faculty.api';
import { FacultyIdentityService } from '../../core/auth/faculty-identity.service';
import { GlobalStore } from '../../core/state/global.store';
import { LowAttendanceAlertsService } from '../../core/state/low-attendance-alerts.service';
import { computeNextClass, computeTeachingLoadSummary } from './dashboard.logic';
import type { NextClassInfo, PendingAction, TeachingLoadSummary } from './dashboard.types';

/**
 * Dashboard store (FWEB-9, requirement-spec.md §3.1/§7). An agenda-first read model built from:
 * - `FacultyApi.listCourseAssignments` (Faculty's own eventually-consistent teaching-load
 *   projection, `faculty.types.ts`'s `CourseAssignmentDto` doc) for "which CourseOfferings am I
 *   assigned to", then
 * - `AcademicApi.getCourseOffering` per assignment for section schedule/enrollment counts.
 *
 * Per design-decisions.md "CourseAssignment Freshness UX": no poll loop -- {@link refresh} is
 * called once on Dashboard mount and is also the manual "refresh" affordance's own action, exactly
 * the resolved shape for this app's low-frequency, non-contended teaching-assignment data.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly academicApi = inject(AcademicApi);
  private readonly facultyApi = inject(FacultyApi);
  private readonly facultyIdentity = inject(FacultyIdentityService);
  private readonly lowAttendanceAlerts = inject(LowAttendanceAlertsService);
  private readonly globalStore = inject(GlobalStore);

  private readonly offeringsState = signal<readonly CourseOfferingDto[]>([]);
  private readonly isLoadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly offerings = this.offeringsState.asReadonly();
  readonly isLoading = this.isLoadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly isDepartmentHead = computed(() => this.globalStore.isDepartmentHead());

  readonly nextClass = computed<NextClassInfo | null>(() =>
    computeNextClass(this.offeringsState(), new Date()),
  );

  readonly teachingLoad = computed<TeachingLoadSummary>(() =>
    computeTeachingLoadSummary(this.offeringsState()),
  );

  /** Same numbers as {@link teachingLoad} -- Department Heads read this as "semester at a glance" alongside their own review duties (§3.1), no separate department-wide query. */
  readonly semesterSummary = this.teachingLoad;

  readonly pendingActions = computed<PendingAction[]>(() => {
    const actions: PendingAction[] = [];
    const lowAttendanceCount = this.lowAttendanceAlerts.count();
    if (lowAttendanceCount > 0) {
      actions.push({
        kind: 'lowAttendance',
        translationKey: 'dashboard.pendingActions.lowAttendance',
        params: { count: lowAttendanceCount },
      });
    }
    // Grades-due and leave-decision rows wire in once FWEB-17/FWEB-25 land (out of this pass's
    // scope) -- deliberately absent rather than fabricated, matching FWEB-9's own "empty/stubbed
    // until their owning features land later" instruction.
    return actions;
  });

  /** Manual refresh affordance + on-mount background refresh (design-decisions.md "CourseAssignment Freshness UX"). */
  refresh(): void {
    const facultyMemberId = this.facultyIdentity.facultyMemberId();
    if (!facultyMemberId) {
      this.errorState.set('dashboard.error');
      return;
    }

    this.isLoadingState.set(true);
    this.errorState.set(null);

    this.facultyApi
      .listCourseAssignments(facultyMemberId)
      .pipe(
        switchMap((assignments) =>
          assignments.length
            ? forkJoin(
                assignments.map((assignment) =>
                  this.academicApi.getCourseOffering(assignment.courseOfferingId),
                ),
              )
            : of([]),
        ),
      )
      .subscribe({
        next: (offerings) => {
          this.offeringsState.set(offerings);
          this.isLoadingState.set(false);
        },
        error: () => {
          this.errorState.set('dashboard.error');
          this.isLoadingState.set(false);
        },
      });
  }
}

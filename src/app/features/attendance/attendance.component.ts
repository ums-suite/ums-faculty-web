import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsEmptyStateComponent,
  UmsOfflineBannerComponent,
} from '@ums/design-system';
import { AcademicApi } from '../../core/api/academic.api';
import type { AttendanceStatusCode, CourseOfferingDto } from '../../core/api/academic.types';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { formatDateOnly } from './attendance-date.util';
import { AttendanceHistoryComponent } from './attendance-history.component';
import { AttendanceRosterComponent } from './attendance-roster.component';
import { AttendanceStatsComponent } from './attendance-stats.component';
import { AttendanceStore } from './attendance.store';

/**
 * Attendance page (FWEB-10): session creation/open tied to one CourseOffering, plus every FWEB-11
 * through FWEB-16 sub-feature composed together. `courseOfferingId` arrives as a query param
 * (Dashboard's "start attendance" action, `dashboard.component.ts`); `sessionDate` defaults to
 * today (§3.2 -- a session is "tied to one CourseOffering/Section meeting", one per calendar day
 * in this app's own model).
 *
 * **Roster loading is a confirmed, flagged backend gap** (`attendance.store.ts`'s own class doc):
 * there is no `ums-core` endpoint to list a CourseOffering's enrolled students, so this component
 * cannot itself populate a real roster today. It still calls `AcademicApi.getCourseOffering` for
 * course context and renders an honest "roster unavailable" state instead of fabricating student
 * data -- `AttendanceStore.loadRoster()` remains the single, already-correct integration seam a
 * real roster source plugs into once one exists.
 */
@Component({
  selector: 'app-attendance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsEmptyStateComponent,
    UmsOfflineBannerComponent,
    AttendanceHistoryComponent,
    AttendanceRosterComponent,
    AttendanceStatsComponent,
    TranslatePipe,
  ],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly academicApi = inject(AcademicApi);
  protected readonly store = inject(AttendanceStore);

  protected readonly courseOffering = signal<CourseOfferingDto | null>(null);
  protected readonly showStats = signal(false);
  private readonly historyOpenFor = signal<string | null>(null);

  protected readonly isHistoryOpen = computed(() => this.historyOpenFor() !== null);

  protected readonly historyStudentName = computed(() => {
    const id = this.historyOpenFor();
    return id ? (this.store.roster().find((r) => r.enrollmentId === id)?.name ?? '') : '';
  });

  protected readonly historyEntries = computed(() => {
    const id = this.historyOpenFor();
    return id ? this.store.studentHistory(id) : [];
  });

  ngOnInit(): void {
    const courseOfferingId = this.route.snapshot.queryParamMap.get('courseOfferingId');
    if (!courseOfferingId) {
      return;
    }

    this.store.openSession({ courseOfferingId, sessionDate: formatDateOnly(new Date()) });
    this.academicApi
      .getCourseOffering(courseOfferingId)
      .subscribe((offering) => this.courseOffering.set(offering));
  }

  protected onMarkChange(event: { enrollmentId: string; status: AttendanceStatusCode }): void {
    this.store.mark(event.enrollmentId, event.status);
  }

  protected onOpenHistory(enrollmentId: string): void {
    this.historyOpenFor.set(enrollmentId);
  }

  protected onCloseHistory(): void {
    this.historyOpenFor.set(null);
  }

  protected onAcknowledgeUpdated(enrollmentId: string): void {
    this.store.acknowledgeUpdatedElsewhere(enrollmentId);
  }

  protected markAllPresent(): void {
    this.store.markAllPresent();
  }

  protected toggleStats(): void {
    this.showStats.update((v) => !v);
  }
}

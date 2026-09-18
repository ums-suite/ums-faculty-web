import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsCardComponent,
  UmsEmptyStateComponent,
  UmsSkeletonComponent,
} from '@ums/design-system';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { DashboardStore } from './dashboard.store';

/**
 * Dashboard (FWEB-9). Agenda-first layout per requirement-spec.md §7: a "next class in X
 * minutes" card pinned at the top with a one-tap "start attendance" action, a compact
 * teaching-load summary strip, a pending-actions list, and (Department Heads only) a
 * semester-at-a-glance summary -- "nothing decorative above the fold."
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsCardComponent,
    UmsEmptyStateComponent,
    UmsSkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  protected readonly store = inject(DashboardStore);
  private readonly router = inject(Router);

  protected readonly nextClassMinutesLabel = computed(() => {
    const next = this.store.nextClass();
    if (!next) {
      return null;
    }
    return next.inProgress ? null : Math.max(0, Math.round(next.minutesUntilStart));
  });

  ngOnInit(): void {
    // On-mount background refresh (design-decisions.md "CourseAssignment Freshness UX") -- no
    // dedicated poll loop, this plus the manual refresh button below is the full mechanism.
    this.store.refresh();
  }

  protected startAttendance(): void {
    const next = this.store.nextClass();
    if (!next) {
      return;
    }
    void this.router.navigate(['/attendance'], {
      queryParams: { courseOfferingId: next.courseOfferingId },
    });
  }

  protected refresh(): void {
    this.store.refresh();
  }
}

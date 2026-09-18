import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UmsBadgeComponent, UmsModalComponent } from '@ums/design-system';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { StudentSessionHistoryEntry } from './attendance-stats.util';

/**
 * Quick per-student attendance history for this course, reachable in one tap from the roster
 * (FWEB-16, §3.2: "for a faculty member fielding an in-the-moment 'am I in trouble' question").
 *
 * Reflects `AttendanceStore`'s own accumulated session log -- see `attendance-stats.util.ts`'s
 * class doc for the confirmed backend gap (no list-sessions endpoint) this data source honestly
 * works within: history here means "every session this device has observed," not necessarily
 * the student's full-course record, until a real endpoint ships.
 */
@Component({
  selector: 'app-attendance-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UmsBadgeComponent, UmsModalComponent, TranslatePipe],
  templateUrl: './attendance-history.component.html',
  styleUrl: './attendance-history.component.scss',
})
export class AttendanceHistoryComponent {
  readonly studentName = input.required<string>();
  readonly entries = input.required<readonly StudentSessionHistoryEntry[]>();
  readonly open = input<boolean>(false);
  readonly closed = output();

  protected badgeVariant(status: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'Present':
        return 'success';
      case 'Absent':
        return 'danger';
      case 'Late':
        return 'warning';
      case 'Excused':
        return 'info';
      default:
        return 'neutral';
    }
  }
}

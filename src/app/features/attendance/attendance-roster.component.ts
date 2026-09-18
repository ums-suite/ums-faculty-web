import { ChangeDetectionStrategy, Component, output, input } from '@angular/core';
import { UmsAvatarComponent, UmsBadgeComponent, UmsIconButtonComponent } from '@ums/design-system';
import type { AttendanceStatusCode } from '../../core/api/academic.types';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { AttendanceRosterRow, MarkStatus, SyncState } from './attendance.types';

const KEY_TO_STATUS: Readonly<Record<string, AttendanceStatusCode>> = {
  p: 'Present',
  a: 'Absent',
  l: 'Late',
  e: 'Excused',
};

const BADGE_VARIANT_BY_STATUS: Readonly<
  Record<MarkStatus, 'success' | 'danger' | 'warning' | 'info' | 'neutral'>
> = {
  Present: 'success',
  Absent: 'danger',
  Late: 'warning',
  Excused: 'info',
  Unmarked: 'neutral',
};

/**
 * The roster (FWEB-10/FWEB-11/FWEB-13), this app's centerpiece screen. One row per student
 * (photo, name, ID), each a four-state P/A/L/E control operable by tap, click, OR a single
 * keyboard press while the row has focus -- arrow keys move between rows (§7 Attendance marking
 * key screen, §4 Accessibility (keyboard) row: "every attendance/grade-entry interaction
 * achievable via keyboard alone").
 *
 * Keyboard handling is real, not decorative: `(keydown)` is bound to each row's own host element
 * (a focusable `role="row"` div), reads the pressed key directly (case-insensitive P/A/L/E), and
 * moves focus to the previous/next row's DOM element on ArrowUp/ArrowDown -- no dependency on
 * `@angular/cdk`'s a11y module, keeping this simple enough to unit-test with plain
 * `KeyboardEvent`/`HTMLElement.focus()` assertions.
 */
@Component({
  selector: 'app-attendance-roster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UmsAvatarComponent, UmsBadgeComponent, UmsIconButtonComponent, TranslatePipe],
  templateUrl: './attendance-roster.component.html',
  styleUrl: './attendance-roster.component.scss',
})
export class AttendanceRosterComponent {
  readonly rows = input.required<readonly AttendanceRosterRow[]>();

  readonly markChange = output<{ enrollmentId: string; status: AttendanceStatusCode }>();
  readonly openHistory = output<string>();
  readonly acknowledgeUpdated = output<string>();

  protected readonly statuses: readonly AttendanceStatusCode[] = [
    'Present',
    'Absent',
    'Late',
    'Excused',
  ];

  protected badgeVariant(
    status: MarkStatus,
  ): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
    return BADGE_VARIANT_BY_STATUS[status];
  }

  protected syncIndicatorKey(syncState: SyncState): string {
    switch (syncState) {
      case 'syncing':
        return 'attendance.sync.syncing';
      case 'queued-offline':
        return 'attendance.sync.queued';
      case 'failed':
        return 'attendance.sync.failed';
      default:
        return 'attendance.sync.synced';
    }
  }

  protected onMark(enrollmentId: string, status: AttendanceStatusCode): void {
    this.markChange.emit({ enrollmentId, status });
  }

  /** Real keyboard handling -- see class doc. Bound to each row's own `(keydown)`. */
  protected onRowKeyDown(event: KeyboardEvent, enrollmentId: string): void {
    const key = event.key.toLowerCase();
    const status = KEY_TO_STATUS[key];
    if (status) {
      event.preventDefault();
      this.onMark(enrollmentId, status);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const current = event.currentTarget as HTMLElement;
      const next =
        event.key === 'ArrowDown'
          ? (current.nextElementSibling as HTMLElement | null)
          : (current.previousElementSibling as HTMLElement | null);
      next?.focus();
    }
  }
}

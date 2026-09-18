import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  UmsButtonComponent,
  UmsDataTableComponent,
  type DataTableColumn,
} from '@ums/design-system';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { buildStatsCsv, type StudentAttendanceStat } from './attendance-stats.util';
import type { AttendanceRosterRow } from './attendance.types';

interface StatsRow extends StudentAttendanceStat {
  readonly name: string;
}

/**
 * Per-course/per-student attendance statistics + export (FWEB-14). Every render/export is stamped
 * with a visible "as of [timestamp]" marker (design-decisions.md "Point-in-Time Snapshot for
 * Attendance Statistics/Export") -- a point-in-time artifact is accepted as-is rather than
 * synchronized against concurrent corrections, with the timestamp making that explicit.
 *
 * CSV export is real and fully client-side. **PDF export is a confirmed, flagged gap**: this
 * platform's PDF generation is normally a Documents-module server-side concern
 * (requirement-spec.md §6), and no Documents/Academic endpoint for an attendance-sheet PDF was
 * found in `ums-core` as of this pass -- the button is disabled with an explanatory message rather
 * than faking a client-side PDF that would misrepresent this app's actual audit/export guarantees.
 */
@Component({
  selector: 'app-attendance-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UmsButtonComponent, UmsDataTableComponent, TranslatePipe],
  templateUrl: './attendance-stats.component.html',
  styleUrl: './attendance-stats.component.scss',
})
export class AttendanceStatsComponent {
  private readonly translation = inject(TranslationService);

  readonly stats = input.required<readonly StudentAttendanceStat[]>();
  readonly roster = input.required<readonly AttendanceRosterRow[]>();

  protected readonly asOf = computed(() => new Date().toISOString());

  protected readonly columns: readonly DataTableColumn<StatsRow>[] = [
    { id: 'name', header: 'Student', accessor: (r) => r.name },
    { id: 'present', header: 'Present', accessor: (r) => r.presentCount, numeric: true },
    { id: 'absent', header: 'Absent', accessor: (r) => r.absentCount, numeric: true },
    { id: 'late', header: 'Late', accessor: (r) => r.lateCount, numeric: true },
    { id: 'excused', header: 'Excused', accessor: (r) => r.excusedCount, numeric: true },
    {
      id: 'percent',
      header: 'Attendance %',
      numeric: true,
      accessor: (r) => r.attendancePercent,
      formatter: (r) => (r.attendancePercent === null ? '—' : `${r.attendancePercent}%`),
    },
  ];

  protected readonly namesByEnrollmentId = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const row of this.roster()) {
      map[row.enrollmentId] = row.name;
    }
    return map;
  });

  protected readonly tableRows = computed<readonly StatsRow[]>(() =>
    this.stats().map((stat) => ({
      ...stat,
      name: this.namesByEnrollmentId()[stat.enrollmentId] ?? stat.enrollmentId,
    })),
  );

  protected readonly rowId = (row: StatsRow): string => row.enrollmentId;

  protected exportCsv(): void {
    const csv = buildStatsCsv(this.stats(), this.namesByEnrollmentId(), this.asOf());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-stats-${this.asOf()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected get asOfLabel(): string {
    return this.translation.t('attendance.stats.asOf', { time: this.asOf() });
  }
}

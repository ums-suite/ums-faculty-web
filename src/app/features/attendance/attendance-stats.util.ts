import type { AttendanceSessionDto } from '../../core/api/academic.types';
import type { MarkStatus } from './attendance.types';

/**
 * Per-student stats/history/low-attendance computation (FWEB-14/FWEB-15/FWEB-16).
 *
 * **Confirmed backend gap, honestly scoped**: `ums-core`'s Academic module exposes no
 * list-sessions-by-CourseOffering or attendance-statistics endpoint (verified against
 * `AttendanceEndpoints.cs`, which maps only `POST /attendance` -- see `academic.types.ts`'s
 * `AttendanceSessionDto` doc). There is therefore no way to compute a student's TRUE full-course
 * attendance history/percentage from the backend today. This module computes stats/history from
 * whatever session snapshots `AttendanceStore` has itself observed during the current app usage
 * (every `markAttendance` response returns the full session, so a running client-side log
 * accumulates real data one session at a time) -- correct and real for what it covers, but a
 * partial view, not the authoritative full-course record, until a real list/stats endpoint ships.
 * Every consuming view surfaces this honestly (an "as of" timestamp per design-decisions.md's
 * point-in-time-snapshot decision, FWEB-14) rather than presenting it as complete history.
 */

export interface StudentAttendanceStat {
  readonly enrollmentId: string;
  readonly presentCount: number;
  readonly absentCount: number;
  readonly lateCount: number;
  readonly excusedCount: number;
  readonly totalSessions: number;
  /** Present+Late counted as "attended" for the percentage, matching the common institutional convention; `null` when no sessions are recorded yet. */
  readonly attendancePercent: number | null;
}

export interface StudentSessionHistoryEntry {
  readonly sessionDate: string;
  readonly status: MarkStatus;
  readonly markedByFacultyMemberId?: string;
  readonly markedAt?: string;
}

/** Builds per-student stats from every session snapshot seen so far, keyed by session date. */
export function computeStudentStats(
  sessionLog: Readonly<Record<string, AttendanceSessionDto>>,
  enrollmentIds: readonly string[],
): readonly StudentAttendanceStat[] {
  return enrollmentIds.map((enrollmentId) => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let total = 0;

    for (const session of Object.values(sessionLog)) {
      const record = session.records.find((r) => r.enrollmentId === enrollmentId);
      if (!record) {
        continue;
      }
      total += 1;
      switch (record.status) {
        case 'Present':
          present += 1;
          break;
        case 'Absent':
          absent += 1;
          break;
        case 'Late':
          late += 1;
          break;
        case 'Excused':
          excused += 1;
          break;
        default:
          break;
      }
    }

    return {
      enrollmentId,
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      excusedCount: excused,
      totalSessions: total,
      attendancePercent: total === 0 ? null : Math.round(((present + late) / total) * 100),
    };
  });
}

/** Per-student session history for one course, newest first (FWEB-16's "quick history" view). */
export function computeStudentHistory(
  sessionLog: Readonly<Record<string, AttendanceSessionDto>>,
  enrollmentId: string,
): readonly StudentSessionHistoryEntry[] {
  return Object.values(sessionLog)
    .map((session) => {
      const record = session.records.find((r) => r.enrollmentId === enrollmentId);
      return {
        sessionDate: session.sessionDate,
        status: (record?.status as MarkStatus | undefined) ?? 'Unmarked',
        markedByFacultyMemberId: record?.markedByFacultyMemberId,
        markedAt: record?.markedAt,
      };
    })
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
}

/** FWEB-15: enrollmentIds whose attendance percentage falls below the configured threshold, excluding students with no recorded sessions yet. */
export function computeLowAttendanceEnrollmentIds(
  stats: readonly StudentAttendanceStat[],
  thresholdPercent: number,
): readonly string[] {
  return stats
    .filter((s) => s.attendancePercent !== null && s.attendancePercent < thresholdPercent)
    .map((s) => s.enrollmentId);
}

/** Client-side CSV export (FWEB-14) -- no backend dependency, unlike the PDF path (see `attendance-stats.component.ts`'s own doc comment for that confirmed gap). */
export function buildStatsCsv(
  stats: readonly StudentAttendanceStat[],
  namesByEnrollmentId: Readonly<Record<string, string>>,
  asOfIso: string,
): string {
  const header = 'Student,Present,Absent,Late,Excused,Total Sessions,Attendance %,As Of';
  const rows = stats.map((s) =>
    [
      csvEscape(namesByEnrollmentId[s.enrollmentId] ?? s.enrollmentId),
      s.presentCount,
      s.absentCount,
      s.lateCount,
      s.excusedCount,
      s.totalSessions,
      s.attendancePercent ?? '',
      asOfIso,
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

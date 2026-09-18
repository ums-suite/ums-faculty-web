import type { AttendanceSessionDto } from '../../core/api/academic.types';
import {
  buildStatsCsv,
  computeLowAttendanceEnrollmentIds,
  computeStudentHistory,
  computeStudentStats,
} from './attendance-stats.util';

function session(overrides: Partial<AttendanceSessionDto>): AttendanceSessionDto {
  return {
    id: 's-1',
    courseOfferingId: 'off-1',
    sessionDate: '2026-09-01',
    correctionWindowClose: '2026-09-03T00:00:00Z',
    records: [],
    ...overrides,
  };
}

describe('computeStudentStats', () => {
  it('tallies present/absent/late/excused across every session in the log', () => {
    const log = {
      '2026-09-01': session({
        sessionDate: '2026-09-01',
        records: [
          { enrollmentId: 'e-1', status: 'Present', markedByFacultyMemberId: 'f', markedAt: 't' },
        ],
      }),
      '2026-09-08': session({
        sessionDate: '2026-09-08',
        records: [
          { enrollmentId: 'e-1', status: 'Absent', markedByFacultyMemberId: 'f', markedAt: 't' },
        ],
      }),
      '2026-09-15': session({
        sessionDate: '2026-09-15',
        records: [
          { enrollmentId: 'e-1', status: 'Late', markedByFacultyMemberId: 'f', markedAt: 't' },
        ],
      }),
    };

    const [stat] = computeStudentStats(log, ['e-1']);
    expect(stat.presentCount).toBe(1);
    expect(stat.absentCount).toBe(1);
    expect(stat.lateCount).toBe(1);
    expect(stat.totalSessions).toBe(3);
    // (present + late) / total = 2/3 = 66.67 -> rounds to 67
    expect(stat.attendancePercent).toBe(67);
  });

  it('returns null percent and zero counts for a student with no recorded sessions', () => {
    const [stat] = computeStudentStats({}, ['e-1']);
    expect(stat.totalSessions).toBe(0);
    expect(stat.attendancePercent).toBeNull();
  });

  it('skips a session that has no record for the student', () => {
    const log = {
      '2026-09-01': session({
        sessionDate: '2026-09-01',
        records: [
          {
            enrollmentId: 'e-other',
            status: 'Present',
            markedByFacultyMemberId: 'f',
            markedAt: 't',
          },
        ],
      }),
    };
    const [stat] = computeStudentStats(log, ['e-1']);
    expect(stat.totalSessions).toBe(0);
  });
});

describe('computeStudentHistory', () => {
  it('sorts entries newest-first and defaults to Unmarked when no record exists for a session', () => {
    const log = {
      '2026-09-01': session({
        sessionDate: '2026-09-01',
        records: [
          { enrollmentId: 'e-1', status: 'Present', markedByFacultyMemberId: 'f', markedAt: 't1' },
        ],
      }),
      '2026-09-15': session({ sessionDate: '2026-09-15', records: [] }),
    };
    const history = computeStudentHistory(log, 'e-1');
    expect(history.map((h) => h.sessionDate)).toEqual(['2026-09-15', '2026-09-01']);
    expect(history[0].status).toBe('Unmarked');
    expect(history[1].status).toBe('Present');
  });
});

describe('computeLowAttendanceEnrollmentIds', () => {
  it('flags students below the threshold, excluding those with no sessions yet', () => {
    const ids = computeLowAttendanceEnrollmentIds(
      [
        {
          enrollmentId: 'e-low',
          presentCount: 1,
          absentCount: 9,
          lateCount: 0,
          excusedCount: 0,
          totalSessions: 10,
          attendancePercent: 10,
        },
        {
          enrollmentId: 'e-ok',
          presentCount: 9,
          absentCount: 1,
          lateCount: 0,
          excusedCount: 0,
          totalSessions: 10,
          attendancePercent: 90,
        },
        {
          enrollmentId: 'e-none',
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          excusedCount: 0,
          totalSessions: 0,
          attendancePercent: null,
        },
      ],
      75,
    );
    expect(ids).toEqual(['e-low']);
  });
});

describe('buildStatsCsv', () => {
  it('builds a header row plus one row per student, escaping commas in names', () => {
    const csv = buildStatsCsv(
      [
        {
          enrollmentId: 'e-1',
          presentCount: 5,
          absentCount: 1,
          lateCount: 0,
          excusedCount: 0,
          totalSessions: 6,
          attendancePercent: 83,
        },
      ],
      { 'e-1': 'Doe, Jane' },
      '2026-09-18T10:00:00Z',
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Student,Present,Absent,Late,Excused,Total Sessions,Attendance %,As Of');
    expect(lines[1]).toBe('"Doe, Jane",5,1,0,0,6,83,2026-09-18T10:00:00Z');
  });

  it('falls back to the enrollmentId when no name is known', () => {
    const csv = buildStatsCsv(
      [
        {
          enrollmentId: 'e-1',
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          excusedCount: 0,
          totalSessions: 0,
          attendancePercent: null,
        },
      ],
      {},
      '2026-09-18T10:00:00Z',
    );
    expect(csv).toContain('e-1,0,0,0,0,0,,2026-09-18T10:00:00Z');
  });
});

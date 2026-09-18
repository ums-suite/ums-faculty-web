import { computeNextClass, computeTeachingLoadSummary } from './dashboard.logic';
import type { CourseOfferingDto } from '../../core/api/academic.types';

function offering(overrides: Partial<CourseOfferingDto> = {}): CourseOfferingDto {
  return {
    id: 'off-1',
    courseId: 'course-1',
    semesterId: 'sem-1',
    departmentId: 'dept-1',
    capacity: 40,
    enrolledCount: 30,
    hasAvailableSeats: true,
    instructorFacultyMemberId: 'fac-1',
    sections: [],
    exams: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('computeNextClass', () => {
  it('returns null when there are no sections', () => {
    expect(computeNextClass([offering()], new Date('2026-09-18T10:00:00'))).toBeNull();
  });

  it('marks a section in-progress when now falls within its start/end window', () => {
    // 2026-09-18 is a Friday (dayOfWeek 5).
    const now = new Date('2026-09-18T10:30:00');
    const result = computeNextClass(
      [
        offering({
          sections: [{ id: 'sec-1', code: 'A', dayOfWeek: 5, start: '10:00:00', end: '11:00:00' }],
        }),
      ],
      now,
    );
    expect(result?.inProgress).toBe(true);
    expect(result?.minutesUntilStart).toBe(0);
  });

  it('computes minutes until a later-today section', () => {
    const now = new Date('2026-09-18T09:00:00');
    const result = computeNextClass(
      [
        offering({
          sections: [{ id: 'sec-1', code: 'A', dayOfWeek: 5, start: '10:00:00', end: '11:00:00' }],
        }),
      ],
      now,
    );
    expect(result?.minutesUntilStart).toBe(60);
    expect(result?.inProgress).toBe(false);
  });

  it('rolls over to next week when the same-weekday slot has already passed today', () => {
    const now = new Date('2026-09-18T12:00:00'); // Friday, after the 10:00-11:00 slot
    const result = computeNextClass(
      [
        offering({
          sections: [{ id: 'sec-1', code: 'A', dayOfWeek: 5, start: '10:00:00', end: '11:00:00' }],
        }),
      ],
      now,
    );
    // 6 days + 22 hours = (6*24 + 22) * 60 = 9960
    expect(result?.minutesUntilStart).toBe(9960);
  });

  it('picks a different day-of-week slot correctly (Friday -> next Monday)', () => {
    const now = new Date('2026-09-18T12:00:00'); // Friday
    const result = computeNextClass(
      [
        offering({
          sections: [{ id: 'sec-1', code: 'B', dayOfWeek: 1, start: '09:00:00', end: '10:00:00' }],
        }),
      ],
      now,
    );
    // Friday -> Monday is 3 days away; 09:00 Monday minus 12:00 Friday.
    expect(result?.dayOfWeek).toBe(1);
    expect(result?.minutesUntilStart).toBe(3 * 24 * 60 + 9 * 60 - 12 * 60);
  });

  it('picks the single nearest occurrence across multiple offerings/sections', () => {
    const now = new Date('2026-09-18T09:00:00');
    const result = computeNextClass(
      [
        offering({
          id: 'off-far',
          sections: [
            { id: 'sec-far', code: 'A', dayOfWeek: 5, start: '15:00:00', end: '16:00:00' },
          ],
        }),
        offering({
          id: 'off-near',
          sections: [
            { id: 'sec-near', code: 'B', dayOfWeek: 5, start: '09:30:00', end: '10:30:00' },
          ],
        }),
      ],
      now,
    );
    expect(result?.courseOfferingId).toBe('off-near');
  });
});

describe('computeTeachingLoadSummary', () => {
  it('sums sections and enrolled students across offerings, leaving completion null', () => {
    const summary = computeTeachingLoadSummary([
      offering({
        enrolledCount: 30,
        sections: [
          { id: 's1', code: 'A', dayOfWeek: 1, start: '09:00:00', end: '10:00:00' },
          { id: 's2', code: 'B', dayOfWeek: 3, start: '09:00:00', end: '10:00:00' },
        ],
      }),
      offering({ id: 'off-2', enrolledCount: 20, sections: [] }),
    ]);
    expect(summary.sectionsCount).toBe(2);
    expect(summary.studentsCount).toBe(50);
    expect(summary.attendanceCompletionPercent).toBeNull();
  });

  it('returns zeros for no offerings', () => {
    const summary = computeTeachingLoadSummary([]);
    expect(summary.sectionsCount).toBe(0);
    expect(summary.studentsCount).toBe(0);
  });
});

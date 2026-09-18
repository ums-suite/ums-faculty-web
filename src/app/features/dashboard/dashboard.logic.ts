import type { CourseOfferingDto, SectionDto } from '../../core/api/academic.types';
import type { NextClassInfo, TeachingLoadSummary } from './dashboard.types';

const MINUTES_PER_DAY = 24 * 60;

/**
 * Pure "next class in X minutes" computation (FWEB-9, requirement-spec.md §7 Dashboard key
 * screen: "a 'next class in X minutes' card pinned at the top"). `.NET`'s `DayOfWeek` enum
 * (Sunday=0..Saturday=6, `SectionDto.dayOfWeek`) is numerically identical to JS `Date.getDay()`,
 * so no remapping is needed between the two.
 *
 * Scans every Section of every assigned CourseOffering and returns the single nearest upcoming
 * (or currently in-progress) weekly occurrence relative to `now`. Returns `null` only when there
 * are no assigned sections at all.
 */
export function computeNextClass(
  offerings: readonly CourseOfferingDto[],
  now: Date,
): NextClassInfo | null {
  let best: NextClassInfo | null = null;

  for (const offering of offerings) {
    for (const section of offering.sections) {
      const info = computeSectionOccurrence(offering.id, section, now);
      if (!best || info.minutesUntilStart < best.minutesUntilStart) {
        best = info;
      }
    }
  }

  return best;
}

function computeSectionOccurrence(
  courseOfferingId: string,
  section: SectionDto,
  now: Date,
): NextClassInfo {
  const startMinutes = parseTimeToMinutes(section.start);
  const endMinutes = parseTimeToMinutes(section.end);
  const nowMinutesOfDay = now.getHours() * 60 + now.getMinutes();
  const nowDay = now.getDay();

  let dayDelta = (section.dayOfWeek - nowDay + 7) % 7;
  let inProgress = false;
  let minutesUntilStart: number;

  if (dayDelta === 0 && nowMinutesOfDay >= startMinutes && nowMinutesOfDay < endMinutes) {
    inProgress = true;
    minutesUntilStart = 0;
  } else if (dayDelta === 0 && nowMinutesOfDay < startMinutes) {
    minutesUntilStart = startMinutes - nowMinutesOfDay;
  } else {
    // Either later this week or the same day-of-week but already past today -- push to next week.
    if (dayDelta === 0) {
      dayDelta = 7;
    }
    minutesUntilStart = dayDelta * MINUTES_PER_DAY + startMinutes - nowMinutesOfDay;
  }

  return {
    courseOfferingId,
    sectionId: section.id,
    sectionCode: section.code,
    dayOfWeek: section.dayOfWeek,
    start: section.start,
    end: section.end,
    minutesUntilStart,
    inProgress,
  };
}

function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  return hours * 60 + minutes;
}

/**
 * Teaching-load summary (FWEB-9, §3.1: "total sections taught, total enrolled students") --
 * `attendanceCompletionPercent` stays `null` pending the confirmed backend gap `dashboard.types.ts`
 * documents (no session-list-by-offering endpoint to compute completion against).
 */
export function computeTeachingLoadSummary(
  offerings: readonly CourseOfferingDto[],
): TeachingLoadSummary {
  return {
    sectionsCount: offerings.reduce((sum, offering) => sum + offering.sections.length, 0),
    studentsCount: offerings.reduce((sum, offering) => sum + offering.enrolledCount, 0),
    attendanceCompletionPercent: null,
  };
}

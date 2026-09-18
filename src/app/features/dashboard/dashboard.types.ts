/** FWEB-9 dashboard view-model types. */

export interface NextClassInfo {
  readonly courseOfferingId: string;
  readonly sectionId: string;
  readonly sectionCode: string;
  readonly dayOfWeek: number;
  readonly start: string;
  readonly end: string;
  readonly minutesUntilStart: number;
  readonly inProgress: boolean;
}

export interface TeachingLoadSummary {
  readonly sectionsCount: number;
  readonly studentsCount: number;
  /**
   * `null` until a real attendance-completion signal exists -- computing "which sessions still
   * need marking" requires knowing every past scheduled session for each assigned CourseOffering,
   * which needs `AttendanceApi`'s own confirmed gap (no session-list-by-offering endpoint,
   * `academic.types.ts`'s `AttendanceSessionDto` doc) resolved first. Rendered as "--" rather than
   * a fabricated number.
   */
  readonly attendanceCompletionPercent: number | null;
}

export type PendingActionKind = 'gradesDue' | 'leaveDecision' | 'lowAttendance';

export interface PendingAction {
  readonly kind: PendingActionKind;
  readonly translationKey: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

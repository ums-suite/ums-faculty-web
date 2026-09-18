import type { ResultPublicationStatusCode } from '../../core/api/academic.types';

/** FWEB-17..21 domain types. Grading is NOT offline-first (requirement-spec.md §10.2 -- offline
 * tolerance is scoped to Attendance only) so, unlike Attendance's state, nothing here models a
 * pending-sync queue; a cell is simply "dirty" (typed but not yet confirmed by the server) or not.
 */

export type GradeWorkflowStatus = ResultPublicationStatusCode;

export interface GradeRosterStudent {
  readonly enrollmentId: string;
  readonly studentId: string;
  readonly name: string;
}

/** One (student, Assessment-component) cell. */
export interface GradeEntryCell {
  readonly value: number | null;
  /** The last value actually confirmed by a successful `submitGrade` response -- `value !== savedValue` is this cell's own dirty flag. */
  readonly savedValue: number | null;
  readonly saving: boolean;
  /** Set the instant an entered value fails client-side range validation (invariant §8.4) -- population of this field is what makes an impossible mark impossible to "successfully" enter, not merely warned about. */
  readonly error: string | null;
}

export const EMPTY_CELL: GradeEntryCell = {
  value: null,
  savedValue: null,
  saving: false,
  error: null,
};

export interface GradeEntryRow {
  readonly enrollmentId: string;
  readonly studentId: string;
  readonly name: string;
  /** Keyed by AssessmentId. */
  readonly cells: Readonly<Record<string, GradeEntryCell>>;
  /** The `GradeDto.id` returned by the last successful submission -- `null` until then; `correctGrade` (FWEB-19) needs this id. */
  readonly gradeId: string | null;
  /** Last known from a successful `submitGrade` response for this row -- `null` until the first successful submission. */
  readonly calculatedScore: number | null;
  readonly letterGrade: string | null;
  readonly submittedAt: string | null;
  /** A submission attempt failed server-side (e.g. `grade.already_locked`) -- surfaced distinctly from a client-side range `error`. */
  readonly submitError: string | null;
}

export interface GradingState {
  readonly knownEnrollmentIds: readonly string[];
  readonly rows: Readonly<Record<string, GradeEntryRow>>;
}

export const EMPTY_GRADING_STATE: GradingState = { knownEnrollmentIds: [], rows: {} };

/** One configured gradable component, as loaded from `CourseOfferingDto.exams[].assessments[]`. */
export interface AssessmentColumn {
  readonly assessmentId: string;
  readonly examName: string;
  readonly name: string;
  readonly weight: number;
}

/** A retained proposed-correction diff (FWEB-19) -- the prior Published value stays visible alongside the proposed one until the correction is actually submitted or cancelled, never a silent in-place change. */
export interface PendingCorrection {
  readonly enrollmentId: string;
  readonly gradeId: string;
  readonly previousScores: Readonly<Record<string, number>>;
  readonly proposedScores: Readonly<Record<string, number>>;
  readonly reason: string;
}

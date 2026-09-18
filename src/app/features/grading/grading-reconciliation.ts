import type { GradeDto } from '../../core/api/academic.types';
import { validateScoreInput } from './grade-calculation';
import {
  EMPTY_CELL,
  EMPTY_GRADING_STATE,
  type GradeEntryCell,
  type GradeEntryRow,
  type GradeRosterStudent,
  type GradingState,
} from './grading.types';

/**
 * Pure state-transition functions over {@link GradingState} (FWEB-17). Kept Angular/HTTP-free for
 * the same reason `attendance-reconciliation.ts` is -- `GradingStore` is a thin orchestration layer
 * over these functions plus side effects (the actual `submitGrade`/lock/approve/publish HTTP
 * calls).
 */

/**
 * Roster refresh -- same confirmed-gap seam as `AttendanceStore.loadRoster` (no `ums-core`
 * endpoint lists a CourseOffering's enrolled students); a student already known keeps their
 * current cell state untouched, a newly-seen one is inserted with every configured Assessment
 * column present but empty.
 */
export function applyRosterRefresh(
  state: GradingState,
  entries: readonly GradeRosterStudent[],
  assessmentIds: readonly string[],
): GradingState {
  const knownSet = new Set(state.knownEnrollmentIds);
  const rows = { ...state.rows };
  const newIds: string[] = [];

  for (const entry of entries) {
    if (knownSet.has(entry.enrollmentId)) {
      continue;
    }
    knownSet.add(entry.enrollmentId);
    newIds.push(entry.enrollmentId);
    const cells: Record<string, GradeEntryCell> = {};
    for (const assessmentId of assessmentIds) {
      cells[assessmentId] = EMPTY_CELL;
    }
    rows[entry.enrollmentId] = {
      enrollmentId: entry.enrollmentId,
      studentId: entry.studentId,
      name: entry.name,
      cells,
      gradeId: null,
      calculatedScore: null,
      letterGrade: null,
      submittedAt: null,
      submitError: null,
    };
  }

  return { knownEnrollmentIds: [...state.knownEnrollmentIds, ...newIds], rows };
}

export interface CellInputResult {
  readonly state: GradingState;
  readonly valid: boolean;
}

/** Applies one cell's raw typed input (invariant §8.4 -- the value is only ever recorded, never sent onward, once {@link validateScoreInput} passes). */
export function applyCellInput(
  state: GradingState,
  enrollmentId: string,
  assessmentId: string,
  rawValue: string,
): CellInputResult {
  const row = state.rows[enrollmentId];
  if (!row) {
    return { state, valid: false };
  }

  const validation = validateScoreInput(rawValue);
  const trimmed = rawValue.trim();
  const numericValue = trimmed === '' ? null : Number(trimmed);
  const existingCell = row.cells[assessmentId] ?? EMPTY_CELL;

  const nextCell: GradeEntryCell = {
    ...existingCell,
    value: validation.valid ? numericValue : existingCell.value,
    error: validation.errorKey,
  };

  const nextRow: GradeEntryRow = { ...row, cells: { ...row.cells, [assessmentId]: nextCell } };
  return {
    state: { ...state, rows: { ...state.rows, [enrollmentId]: nextRow } },
    valid: validation.valid,
  };
}

/** True if any cell in the row currently differs from its last-saved value. */
export function rowIsDirty(row: GradeEntryRow): boolean {
  return Object.values(row.cells).some((cell) => cell.value !== cell.savedValue);
}

/** True if any cell in the row is currently flagged with a client-side validation error. */
export function rowHasErrors(row: GradeEntryRow): boolean {
  return Object.values(row.cells).some((cell) => cell.error !== null);
}

export function markRowSaving(
  state: GradingState,
  enrollmentId: string,
  saving: boolean,
): GradingState {
  const row = state.rows[enrollmentId];
  if (!row) {
    return state;
  }
  const cells = Object.fromEntries(
    Object.entries(row.cells).map(([id, cell]) => [id, { ...cell, saving }]),
  );
  return {
    ...state,
    rows: {
      ...state.rows,
      [enrollmentId]: { ...row, cells, submitError: saving ? null : row.submitError },
    },
  };
}

/** Applies a successful `submitGrade` response -- every submitted score's `savedValue` catches up to its `value`, clearing that cell's dirty flag. */
export function applyGradeSubmitted(
  state: GradingState,
  enrollmentId: string,
  dto: GradeDto,
): GradingState {
  const row = state.rows[enrollmentId];
  if (!row) {
    return state;
  }

  const cells = { ...row.cells };
  for (const score of dto.scores) {
    const existing = cells[score.assessmentId] ?? EMPTY_CELL;
    cells[score.assessmentId] = {
      ...existing,
      value: score.score,
      savedValue: score.score,
      saving: false,
      error: null,
    };
  }

  const nextRow: GradeEntryRow = {
    ...row,
    cells,
    gradeId: dto.id,
    calculatedScore: dto.calculatedScore,
    letterGrade: dto.letterGrade,
    submittedAt: dto.submittedAt,
    submitError: null,
  };
  return { ...state, rows: { ...state.rows, [enrollmentId]: nextRow } };
}

export function applySubmitFailed(
  state: GradingState,
  enrollmentId: string,
  errorKey: string,
): GradingState {
  const row = state.rows[enrollmentId];
  if (!row) {
    return state;
  }
  const cells = Object.fromEntries(
    Object.entries(row.cells).map(([id, cell]) => [id, { ...cell, saving: false }]),
  );
  return {
    ...state,
    rows: { ...state.rows, [enrollmentId]: { ...row, cells, submitError: errorKey } },
  };
}

export { EMPTY_GRADING_STATE };

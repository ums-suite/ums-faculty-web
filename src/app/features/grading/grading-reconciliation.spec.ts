import type { GradeDto } from '../../core/api/academic.types';
import {
  applyCellInput,
  applyGradeSubmitted,
  applyRosterRefresh,
  applySubmitFailed,
  markRowSaving,
  rowHasErrors,
  rowIsDirty,
} from './grading-reconciliation';
import { EMPTY_GRADING_STATE, type GradeRosterStudent } from './grading.types';

const alice: GradeRosterStudent = { enrollmentId: 'e-alice', studentId: 's-alice', name: 'Alice' };
const bob: GradeRosterStudent = { enrollmentId: 'e-bob', studentId: 's-bob', name: 'Bob' };
const assessmentIds = ['midterm', 'final'];

describe('applyRosterRefresh (grading)', () => {
  it('inserts new rows with every configured Assessment column present but empty', () => {
    const state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    expect(state.knownEnrollmentIds).toEqual(['e-alice']);
    const row = state.rows['e-alice'];
    expect(row.cells['midterm']).toEqual({
      value: null,
      savedValue: null,
      saving: false,
      error: null,
    });
    expect(row.cells['final']).toEqual({
      value: null,
      savedValue: null,
      saving: false,
      error: null,
    });
    expect(row.gradeId).toBeNull();
  });

  it('never overwrites an already-known row on a later refresh', () => {
    let state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    state = {
      ...state,
      rows: { ...state.rows, 'e-alice': { ...state.rows['e-alice'], name: 'Edited Locally' } },
    };
    state = applyRosterRefresh(state, [alice, bob], assessmentIds);
    expect(state.rows['e-alice'].name).toBe('Edited Locally');
    expect(state.knownEnrollmentIds).toEqual(['e-alice', 'e-bob']);
  });
});

describe('applyCellInput', () => {
  it('records a valid value and reports valid: true', () => {
    const state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    const result = applyCellInput(state, 'e-alice', 'midterm', '85');
    expect(result.valid).toBe(true);
    expect(result.state.rows['e-alice'].cells['midterm'].value).toBe(85);
    expect(result.state.rows['e-alice'].cells['midterm'].error).toBeNull();
  });

  it('rejects an above-maximum value -- the value is NOT recorded (invariant §8.4)', () => {
    const state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    const result = applyCellInput(state, 'e-alice', 'midterm', '150');
    expect(result.valid).toBe(false);
    expect(result.state.rows['e-alice'].cells['midterm'].value).toBeNull();
    expect(result.state.rows['e-alice'].cells['midterm'].error).toBe('grading.error.aboveMaximum');
  });

  it('keeps the previously-valid value when a later edit is invalid, only flagging the error', () => {
    let state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    state = applyCellInput(state, 'e-alice', 'midterm', '70').state;
    const result = applyCellInput(state, 'e-alice', 'midterm', '999');
    expect(result.state.rows['e-alice'].cells['midterm'].value).toBe(70);
    expect(result.state.rows['e-alice'].cells['midterm'].error).toBe('grading.error.aboveMaximum');
  });

  it('is a no-op for an unknown enrollmentId', () => {
    const result = applyCellInput(EMPTY_GRADING_STATE, 'ghost', 'midterm', '70');
    expect(result.valid).toBe(false);
    expect(result.state).toBe(EMPTY_GRADING_STATE);
  });
});

describe('rowIsDirty / rowHasErrors', () => {
  it('is dirty once a cell value differs from its saved value', () => {
    let state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    expect(rowIsDirty(state.rows['e-alice'])).toBe(false);
    state = applyCellInput(state, 'e-alice', 'midterm', '70').state;
    expect(rowIsDirty(state.rows['e-alice'])).toBe(true);
  });

  it('reports errors present on any cell', () => {
    let state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    state = applyCellInput(state, 'e-alice', 'midterm', '999').state;
    expect(rowHasErrors(state.rows['e-alice'])).toBe(true);
  });
});

describe('markRowSaving / applyGradeSubmitted / applySubmitFailed', () => {
  const dto: GradeDto = {
    id: 'g-1',
    enrollmentId: 'e-alice',
    calculatedScore: 82,
    letterGrade: 'A+',
    scores: [
      { assessmentId: 'midterm', score: 70 },
      { assessmentId: 'final', score: 90 },
    ],
    submittedAt: '2026-09-18T00:00:00Z',
  };

  it('marks every cell in the row saving', () => {
    const state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    const saving = markRowSaving(state, 'e-alice', true);
    expect(Object.values(saving.rows['e-alice'].cells).every((c) => c.saving)).toBe(true);
  });

  it('applies a successful submission: savedValue catches up to value, clearing dirtiness', () => {
    let state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    state = applyCellInput(state, 'e-alice', 'midterm', '70').state;
    state = applyCellInput(state, 'e-alice', 'final', '90').state;
    state = markRowSaving(state, 'e-alice', true);

    state = applyGradeSubmitted(state, 'e-alice', dto);

    expect(rowIsDirty(state.rows['e-alice'])).toBe(false);
    expect(state.rows['e-alice'].gradeId).toBe('g-1');
    expect(state.rows['e-alice'].calculatedScore).toBe(82);
    expect(state.rows['e-alice'].letterGrade).toBe('A+');
    expect(state.rows['e-alice'].cells['midterm'].saving).toBe(false);
  });

  it('applies a submission failure by recording submitError and clearing saving, keeping values dirty', () => {
    let state = applyRosterRefresh(EMPTY_GRADING_STATE, [alice], assessmentIds);
    state = applyCellInput(state, 'e-alice', 'midterm', '70').state;
    state = markRowSaving(state, 'e-alice', true);

    state = applySubmitFailed(state, 'e-alice', 'grading.error.alreadyLocked');

    expect(state.rows['e-alice'].submitError).toBe('grading.error.alreadyLocked');
    expect(state.rows['e-alice'].cells['midterm'].saving).toBe(false);
    expect(rowIsDirty(state.rows['e-alice'])).toBe(true);
  });

  it('is a no-op for an unknown enrollmentId across all three functions', () => {
    expect(markRowSaving(EMPTY_GRADING_STATE, 'ghost', true)).toBe(EMPTY_GRADING_STATE);
    expect(applyGradeSubmitted(EMPTY_GRADING_STATE, 'ghost', dto)).toBe(EMPTY_GRADING_STATE);
    expect(applySubmitFailed(EMPTY_GRADING_STATE, 'ghost', 'x')).toBe(EMPTY_GRADING_STATE);
  });
});

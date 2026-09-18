/**
 * Pure mark-validation/running-total computation (FWEB-17/FWEB-20) -- one of the two modules §4's
 * ≥90%-coverage bar names by name ("Grading's mark-validation... logic"). Kept entirely free of
 * Angular/HTTP so it's trivial to hit that bar with plain unit tests, exactly mirroring
 * `attendance-reconciliation.ts`'s own precedent for Attendance's offline-merge logic.
 *
 * `MIN_ASSESSMENT_SCORE`/`MAX_ASSESSMENT_SCORE` and the weighted-average/letter-band formula below
 * are a deliberate, exact mirror of `ums-core`'s own
 * `UMS.Modules.Academic.Application.Grades.GradeCalculator.Calculate` -- verified directly against
 * that source, not guessed. This is also this app's resolution of a confirmed backend-model gap:
 * `AssessmentDto` (`academic.types.ts`) has no per-component configurable "maximum marks" field at
 * all, only a `weight` fraction contributing to the aggregate -- `GradeCalculator` itself validates
 * every individual score to a fixed `0..100` range regardless of weight. Domain Invariant #4
 * ("marks never exceed a component's configured maximum") is satisfied against that real, fixed
 * range here, not against a per-Assessment field the backend does not have.
 */

export const MIN_ASSESSMENT_SCORE = 0;
export const MAX_ASSESSMENT_SCORE = 100;

/** `GradeCalculator`'s own letter bands, in the same descending-by-minimum order. */
const LETTER_BANDS: readonly (readonly [minPercentage: number, letter: string])[] = [
  [80, 'A+'],
  [75, 'A'],
  [70, 'A-'],
  [65, 'B+'],
  [60, 'B'],
  [55, 'B-'],
  [50, 'C+'],
  [45, 'C'],
  [40, 'D'],
  [0, 'F'],
];

export interface ScoreValidation {
  readonly valid: boolean;
  /** A translation key, never a hardcoded English string (ADR-0011). */
  readonly errorKey: string | null;
}

/**
 * The single gate every entered cell must pass before it is ever sent to the server (invariant
 * §8.4: "client-side validation blocks over-max entry before submission... must never let a
 * faculty member 'successfully' enter an impossible mark"). Accepts the raw typed string so it can
 * validate empty/non-numeric input too, not only already-parsed numbers.
 */
export function validateScoreInput(rawValue: string): ScoreValidation {
  const trimmed = rawValue.trim();
  if (trimmed === '') {
    return { valid: true, errorKey: null };
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { valid: false, errorKey: 'grading.error.notANumber' };
  }
  if (value < MIN_ASSESSMENT_SCORE) {
    return { valid: false, errorKey: 'grading.error.belowMinimum' };
  }
  if (value > MAX_ASSESSMENT_SCORE) {
    return { valid: false, errorKey: 'grading.error.aboveMaximum' };
  }
  return { valid: true, errorKey: null };
}

export interface ComputedGrade {
  readonly percentage: number;
  readonly letterGrade: string;
}

/**
 * Mirrors `GradeCalculator.Calculate` exactly: a weighted average normalized against the weight of
 * whatever's actually been entered so far (a partial entry still produces a meaningful running
 * total, FWEB-17's "always-visible running total" / FWEB-20's live preview), then letter-banded.
 * Returns `null` once nothing scoreable has been entered yet (nothing to preview). This is a
 * client-side preview ONLY -- the server remains the authoritative calculation (invariant §4).
 */
export function computeRowGrade(
  scores: ReadonlyMap<string, number>,
  assessmentWeights: ReadonlyMap<string, number>,
): ComputedGrade | null {
  let weightedTotal = 0;
  let totalWeightSeen = 0;

  for (const [assessmentId, score] of scores) {
    const weight = assessmentWeights.get(assessmentId);
    if (weight === undefined) {
      continue;
    }
    weightedTotal += score * weight;
    totalWeightSeen += weight;
  }

  if (totalWeightSeen === 0) {
    return null;
  }

  const percentage = Math.round((weightedTotal / totalWeightSeen) * 10000) / 10000;
  const letterGrade = letterForPercentage(percentage);
  return { percentage, letterGrade };
}

export function letterForPercentage(percentage: number): string {
  const band = LETTER_BANDS.find(([minPercentage]) => percentage >= minPercentage);
  return band ? band[1] : 'F';
}

export interface GradeBand {
  readonly letter: string;
  readonly count: number;
}

export interface ClassDistribution {
  readonly average: number | null;
  readonly bands: readonly GradeBand[];
}

/** FWEB-20's live class-average/grade-distribution preview -- a cheap client-side derivation over whatever percentages are currently computable, no new backend dependency. */
export function computeClassDistribution(rowPercentages: readonly number[]): ClassDistribution {
  const bands = LETTER_BANDS.map(([, letter]) => ({ letter, count: 0 }) as GradeBand);

  if (rowPercentages.length === 0) {
    return { average: null, bands };
  }

  for (const percentage of rowPercentages) {
    const letter = letterForPercentage(percentage);
    const band = bands.find((b) => b.letter === letter);
    if (band) {
      (band as { count: number }).count += 1;
    }
  }

  const total = rowPercentages.reduce((sum, p) => sum + p, 0);
  const average = Math.round((total / rowPercentages.length) * 100) / 100;
  return { average, bands };
}

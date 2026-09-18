import {
  computeClassDistribution,
  computeRowGrade,
  letterForPercentage,
  MAX_ASSESSMENT_SCORE,
  MIN_ASSESSMENT_SCORE,
  validateScoreInput,
} from './grade-calculation';

describe('validateScoreInput', () => {
  it('accepts an empty string as valid (not-yet-entered, not an error)', () => {
    expect(validateScoreInput('')).toEqual({ valid: true, errorKey: null });
    expect(validateScoreInput('   ')).toEqual({ valid: true, errorKey: null });
  });

  it('accepts a value exactly at the minimum boundary', () => {
    expect(validateScoreInput(String(MIN_ASSESSMENT_SCORE))).toEqual({
      valid: true,
      errorKey: null,
    });
  });

  it('accepts a value exactly at the maximum boundary', () => {
    expect(validateScoreInput(String(MAX_ASSESSMENT_SCORE))).toEqual({
      valid: true,
      errorKey: null,
    });
  });

  it('accepts an ordinary in-range value', () => {
    expect(validateScoreInput('72.5')).toEqual({ valid: true, errorKey: null });
  });

  it('rejects a value above the maximum -- invariant §8.4, never "successfully" enterable', () => {
    expect(validateScoreInput('101')).toEqual({
      valid: false,
      errorKey: 'grading.error.aboveMaximum',
    });
  });

  it('rejects a negative value', () => {
    expect(validateScoreInput('-1')).toEqual({
      valid: false,
      errorKey: 'grading.error.belowMinimum',
    });
  });

  it('rejects non-numeric input', () => {
    expect(validateScoreInput('abc')).toEqual({
      valid: false,
      errorKey: 'grading.error.notANumber',
    });
  });

  it('rejects NaN-producing whitespace-only-looking-numeric input', () => {
    expect(validateScoreInput('12abc')).toEqual({
      valid: false,
      errorKey: 'grading.error.notANumber',
    });
  });
});

describe('letterForPercentage', () => {
  const cases: readonly (readonly [number, string])[] = [
    [100, 'A+'],
    [80, 'A+'],
    [79.99, 'A'],
    [75, 'A'],
    [70, 'A-'],
    [65, 'B+'],
    [60, 'B'],
    [55, 'B-'],
    [50, 'C+'],
    [45, 'C'],
    [40, 'D'],
    [39.99, 'F'],
    [0, 'F'],
  ];

  for (const [percentage, expected] of cases) {
    it(`maps ${percentage}% to ${expected}`, () => {
      expect(letterForPercentage(percentage)).toBe(expected);
    });
  }
});

describe('computeRowGrade', () => {
  it('returns null when nothing has been entered yet', () => {
    expect(computeRowGrade(new Map(), new Map([['a1', 0.5]]))).toBeNull();
  });

  it('computes a full weighted average across every configured component', () => {
    const scores = new Map([
      ['midterm', 70],
      ['final', 90],
    ]);
    const weights = new Map([
      ['midterm', 0.4],
      ['final', 0.6],
    ]);
    const result = computeRowGrade(scores, weights);
    expect(result?.percentage).toBeCloseTo(82, 5);
    expect(result?.letterGrade).toBe('A+');
  });

  it('normalizes against only the weight actually entered so far (a partial entry)', () => {
    const scores = new Map([['midterm', 70]]);
    const weights = new Map([
      ['midterm', 0.4],
      ['final', 0.6],
    ]);
    const result = computeRowGrade(scores, weights);
    // Normalized: 70 * 0.4 / 0.4 = 70, not diluted by the unentered final component.
    expect(result?.percentage).toBe(70);
    expect(result?.letterGrade).toBe('A-');
  });

  it('ignores a score for an assessmentId with no configured weight', () => {
    const scores = new Map([
      ['midterm', 70],
      ['unknown-assessment', 999],
    ]);
    const weights = new Map([['midterm', 1]]);
    const result = computeRowGrade(scores, weights);
    expect(result?.percentage).toBe(70);
  });
});

describe('computeClassDistribution', () => {
  it('returns a null average and all-zero bands for an empty class', () => {
    const result = computeClassDistribution([]);
    expect(result.average).toBeNull();
    expect(result.bands.every((b) => b.count === 0)).toBe(true);
    expect(result.bands.length).toBe(10);
  });

  it('computes the class average and per-letter counts', () => {
    const result = computeClassDistribution([90, 85, 60, 30]);
    expect(result.average).toBe(66.25);
    expect(result.bands.find((b) => b.letter === 'A+')?.count).toBe(2);
    expect(result.bands.find((b) => b.letter === 'B')?.count).toBe(1);
    expect(result.bands.find((b) => b.letter === 'F')?.count).toBe(1);
  });
});

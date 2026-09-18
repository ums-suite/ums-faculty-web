import { formatDateOnly } from './attendance-date.util';

describe('formatDateOnly', () => {
  it('formats a date as yyyy-MM-dd using local date parts', () => {
    expect(formatDateOnly(new Date(2026, 8, 5))).toBe('2026-09-05');
  });

  it('pads single-digit months and days', () => {
    expect(formatDateOnly(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

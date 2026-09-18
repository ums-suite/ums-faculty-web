import {
  badgeVariant,
  bannerLabelKey,
  canApprove,
  canArchive,
  canEditMarks,
  canLock,
  canPublish,
  canReject,
  canRequestCorrection,
  isReadOnlyHistorical,
} from './grade-lock-state';
import type { GradeWorkflowStatus } from './grading.types';

const ALL_STATUSES: readonly GradeWorkflowStatus[] = [
  'Draft',
  'Calculated',
  'Verified',
  'Approved',
  'Published',
  'Archived',
];

describe('canEditMarks', () => {
  it('is true only for Draft and Calculated', () => {
    expect(canEditMarks('Draft')).toBe(true);
    expect(canEditMarks('Calculated')).toBe(true);
    expect(canEditMarks('Verified')).toBe(false);
    expect(canEditMarks('Approved')).toBe(false);
    expect(canEditMarks('Published')).toBe(false);
    expect(canEditMarks('Archived')).toBe(false);
  });
});

describe('canLock', () => {
  it('is true only from Calculated', () => {
    for (const status of ALL_STATUSES) {
      expect(canLock(status)).toBe(status === 'Calculated');
    }
  });
});

describe('canReject', () => {
  it('is true only from Verified', () => {
    for (const status of ALL_STATUSES) {
      expect(canReject(status)).toBe(status === 'Verified');
    }
  });
});

describe('canApprove', () => {
  it('is true only from Verified', () => {
    for (const status of ALL_STATUSES) {
      expect(canApprove(status)).toBe(status === 'Verified');
    }
  });
});

describe('canPublish', () => {
  it('is true only from Approved', () => {
    for (const status of ALL_STATUSES) {
      expect(canPublish(status)).toBe(status === 'Approved');
    }
  });
});

describe('canArchive', () => {
  it('is true only from Published', () => {
    for (const status of ALL_STATUSES) {
      expect(canArchive(status)).toBe(status === 'Published');
    }
  });
});

describe('canRequestCorrection', () => {
  it('is true only from Published -- invariant §8.2/edge-cases.md correction-on-Published', () => {
    for (const status of ALL_STATUSES) {
      expect(canRequestCorrection(status)).toBe(status === 'Published');
    }
  });
});

describe('isReadOnlyHistorical', () => {
  it('is true only for Archived', () => {
    for (const status of ALL_STATUSES) {
      expect(isReadOnlyHistorical(status)).toBe(status === 'Archived');
    }
  });
});

describe('bannerLabelKey / badgeVariant', () => {
  it('returns a distinct translation key for every status', () => {
    const keys = ALL_STATUSES.map(bannerLabelKey);
    expect(new Set(keys).size).toBe(ALL_STATUSES.length);
  });

  it('maps Published to the success badge variant and Draft to neutral', () => {
    expect(badgeVariant('Published')).toBe('success');
    expect(badgeVariant('Draft')).toBe('neutral');
    expect(badgeVariant('Verified')).toBe('warning');
  });
});

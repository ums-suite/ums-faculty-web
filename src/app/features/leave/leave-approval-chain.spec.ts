import { computeApprovalChain, isPending } from './leave-approval-chain';

describe('computeApprovalChain', () => {
  it('always returns the fixed 3-node Faculty -> Department Head -> Authority order (invariant §8.5)', () => {
    const chain = computeApprovalChain('Submitted', false);
    expect(chain.steps.map((s) => s.id)).toEqual(['faculty', 'departmentHead', 'authority']);
  });

  it('Draft sits at the faculty step', () => {
    expect(computeApprovalChain('Draft', false).currentIndex).toBe(0);
  });

  it('Submitted (normal routing) sits at the Department Head step', () => {
    expect(computeApprovalChain('Submitted', false).currentIndex).toBe(1);
  });

  it('DeptHeadApproved sits at the Authority step', () => {
    expect(computeApprovalChain('DeptHeadApproved', false).currentIndex).toBe(2);
  });

  it('Approved/Rejected/Cancelled are all past the last step', () => {
    expect(computeApprovalChain('Approved', false).currentIndex).toBe(3);
    expect(computeApprovalChain('Rejected', false).currentIndex).toBe(3);
    expect(computeApprovalChain('Cancelled', false).currentIndex).toBe(3);
  });

  it('a routed-direct-to-authority Submitted request sits at the Authority step, never the Department Head step', () => {
    expect(computeApprovalChain('Submitted', true).currentIndex).toBe(2);
  });

  it('the Department Head node is still present and in order even when routed direct -- never removed, never reordered', () => {
    const chain = computeApprovalChain('Submitted', true);
    expect(chain.steps.map((s) => s.id)).toEqual(['faculty', 'departmentHead', 'authority']);
    expect(chain.steps[1].descriptionKey).toBe('leave.chain.departmentHead.bypassed');
  });

  it('the Department Head node has no bypass description under normal routing', () => {
    const chain = computeApprovalChain('Submitted', false);
    expect(chain.steps[1].descriptionKey).toBeNull();
  });
});

describe('isPending', () => {
  it('is true for Draft, Submitted, and DeptHeadApproved', () => {
    expect(isPending('Draft')).toBe(true);
    expect(isPending('Submitted')).toBe(true);
    expect(isPending('DeptHeadApproved')).toBe(true);
  });

  it('is false for a decided or cancelled request', () => {
    expect(isPending('Approved')).toBe(false);
    expect(isPending('Rejected')).toBe(false);
    expect(isPending('Cancelled')).toBe(false);
  });
});

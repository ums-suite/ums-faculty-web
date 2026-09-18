import type { LeaveRequestStatusCode } from '../../core/api/faculty.types';

/**
 * Pure approval-chain-stepper derivation (FWEB-25, invariant §8.5: "the UI never allows skipping
 * or reordering the Faculty -> Department Head -> Authorized Authority chain... even for a
 * faculty member who is themselves a Department Head applying for their own leave").
 *
 * `LeaveRequestDto.routedDirectlyToAuthority` reflects `Faculty`'s own real, server-decided
 * "Self-Approval Routing Enforcement Mechanism" (`LeaveRequest.Submit`, verified against source):
 * a Department Head's own self-authored request is routed DIRECTLY to the Authorized Authority,
 * genuinely bypassing the Department Head step server-side, as an anti-self-approval control. This
 * is a real backend-decided ROUTING FACT, not a UI-offered skip affordance -- {@link
 * computeApprovalChain} always returns the fixed 3-node order (never reordered, never fewer
 * nodes), and marks the bypassed node's `descriptionKey` distinctly rather than ever removing it,
 * so invariant §8.5 holds for real: nothing in this app ever lets a user choose to skip a step.
 */
export type ApprovalStepId = 'faculty' | 'departmentHead' | 'authority';

export interface ApprovalChainStep {
  readonly id: ApprovalStepId;
  readonly labelKey: string;
  readonly descriptionKey: string | null;
}

export interface ApprovalChainView {
  readonly steps: readonly ApprovalChainStep[];
  /** 0-based index of the current/next-pending step; `steps.length` once fully decided (Approved/Rejected/Cancelled -- a separate terminal badge communicates which). */
  readonly currentIndex: number;
}

const STEP_IDS: readonly ApprovalStepId[] = ['faculty', 'departmentHead', 'authority'];

export function computeApprovalChain(
  status: LeaveRequestStatusCode,
  routedDirectlyToAuthority: boolean,
): ApprovalChainView {
  const steps: ApprovalChainStep[] = STEP_IDS.map((id) => ({
    id,
    labelKey: `leave.chain.${id}`,
    descriptionKey:
      id === 'departmentHead' && routedDirectlyToAuthority
        ? 'leave.chain.departmentHead.bypassed'
        : null,
  }));

  return { steps, currentIndex: currentIndexFor(status, routedDirectlyToAuthority) };
}

function currentIndexFor(
  status: LeaveRequestStatusCode,
  routedDirectlyToAuthority: boolean,
): number {
  switch (status) {
    case 'Draft':
      return 0;
    case 'Submitted':
      return routedDirectlyToAuthority ? 2 : 1;
    case 'DeptHeadApproved':
      return 2;
    case 'Approved':
    case 'Rejected':
    case 'Cancelled':
      return 3;
    default:
      return 0;
  }
}

/** Whether the request is still awaiting a decision -- FWEB-25's "cancel a still-pending request", matching `LeaveRequest.Cancel`'s own real server-side guard exactly (`Draft`/`Submitted`/`DeptHeadApproved`). */
export function isPending(status: LeaveRequestStatusCode): boolean {
  return status === 'Draft' || status === 'Submitted' || status === 'DeptHeadApproved';
}

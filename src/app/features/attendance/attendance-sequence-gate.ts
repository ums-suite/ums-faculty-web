/**
 * The load-bearing mechanism of this app's whole Attendance scope (FWEB-12, design-decisions.md
 * "Attendance Session-State Reconciliation — Response-Stamped Sequence Numbers, Not Arrival-Order
 * Trust"; §4's ≥90%-coverage bar names this exact class of logic).
 *
 * A single shared monotonic counter, consumed two different ways depending on whether the caller
 * is a READ or a WRITE:
 *
 * - {@link stampRead} is called at DISPATCH time, before a manual re-fetch's request goes out. The
 *   returned number is carried through to whenever that response eventually arrives. If the read
 *   is slow, its fixed, "stale" number may by then be smaller than what has since been applied --
 *   {@link tryApply} then correctly discards it, so a slow-to-resolve-but-earlier-dispatched read
 *   can never regress the UI to older data.
 * - {@link stampWriteResponse} is called at RESPONSE time, once a write (a Background-Sync upload
 *   or a direct online POST) actually completes. Because it grabs the CURRENT counter value at
 *   that moment rather than one reserved at dispatch, a slow write always "cuts in line" and wins
 *   over anything applied while it was in flight -- exactly the property the design decision names
 *   as non-obvious and load-bearing ("assigned to writes at response time, not dispatch time,
 *   specifically so a slow write always outranks an earlier-dispatched-but-later-arriving read").
 *
 * {@link tryApply} is the single gate every session-state-producing response must pass through
 * before its data is allowed to touch the UI: a response is applied only if its sequence number is
 * not older (`>=`) than the last-applied one; otherwise it is silently discarded. This resolves
 * Invariant §8.1 ("exactly one final state per student per session") at the client-rendering
 * layer, not only the server-merge layer.
 */
export class AttendanceSequenceGate {
  private counter = 0;
  private lastApplied = 0;

  /** Call at dispatch time for any read that will produce a full session snapshot later. */
  stampRead(): number {
    this.counter += 1;
    return this.counter;
  }

  /** Call at response time for any write that just completed. */
  stampWriteResponse(): number {
    this.counter += 1;
    return this.counter;
  }

  /**
   * Returns whether `sequence` should be applied. As a side effect, advances the last-applied
   * watermark when it is -- a response's own sequence number is consumed exactly once.
   */
  tryApply(sequence: number): boolean {
    if (sequence < this.lastApplied) {
      return false;
    }
    this.lastApplied = sequence;
    return true;
  }

  /** The most recent sequence number actually applied (0 before anything has been). */
  get lastAppliedSequence(): number {
    return this.lastApplied;
  }

  /** Resets both the counter and the watermark -- call when opening a fresh session. */
  reset(): void {
    this.counter = 0;
    this.lastApplied = 0;
  }
}

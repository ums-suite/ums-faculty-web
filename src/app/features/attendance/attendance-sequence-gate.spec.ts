import { AttendanceSequenceGate } from './attendance-sequence-gate';

describe('AttendanceSequenceGate', () => {
  let gate: AttendanceSequenceGate;

  beforeEach(() => {
    gate = new AttendanceSequenceGate();
  });

  it('starts with lastAppliedSequence at 0', () => {
    expect(gate.lastAppliedSequence).toBe(0);
  });

  it('stampRead returns increasing numbers starting at 1', () => {
    expect(gate.stampRead()).toBe(1);
    expect(gate.stampRead()).toBe(2);
    expect(gate.stampRead()).toBe(3);
  });

  it('stampWriteResponse returns increasing numbers starting at 1', () => {
    expect(gate.stampWriteResponse()).toBe(1);
    expect(gate.stampWriteResponse()).toBe(2);
  });

  it('stampRead and stampWriteResponse share the same monotonic counter', () => {
    expect(gate.stampRead()).toBe(1);
    expect(gate.stampWriteResponse()).toBe(2);
    expect(gate.stampRead()).toBe(3);
  });

  it('applies the very first response regardless of its number', () => {
    expect(gate.tryApply(1)).toBe(true);
    expect(gate.lastAppliedSequence).toBe(1);
  });

  it('applies a response whose sequence equals the last-applied one (not strictly greater)', () => {
    gate.tryApply(5);
    expect(gate.tryApply(5)).toBe(true);
    expect(gate.lastAppliedSequence).toBe(5);
  });

  it('applies a response with a strictly greater sequence and advances the watermark', () => {
    gate.tryApply(2);
    expect(gate.tryApply(7)).toBe(true);
    expect(gate.lastAppliedSequence).toBe(7);
  });

  it('discards a response older than the last-applied one and does not move the watermark', () => {
    gate.tryApply(10);
    expect(gate.tryApply(3)).toBe(false);
    expect(gate.lastAppliedSequence).toBe(10);
  });

  it('discards two out-of-order reads correctly (later-numbered response wins even if it resolves first)', () => {
    // Two manual refreshes dispatched back-to-back: seq=1 then seq=2.
    const firstReadSeq = gate.stampRead();
    const secondReadSeq = gate.stampRead();

    // The SECOND (higher-numbered) read's response resolves first.
    expect(gate.tryApply(secondReadSeq)).toBe(true);
    // The FIRST (lower-numbered, now-stale) read's response resolves after -- discarded.
    expect(gate.tryApply(firstReadSeq)).toBe(false);
    expect(gate.lastAppliedSequence).toBe(secondReadSeq);
  });

  it('reset() clears both the counter and the watermark', () => {
    gate.stampRead();
    gate.stampRead();
    gate.tryApply(2);
    gate.reset();
    expect(gate.lastAppliedSequence).toBe(0);
    expect(gate.stampRead()).toBe(1);
  });

  describe('the exact race walked through in edge-cases.md "Background-Sync Merge Races a Manual Reconnect Re-Fetch"', () => {
    it('lets a slow write (stamped at response time) win over an intervening faster manual read', () => {
      // t0: mark made offline, queued locally (no sequence number needed for the local optimistic
      // write itself -- only server-round-trip responses are stamped).

      // t1: reconnect; the sync worker DISPATCHES its upload. Per the design decision, a write is
      // deliberately NOT stamped at dispatch time -- nothing happens to the gate here.

      // t2: the faculty member independently triggers a manual GET, dispatched with the next local
      // sequence number.
      const manualReadSeq = gate.stampRead(); // seq = 1

      // t3: the GET resolves FIRST (server hadn't processed the sync's upload yet), returning the
      // pre-sync state. This is expected and correctly applied -- the server genuinely hadn't
      // merged the sync yet at the moment this read was dispatched.
      expect(gate.tryApply(manualReadSeq)).toBe(true);
      expect(gate.lastAppliedSequence).toBe(1);

      // t4: the sync's upload finally completes. The server responds with the now-authoritative
      // merged state, stamped NOW (at response time, not the earlier dispatch time) -- so it gets
      // a fresh, higher sequence number that necessarily outranks the manual read's.
      const syncResponseSeq = gate.stampWriteResponse(); // seq = 2
      expect(gate.tryApply(syncResponseSeq)).toBe(true);
      expect(gate.lastAppliedSequence).toBe(2);

      // Final rendered state is the sync's own result -- at no point could the manual read's
      // seq=1 response (even if it had somehow arrived AFTER the sync's, which it didn't here)
      // have overwritten the sync's seq=2 result, since 1 < 2 is always discarded.
      expect(gate.tryApply(manualReadSeq)).toBe(false);
    });
  });
});

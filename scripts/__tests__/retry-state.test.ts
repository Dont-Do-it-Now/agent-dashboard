import { describe, expect, it } from 'vitest';
import { retryKey, transition } from '../utils/retry-state.js';
describe('retry state machine', () => {
  it('requires host evidence between accepted and running', () => {
    let m = { sessionId: 's', generation: 1, state: 'IDLE' as const, attempts: 0 };
    for (const event of ['quotaBlocked', 'wait', 'verify', 'dispatch', 'accepted'] as const) m = transition(m, event)!;
    expect(m.state).toBe('ACCEPTED');
    expect(transition(m, 'done')).toBeNull();
    expect(transition(m, 'turnStarted')?.state).toBe('RUNNING');
  });
  it('rejects stale generations and cancels races', () => {
    const m = { sessionId: 's', generation: 2, state: 'BLOCKED' as const, attempts: 0 };
    expect(transition(m, 'wait', 1)).toBeNull();
    expect(transition(m, 'cancel')?.state).toBe('CANCELLED');
    expect(retryKey('claude', 'a', 's', 2)).toBe('claude|a|s|2');
  });
});

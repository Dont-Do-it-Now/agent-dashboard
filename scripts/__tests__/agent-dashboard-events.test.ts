import { describe, expect, it } from 'vitest';
// @ts-expect-error - dependency-free hook module has no declaration file.
import { mapClaudeHookEvent, parseHookPayload } from '../../hooks/agent-dashboard-events.mjs';

describe('Agent Dashboard Claude Hook boundary', () => {
  it('maps only supported lifecycle events without retaining prompt content', () => {
    const payload = parseHookPayload('{"session_id":"session-1","prompt":"private text"}');

    expect(mapClaudeHookEvent('sessionStarted', payload)).toEqual({
      type: 'sessionStarted', provider: 'claude', sessionId: 'session-1',
    });
    expect(mapClaudeHookEvent('turnStarted', payload)).toEqual({
      type: 'turnStarted', provider: 'claude', sessionId: 'session-1',
    });
    expect(mapClaudeHookEvent('turnEnded', payload)).toEqual({
      type: 'turnEnded', provider: 'claude', sessionId: 'session-1',
    });
    expect(mapClaudeHookEvent('sessionEnded', payload)).toEqual({
      type: 'sessionEnded', provider: 'claude', sessionId: 'session-1',
    });
  });

  it('fails open for malformed, oversized, and unsupported payloads', () => {
    expect(parseHookPayload('{')).toBeNull();
    expect(parseHookPayload('x'.repeat(64 * 1024 + 1))).toBeNull();
    expect(mapClaudeHookEvent('userCancelled', { session_id: 'session-1' })).toBeNull();
    expect(mapClaudeHookEvent('sessionStarted', null)).toBeNull();
  });

  it('does not require a session identifier', () => {
    expect(mapClaudeHookEvent('sessionEnded', parseHookPayload('{}'))).toEqual({
      type: 'sessionEnded', provider: 'claude',
    });
  });
});

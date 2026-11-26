export type RetryState = 'IDLE' | 'BLOCKED' | 'WAITING' | 'VERIFYING' | 'DISPATCHING' | 'ACCEPTED' | 'RUNNING' | 'MANUAL_REQUIRED' | 'CANCELLED';
export type RetryEvent = 'quotaBlocked' | 'wait' | 'verify' | 'dispatch' | 'accepted' | 'turnStarted' | 'resetUnknown' | 'failed' | 'cancel' | 'sessionEnded' | 'done';
export interface RetryMachine { sessionId: string; generation: number; state: RetryState; attempts: number; }
const transitions: Record<RetryState, Partial<Record<RetryEvent, RetryState>>> = {
  IDLE: { quotaBlocked: 'BLOCKED' }, BLOCKED: { wait: 'WAITING', cancel: 'CANCELLED', sessionEnded: 'CANCELLED' }, WAITING: { verify: 'VERIFYING', resetUnknown: 'WAITING', cancel: 'CANCELLED', sessionEnded: 'CANCELLED' }, VERIFYING: { dispatch: 'DISPATCHING', failed: 'WAITING', cancel: 'CANCELLED' }, DISPATCHING: { accepted: 'ACCEPTED', failed: 'MANUAL_REQUIRED', cancel: 'CANCELLED' }, ACCEPTED: { turnStarted: 'RUNNING', failed: 'MANUAL_REQUIRED', cancel: 'CANCELLED' }, RUNNING: { done: 'IDLE', cancel: 'CANCELLED', sessionEnded: 'CANCELLED' }, MANUAL_REQUIRED: { cancel: 'CANCELLED' }, CANCELLED: {},
};
export function transition(machine: RetryMachine, event: RetryEvent, expectedGeneration = machine.generation): RetryMachine | null {
  if (machine.generation !== expectedGeneration) return null;
  const next = transitions[machine.state][event];
  if (!next) return null;
  return { ...machine, state: next, attempts: event === 'dispatch' ? machine.attempts + 1 : machine.attempts };
}
export function retryKey(provider: string, accountScope: string, sessionId: string, generation: number): string { return `${provider}|${accountScope}|${sessionId}|${generation}`; }

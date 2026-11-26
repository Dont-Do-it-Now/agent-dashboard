export interface RetrySchedule { jobId: string; provider: string; sessionId: string; generation: number; dueAt: number; expiresAt: number; attempts: number; status: 'scheduled' | 'cancelled' | 'expired'; }
export function scheduleRetry(input: Omit<RetrySchedule, 'dueAt' | 'status'> & { resetAt: number | null; delaySeconds: number; maxWaitMinutes: number }): RetrySchedule | null {
  if (input.resetAt === null) return null;
  const dueAt = input.resetAt + input.delaySeconds * 1000;
  return { jobId: input.jobId, provider: input.provider, sessionId: input.sessionId, generation: input.generation, dueAt, expiresAt: input.resetAt + input.maxWaitMinutes * 60_000, attempts: input.attempts, status: 'scheduled' };
}
export function cancelSchedule(schedule: RetrySchedule): RetrySchedule { return { ...schedule, status: 'cancelled' }; }

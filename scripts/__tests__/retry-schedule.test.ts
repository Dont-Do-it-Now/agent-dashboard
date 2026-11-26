import { describe, expect, it } from 'vitest';
import { cancelSchedule, scheduleRetry } from '../utils/retry-schedule.js';
describe('retry schedule', () => {
  it('uses UTC epoch due time and bounded expiry', () => {
    const job = scheduleRetry({ jobId: 'j', provider: 'claude', sessionId: 's', generation: 1, resetAt: Date.UTC(2026, 10, 26, 17), delaySeconds: 60, maxWaitMinutes: 360, attempts: 0 });
    expect(job?.dueAt).toBe(Date.UTC(2026, 10, 26, 17, 1));
    expect(cancelSchedule(job!).status).toBe('cancelled');
    expect(scheduleRetry({ jobId: 'j', provider: 'claude', sessionId: 's', generation: 1, resetAt: null, delaySeconds: 60, maxWaitMinutes: 1, attempts: 0 })).toBeNull();
  });
});

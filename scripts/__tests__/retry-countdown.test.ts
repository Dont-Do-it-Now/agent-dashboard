import { describe, expect, it } from 'vitest';
import { parseRetryCountdown } from '../widgets/retry-countdown.js';
describe('retry countdown widget', () => {
  it('shows bounded countdown only when explicitly enabled', () => {
    expect(parseRetryCountdown(false, 'WAIT', '120000', 0)).toBeNull();
    expect(parseRetryCountdown(true, 'WAIT', '120000', 0)?.minutes).toBe(2);
    expect(parseRetryCountdown(true, 'MANUAL', undefined, 0)?.minutes).toBeNull();
  });
});

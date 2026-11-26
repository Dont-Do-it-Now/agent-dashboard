import { describe, expect, it } from 'vitest';
import { forecastUsage, highestRiskForecast } from '../utils/usage-forecast.js';
import type { UsageSample } from '../utils/usage-history.js';

const make = (observedAt: number, usedPercent: number, extra: Partial<UsageSample> = {}): UsageSample => ({ provider: 'claude', accountScope: 'opaque', windowId: '5h', resetAt: 18_000_000, observedAt, usedPercent, source: 'test', freshness: 'fresh', ...extra });

describe('usage forecast', () => {
  it('calculates ETA and projected demand from the documented example', () => {
    const result = forecastUsage([make(0, 0), make(3_600_000, 20), make(7_200_000, 40)], '5h', { now: 3_600_000, minIntervalMinutes: 5 });
    expect(result.ratePercentPerHour).toBe(20);
    expect(result.etaHours).toBe(3);
    expect(result.projectedPercent).toBe(120);
  });
  it('returns unknown for zero rate, stale data, and reset boundaries', () => {
    expect(forecastUsage([make(0, 40), make(3_600_000, 40), make(7_200_000, 40)], '5h').reason).toBe('no-consumption');
    expect(forecastUsage([make(0, 20, { freshness: 'stale' })], '5h').reason).toBe('stale');
    expect(forecastUsage([make(0, 20, { resetAt: 1 }), make(3_600_000, 30, { resetAt: 2 }), make(7_200_000, 40, { resetAt: 2 })], '5h').reason).toBe('reset-boundary');
  });
  it('returns zero ETA at exhaustion and selects highest risk', () => {
    const exhausted = forecastUsage([make(0, 100), make(3_600_000, 100), make(7_200_000, 100)], '5h');
    expect(exhausted.etaHours).toBe(0);
    expect(highestRiskForecast([{ ...exhausted, etaHours: 0 }, { ...exhausted, windowId: '7d', etaHours: 4 }])?.windowId).toBe('5h');
  });
});

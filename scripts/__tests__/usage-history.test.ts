import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendUsageSample, canForecast, mergeUsageSample, normalizeUsageSample, opaqueAccountId } from '../utils/usage-history.js';

const sample = (overrides = {}) => normalizeUsageSample({ provider: 'claude', accountScope: 'secret@example.com', windowId: '5h', resetAt: 10_000, observedAt: 1_000, usedPercent: 20, source: 'oauth', freshness: 'fresh', ...overrides })!;

describe('usage history', () => {
  it('stores only an opaque account id and separates windows', () => {
    const value = sample();
    expect(value.accountScope).toBe(opaqueAccountId('claude', 'secret@example.com'));
    expect(value.accountScope).not.toContain('@');
    expect(normalizeUsageSample({ ...value, windowId: '7d' })?.windowId).toBe('7d');
  });
  it('rejects invalid or non-finite samples', () => {
    expect(normalizeUsageSample({ ...sample(), usedPercent: 101 })).toBeNull();
    expect(normalizeUsageSample({ ...sample(), observedAt: Infinity })).toBeNull();
  });
  it('deduplicates repeated values and orders reverse arrivals', () => {
    const first = sample({ observedAt: 2_000, usedPercent: 30 });
    const repeated = mergeUsageSample([first], sample({ observedAt: 1_000, usedPercent: 20 }), 3_000);
    expect(repeated.map((item) => item.observedAt)).toEqual([1_000, 2_000]);
    expect(mergeUsageSample(repeated, sample({ observedAt: 3_000, usedPercent: 20 }), 3_000).length).toBe(2);
  });
  it('blocks forecast for stale, unknown, or missing reset samples', () => {
    expect(canForecast(sample())).toBe(true);
    expect(canForecast(sample({ freshness: 'stale' }))).toBe(false);
    expect(canForecast(sample({ resetAt: null }))).toBe(false);
  });
  it('writes an atomic local history file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-dashboard-history-'));
    const path = join(dir, 'usage.json');
    expect(await appendUsageSample(path, sample())).toBe(true);
    expect(await appendUsageSample(path, sample())).toBe(false);
    expect(JSON.parse(await readFile(path, 'utf8'))).toHaveLength(1);
  });
});

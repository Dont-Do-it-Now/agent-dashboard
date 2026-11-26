import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '../core/snapshot.js';

const observedAt = '2026-11-26T00:00:00.000Z';
const base = { schemaVersion: 1, provider: 'codex', observedAt };
const limit = {
  provider: 'codex', windowSeconds: 18000, observedAt, source: 'host',
};

describe('normalized snapshot boundary', () => {
  it('rejects invalid required fields and unsupported schemas', () => {
    for (const value of [null, [], {}, { ...base, schemaVersion: 2 },
      { ...base, provider: '' }, { ...base, observedAt: 'yesterday' }]) {
      expect(parseSnapshot(value)).toBeNull();
    }
  });

  it('keeps unknown optional fields absent instead of inventing zeroes', () => {
    expect(parseSnapshot(base)).toEqual({ ...base, limits: [] });
    expect(parseSnapshot({ ...base, context: {}, tokens: {}, git: {}, cost: {} }))
      .toEqual({ ...base, limits: [] });
  });

  it('preserves known zero values, identity and optional metadata', () => {
    expect(parseSnapshot({
      ...base, threadId: 'thread-1', model: 'GPT', effort: 'high', cwd: '/project',
      git: { branch: 'main', dirty: false, ahead: 0, behind: 0 },
      context: { used: 0, total: 200000, usedPercent: 0 },
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, otherInput: 0 },
      cost: { amount: 0, currency: 'USD', kind: 'actual' },
    })).toEqual({
      ...base, threadId: 'thread-1', model: 'GPT', effort: 'high', cwd: '/project',
      limits: [], git: { branch: 'main', dirty: false, ahead: 0, behind: 0 },
      context: { used: 0, total: 200000, usedPercent: 0 },
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, otherInput: 0 },
      cost: { amount: 0, currency: 'USD', kind: 'actual' },
    });
  });

  it.each([NaN, Infinity, -1, '0', null])('discards invalid numerical data: %s', (value) => {
    expect(parseSnapshot({
      ...base, context: { used: value, total: value, usedPercent: value },
      tokens: { input: value, output: value },
      cost: { amount: value, currency: 'USD', kind: 'actual' },
      limits: [{ ...limit, usedPercent: value }],
    })).toEqual({ ...base, limits: [limit] });
  });

  it('bounds context percentages and counts without applying the quota bound', () => {
    expect(parseSnapshot({ ...base, context: { used: 11, total: 10, usedPercent: 101 } }))
      .toEqual({ ...base, limits: [], context: { total: 10 } });
    expect(parseSnapshot({ ...base, context: { used: 1.5, total: 0, usedPercent: 100 } }))
      .toEqual({ ...base, limits: [], context: { usedPercent: 100 } });
    expect(parseSnapshot({ ...base, limits: [{ ...limit, usedPercent: 125 }] })?.limits)
      .toEqual([{ ...limit, usedPercent: 125 }]);
  });

  it('preserves account scopes and time windows without inferring account identity', () => {
    const limits = [
      { ...limit, accountScope: 'account-a', usedPercent: 10 },
      { ...limit, accountScope: 'account-b', usedPercent: 20 },
      { ...limit, accountScope: 'account-a', windowSeconds: 604800, usedPercent: 30 },
      { ...limit, accountScope: '', limit_id: 'not-an-account', usedPercent: 0 },
    ];
    expect(parseSnapshot({ ...base, limits })?.limits).toEqual([
      limits[0], limits[1], limits[2], { ...limit, usedPercent: 0 },
    ]);
  });

  it('drops limits whose required provenance or window is invalid', () => {
    expect(parseSnapshot({ ...base, limits: [null, {}, { ...limit, source: '' },
      { ...limit, windowSeconds: 0 }, { ...limit, windowSeconds: 1.5 },
      { ...limit, provider: '' }, { ...limit, observedAt: 'invalid' }] })?.limits).toEqual([]);
  });

  it('normalizes explicit timestamps to UTC and hides invalid reset times', () => {
    expect(parseSnapshot({
      ...base, observedAt: '2026-11-26T09:00:00+09:00',
      limits: [{ ...limit, resetAt: '2026-11-26T10:00:00+09:00' }],
    })).toEqual({
      ...base, limits: [{ ...limit, resetAt: '2026-11-26T01:00:00.000Z' }],
    });
    for (const invalid of ['2026-02-30T00:00:00Z', '2026-11-26T24:00:00Z',
      '2026-11-26', '2026-11-26T00:00:00', 1795651200000]) {
      expect(parseSnapshot({ ...base, observedAt: invalid })).toBeNull();
      expect(parseSnapshot({ ...base, limits: [{ ...limit, resetAt: invalid }] })?.limits)
        .toEqual([limit]);
    }
  });

  it('requires explicit USD and actual/estimate cost meaning', () => {
    expect(parseSnapshot({ ...base, cost: { amount: 2.5, currency: 'USD', kind: 'estimate' } })?.cost)
      .toEqual({ amount: 2.5, currency: 'USD', kind: 'estimate' });
    for (const cost of [{ amount: 1 }, { amount: 1, currency: 'EUR', kind: 'actual' },
      { amount: 1, currency: 'USD', kind: 'unknown' }]) {
      expect(parseSnapshot({ ...base, cost })?.cost).toBeUndefined();
    }
  });

  it('does not mutate inputs or retain unsupported fields', () => {
    const context = Object.freeze({ used: 0, usedPercent: 0, unsupported: true });
    const input = Object.freeze({ ...base, context, secrets: 'do-not-retain' });
    expect(parseSnapshot(input)).toEqual({ ...base, limits: [], context: { used: 0, usedPercent: 0 } });
  });
});

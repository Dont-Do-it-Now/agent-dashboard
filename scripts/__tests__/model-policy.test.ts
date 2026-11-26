import { describe, expect, it } from 'vitest';
import { evaluateModelPolicy } from '../utils/model-policy.js';
import type { ExtensionConfig, ExtensionLevel } from '../types.js';

const levels: ExtensionLevel[] = [{ modelId: 'claude-sonnet', effort: 'medium' }, { modelId: 'claude-haiku', effort: 'low' }];
const config = (mode: 'off' | 'warn' | 'ask' | 'auto'): ExtensionConfig => ({ adaptive: { mode, cooldownMinutes: 10, providers: { claude: { levels: [levels[1]] } } } });
const input = (overrides = {}) => ({ provider: 'claude', projectedPercent: 100, confidence: 'high' as const, atTurnBoundary: true, sessionBusy: false, now: 100_000, ...overrides });

describe('model policy', () => {
  it('does not act when disabled or below threshold', () => {
    expect(evaluateModelPolicy(config('off'), input(), levels).action).toBe('none');
    expect(evaluateModelPolicy(config('warn'), input({ projectedPercent: 80 }), levels).action).toBe('none');
  });
  it('reports unsupported configured combinations without guessing', () => {
    expect(evaluateModelPolicy({ adaptive: { mode: 'warn', providers: { claude: { levels: [{ modelId: 'future', effort: 'max' }] } } } }, input(), levels).supported).toBe(false);
  });
  it('separates warn, ask, and safe auto actions', () => {
    expect(evaluateModelPolicy(config('warn'), input(), levels).action).toBe('warn');
    expect(evaluateModelPolicy(config('ask'), input({ projectedPercent: 120 }), levels).action).toBe('ask');
    expect(evaluateModelPolicy(config('auto'), input({ projectedPercent: 120 }), levels).action).toBe('auto');
    expect(evaluateModelPolicy(config('auto'), input({ sessionBusy: true }), levels).action).toBe('none');
    expect(evaluateModelPolicy(config('auto'), input({ confidence: 'medium' }), levels).action).toBe('none');
  });
  it('enforces cooldown and never acts below configured order', () => {
    expect(evaluateModelPolicy(config('auto'), input({ lastActionAt: 95_000 }), levels).reason).toBe('cooldown');
    expect(evaluateModelPolicy(config('auto'), input({ projectedPercent: 95 }), levels).action).toBe('none');
  });
});

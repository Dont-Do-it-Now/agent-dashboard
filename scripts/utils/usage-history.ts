import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type UsageWindowId = '5h' | '7d' | string;
export type SampleFreshness = 'fresh' | 'stale' | 'unknown';
export interface UsageSample {
  provider: string;
  accountScope: string;
  windowId: UsageWindowId;
  resetAt: number | null;
  observedAt: number;
  usedPercent: number;
  source: string;
  freshness: SampleFreshness;
}

export const HISTORY_MAX_PER_WINDOW = 2000;
export const HISTORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function opaqueAccountId(provider: string, accountScope: string): string {
  return createHash('sha256').update(`${provider}\0${accountScope}`).digest('hex').slice(0, 16);
}

export function normalizeUsageSample(input: Partial<UsageSample>): UsageSample | null {
  if (typeof input.provider !== 'string' || typeof input.accountScope !== 'string' || typeof input.windowId !== 'string' || typeof input.source !== 'string') return null;
  if (!Number.isFinite(input.observedAt) || !Number.isFinite(input.usedPercent) || input.usedPercent < 0 || input.usedPercent > 100) return null;
  const resetAt = input.resetAt === null || input.resetAt === undefined ? null : input.resetAt;
  if (resetAt !== null && (!Number.isFinite(resetAt) || resetAt < 0)) return null;
  const freshness = input.freshness ?? 'unknown';
  if (!['fresh', 'stale', 'unknown'].includes(freshness)) return null;
  return { provider: input.provider, accountScope: opaqueAccountId(input.provider, input.accountScope), windowId: input.windowId, resetAt, observedAt: input.observedAt, usedPercent: input.usedPercent, source: input.source, freshness };
}

export function canForecast(sample: UsageSample): boolean {
  return sample.freshness === 'fresh' && sample.resetAt !== null;
}

export function mergeUsageSample(history: UsageSample[], sample: UsageSample, now = Date.now()): UsageSample[] {
  const key = (item: UsageSample) => `${item.provider}|${item.accountScope}|${item.windowId}|${item.observedAt}`;
  const filtered = history.filter((item) => now - item.observedAt <= HISTORY_MAX_AGE_MS);
  const withoutDuplicate = filtered.filter((item) => key(item) !== key(sample));
  const sameValue = withoutDuplicate.some((item) => item.provider === sample.provider && item.accountScope === sample.accountScope && item.windowId === sample.windowId && item.usedPercent === sample.usedPercent && item.resetAt === sample.resetAt);
  const merged = (sameValue ? withoutDuplicate : [...withoutDuplicate, sample]).sort((a, b) => a.observedAt - b.observedAt);
  const counts = new Map<string, number>();
  return merged.filter((item) => {
    const group = `${item.provider}|${item.accountScope}|${item.windowId}`;
    const seen = counts.get(group) ?? 0;
    if (seen >= HISTORY_MAX_PER_WINDOW) return false;
    counts.set(group, seen + 1);
    return true;
  });
}

export async function appendUsageSample(path: string, sample: UsageSample): Promise<boolean> {
  await mkdir(dirname(path), { recursive: true });
  const lock = `${path}.lock`;
  const handle = await open(lock, 'wx');
  try {
    let history: UsageSample[] = [];
    try { history = JSON.parse(await readFile(path, 'utf8')) as UsageSample[]; } catch { /* first write or corrupt history */ }
    const next = mergeUsageSample(Array.isArray(history) ? history : [], sample);
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(next)}\n`, 'utf8');
    await rename(temp, path);
    return next.length > history.length;
  } finally {
    await handle.close();
    await unlink(lock).catch(() => undefined);
  }
}

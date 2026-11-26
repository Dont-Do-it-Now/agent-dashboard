/** Normalized data only. Host field mapping, I/O and caching belong outside core. */
export interface ContextUsage {
  readonly used?: number;
  readonly total?: number;
  readonly usedPercent?: number;
}

export interface TokenUsage {
  readonly input?: number;
  readonly output?: number;
  readonly cacheRead?: number;
  readonly cacheWrite?: number;
  readonly otherInput?: number;
}

export interface GitStatus {
  readonly branch?: string;
  readonly dirty?: boolean;
  readonly ahead?: number;
  readonly behind?: number;
}

export interface UsageLimit {
  readonly provider: string;
  /** Supplied only by an adapter with a verified account identifier. Never inferred. */
  readonly accountScope?: string;
  readonly windowSeconds: number;
  readonly usedPercent?: number;
  readonly resetAt?: string;
  readonly observedAt: string;
  readonly source: string;
}

export interface UsageCost {
  readonly amount: number;
  readonly currency: 'USD';
  readonly kind: 'actual' | 'estimate';
}

export interface Snapshot {
  readonly schemaVersion: 1;
  readonly provider: string;
  readonly threadId?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly cwd?: string;
  readonly git?: GitStatus;
  readonly context?: ContextUsage;
  readonly limits: readonly UsageLimit[];
  readonly tokens?: TokenUsage;
  readonly cost?: UsageCost;
  readonly observedAt: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function nonnegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function count(value: unknown): number | undefined {
  const parsed = nonnegative(value);
  return parsed !== undefined && Number.isSafeInteger(parsed) ? parsed : undefined;
}

function numbers<K extends string>(value: Record<string, unknown>, keys: readonly K[]): Partial<Record<K, number>> {
  const result: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const parsed = count(value[key]);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result;
}

function strings<K extends string>(value: Record<string, unknown>, keys: readonly K[]): Partial<Record<K, string>> {
  const result: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const parsed = text(value[key]);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result;
}

/** Require an explicit ISO timezone, reject calendar overflow, and emit UTC ISO. */
function timestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return undefined;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  const parsed = new Date(value);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(parsed.getTime()) ||
      date.toISOString().slice(0, 10) !== match[1]) return undefined;
  return parsed.toISOString();
}

function parseContext(value: unknown): ContextUsage | undefined {
  const input = record(value);
  if (!input) return undefined;
  const result: { used?: number; total?: number; usedPercent?: number } = numbers(input, ['used', 'total']);
  if (result.total === 0) delete result.total;
  if (result.used !== undefined && result.total !== undefined && result.used > result.total) delete result.used;
  const percent = nonnegative(input.usedPercent);
  if (percent !== undefined && percent <= 100) result.usedPercent = percent;
  return Object.keys(result).length ? result : undefined;
}

function parseTokens(value: unknown): TokenUsage | undefined {
  const input = record(value);
  if (!input) return undefined;
  const result = numbers(input, ['input', 'output', 'cacheRead', 'cacheWrite', 'otherInput']);
  return Object.keys(result).length ? result : undefined;
}

function parseGit(value: unknown): GitStatus | undefined {
  const input = record(value);
  if (!input) return undefined;
  const result = {
    ...strings(input, ['branch']), ...numbers(input, ['ahead', 'behind']),
    ...(typeof input.dirty === 'boolean' ? { dirty: input.dirty } : {}),
  };
  return Object.keys(result).length ? result : undefined;
}

function parseLimit(value: unknown): UsageLimit | undefined {
  const input = record(value);
  if (!input) return undefined;
  const provider = text(input.provider);
  const source = text(input.source);
  const observedAt = timestamp(input.observedAt);
  const windowSeconds = count(input.windowSeconds);
  if (!provider || !source || !observedAt || windowSeconds === undefined || windowSeconds === 0) return undefined;
  const usedPercent = nonnegative(input.usedPercent);
  const resetAt = timestamp(input.resetAt);
  return {
    provider, source, observedAt, windowSeconds, ...strings(input, ['accountScope']),
    ...(usedPercent !== undefined ? { usedPercent } : {}), ...(resetAt ? { resetAt } : {}),
  };
}

function parseCost(value: unknown): UsageCost | undefined {
  const input = record(value);
  if (!input) return undefined;
  const amount = nonnegative(input.amount);
  return amount !== undefined && input.currency === 'USD' && (input.kind === 'actual' || input.kind === 'estimate')
    ? { amount, currency: 'USD', kind: input.kind } : undefined;
}

/** Invalid required metadata rejects the snapshot; invalid optional values stay absent. */
export function parseSnapshot(value: unknown): Snapshot | null {
  const input = record(value);
  if (!input || input.schemaVersion !== 1) return null;
  const provider = text(input.provider);
  const observedAt = timestamp(input.observedAt);
  if (!provider || !observedAt) return null;
  const git = parseGit(input.git);
  const context = parseContext(input.context);
  const tokens = parseTokens(input.tokens);
  const cost = parseCost(input.cost);
  const limits = Array.isArray(input.limits)
    ? input.limits.map(parseLimit).filter((limit): limit is UsageLimit => limit !== undefined) : [];
  return {
    schemaVersion: 1, provider, observedAt, limits,
    ...strings(input, ['threadId', 'model', 'effort', 'cwd']),
    ...(git ? { git } : {}), ...(context ? { context } : {}),
    ...(tokens ? { tokens } : {}), ...(cost ? { cost } : {}),
  };
}

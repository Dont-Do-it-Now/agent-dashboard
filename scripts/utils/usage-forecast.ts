import type { UsageSample } from './usage-history.js';

export interface UsageForecast {
  windowId: string;
  usedPercent: number;
  ratePercentPerHour: number | null;
  etaHours: number | null;
  projectedPercent: number | null;
  hoursUntilReset: number | null;
  confidence: 'low' | 'medium' | 'high';
  reason?: 'insufficient-samples' | 'stale' | 'reset-boundary' | 'no-consumption';
}

export interface ForecastOptions { now?: number; windowMinutes?: number; minSamples?: number; minIntervalMinutes?: number; }

export function forecastUsage(samples: UsageSample[], windowId: string, options: ForecastOptions = {}): UsageForecast {
  const now = options.now ?? Date.now();
  const minSamples = options.minSamples ?? 3;
  const minInterval = (options.minIntervalMinutes ?? 5) * 60_000;
  const candidates = samples.filter((sample) => sample.windowId === windowId && sample.freshness === 'fresh').sort((a, b) => a.observedAt - b.observedAt);
  const latest = candidates.at(-1);
  if (!latest) return { windowId, usedPercent: 0, ratePercentPerHour: null, etaHours: null, projectedPercent: null, hoursUntilReset: null, confidence: 'low', reason: 'stale' };
  const sameReset = candidates.filter((sample) => sample.resetAt === latest.resetAt && (options.windowMinutes === undefined || now - sample.observedAt <= options.windowMinutes * 60_000));
  const hoursUntilReset = latest.resetAt === null ? null : Math.max(0, (latest.resetAt - now) / 3_600_000);
  if (sameReset.length < minSamples) return { windowId, usedPercent: latest.usedPercent, ratePercentPerHour: null, etaHours: null, projectedPercent: null, hoursUntilReset, confidence: 'low', reason: latest.resetAt !== null && candidates.some((sample) => sample.resetAt !== latest.resetAt) ? 'reset-boundary' : 'insufficient-samples' };
  const first = sameReset[0];
  const elapsedHours = (latest.observedAt - first.observedAt) / 3_600_000;
  if (elapsedHours <= 0 || latest.observedAt - first.observedAt < minInterval) return { windowId, usedPercent: latest.usedPercent, ratePercentPerHour: null, etaHours: null, projectedPercent: null, hoursUntilReset, confidence: 'low', reason: 'insufficient-samples' };
  const rate = (latest.usedPercent - first.usedPercent) / elapsedHours;
  const confidence = elapsedHours >= 1 && sameReset.length >= 4 ? 'high' : 'medium';
  if (latest.usedPercent >= 100) return { windowId, usedPercent: latest.usedPercent, ratePercentPerHour: Math.max(0, rate), etaHours: 0, projectedPercent: hoursUntilReset === null ? null : latest.usedPercent, hoursUntilReset, confidence };
  if (rate <= 0) return { windowId, usedPercent: latest.usedPercent, ratePercentPerHour: rate, etaHours: null, projectedPercent: hoursUntilReset === null ? null : latest.usedPercent, hoursUntilReset, confidence, reason: 'no-consumption' };
  return { windowId, usedPercent: latest.usedPercent, ratePercentPerHour: rate, etaHours: (100 - latest.usedPercent) / rate, projectedPercent: hoursUntilReset === null ? null : latest.usedPercent + rate * hoursUntilReset, hoursUntilReset, confidence };
}

export function highestRiskForecast(forecasts: UsageForecast[]): UsageForecast | null {
  return forecasts.filter((forecast) => forecast.etaHours !== null).sort((a, b) => (a.etaHours! - b.etaHours!))[0] ?? null;
}

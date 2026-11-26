import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ExtensionConfig, ExtensionLevel, ExtensionMode } from '../types.js';

export interface ExtensionConfigResult { config?: ExtensionConfig; diagnostics: string[]; }

const integer = (value: unknown, min: number, max: number) => Number.isFinite(value) && Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const bool = (value: unknown) => typeof value === 'boolean';

function levels(value: unknown, diagnostics: string[], provider: string): ExtensionLevel[] | undefined {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== 'object' || typeof (item as any).modelId !== 'string' || typeof (item as any).effort !== 'string')) {
    diagnostics.push(`adaptive.providers.${provider}.levels is invalid`);
    return undefined;
  }
  return value.map((item) => ({ ...(item as object), modelId: (item as any).modelId, effort: (item as any).effort }));
}

export function normalizeExtensionConfig(value: unknown): ExtensionConfigResult {
  if (value === undefined) return { diagnostics: [] };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { diagnostics: ['extension must be an object'] };
  const source = value as Record<string, any>;
  const diagnostics: string[] = [];
  const result: ExtensionConfig = { ...source };

  if (source.forecast !== undefined) {
    const input = source.forecast;
    if (!input || typeof input !== 'object' || Array.isArray(input)) { diagnostics.push('extension.forecast is invalid'); result.forecast = { enabled: false }; }
    else {
      const out = { ...input } as any;
      let valid = true;
      if (input.enabled !== undefined && !bool(input.enabled)) valid = false;
      if (input.windowMinutes !== undefined && !integer(input.windowMinutes, 1, 10080)) valid = false;
      if (input.minSamples !== undefined && !integer(input.minSamples, 1, 100000)) valid = false;
      if (input.warningPercent !== undefined && !integer(input.warningPercent, 1, 100)) valid = false;
      if (!valid) { diagnostics.push('extension.forecast contains invalid values'); out.enabled = false; }
      result.forecast = out;
    }
  }
  if (source.adaptive !== undefined) {
    const input = source.adaptive;
    if (!input || typeof input !== 'object' || Array.isArray(input)) { diagnostics.push('extension.adaptive is invalid'); result.adaptive = { mode: 'off' }; }
    else {
      const out = { ...input } as any;
      let valid = true;
      if (input.mode !== undefined && !(['off', 'warn', 'ask', 'auto'] as ExtensionMode[]).includes(input.mode)) valid = false;
      if (input.cooldownMinutes !== undefined && !integer(input.cooldownMinutes, 1, 1440)) valid = false;
      if (input.restoreAfterReset !== undefined && !bool(input.restoreAfterReset)) valid = false;
      if (input.providers !== undefined) {
        if (!input.providers || typeof input.providers !== 'object' || Array.isArray(input.providers)) valid = false;
        else out.providers = Object.fromEntries(Object.entries(input.providers).map(([provider, config]) => {
          if (!config || typeof config !== 'object' || Array.isArray(config)) { diagnostics.push(`adaptive.providers.${provider} is invalid`); return [provider, { levels: [] }]; }
          const providerOut = { ...(config as any) };
          if ((config as any).levels !== undefined) providerOut.levels = levels((config as any).levels, diagnostics, provider) ?? [];
          return [provider, providerOut];
        }));
      }
      if (!valid) { diagnostics.push('extension.adaptive contains invalid values'); out.mode = 'off'; }
      result.adaptive = out;
    }
  }
  if (source.retry !== undefined) {
    const input = source.retry;
    if (!input || typeof input !== 'object' || Array.isArray(input)) { diagnostics.push('extension.retry is invalid'); result.retry = { enabled: false }; }
    else {
      const out = { ...input } as any;
      let valid = true;
      if (input.enabled !== undefined && !bool(input.enabled)) valid = false;
      if (input.resetDelaySeconds !== undefined && !integer(input.resetDelaySeconds, 0, 600)) valid = false;
      if (input.maxAttempts !== undefined && !integer(input.maxAttempts, 1, 10)) valid = false;
      if (input.maxWaitMinutes !== undefined && !integer(input.maxWaitMinutes, 1, 10080)) valid = false;
      if (input.verifyReset !== undefined && !bool(input.verifyReset)) valid = false;
      if (input.prompt !== undefined && typeof input.prompt !== 'string') valid = false;
      if (!valid) { diagnostics.push('extension.retry contains invalid values'); out.enabled = false; }
      result.retry = out;
    }
  }
  return { config: result, diagnostics };
}

export async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const lock = `${path}.lock`;
  const handle = await open(lock, 'wx');
  try {
    const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temp, path);
  } finally {
    await handle.close();
    await unlink(lock).catch(() => undefined);
  }
}

export async function readJsonConfig(path: string): Promise<ExtensionConfigResult & { raw?: Record<string, unknown> }> {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    const normalized = normalizeExtensionConfig(raw.extension);
    return { ...normalized, raw };
  } catch {
    return { diagnostics: ['configuration is unreadable'] };
  }
}

import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeExtensionConfig, writeJsonAtomically } from '../utils/extension-config.js';

describe('extension configuration contract', () => {
  it('keeps legacy omission and unknown keys', () => {
    expect(normalizeExtensionConfig(undefined)).toEqual({ diagnostics: [] });
    const result = normalizeExtensionConfig({ retry: { enabled: false }, vendorFlag: true });
    expect(result.config?.vendorFlag).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });
  it('disables only invalid automation sections', () => {
    const result = normalizeExtensionConfig({ forecast: { enabled: true, windowMinutes: 0 }, retry: { enabled: true, maxAttempts: 99 }, adaptive: { mode: 'bad' } });
    expect(result.config?.forecast?.enabled).toBe(false);
    expect(result.config?.retry?.enabled).toBe(false);
    expect(result.config?.adaptive?.mode).toBe('off');
    expect(result.diagnostics.length).toBe(3);
  });
  it('writes a complete file atomically', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'agent-dashboard-config-'));
    const path = join(dir, 'config.json');
    await writeJsonAtomically(path, { extension: { retry: { enabled: false } } });
    expect(JSON.parse(await readFile(path, 'utf8')).extension.retry.enabled).toBe(false);
  });
});

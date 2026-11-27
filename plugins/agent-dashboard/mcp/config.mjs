import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const PRESETS = new Set(['compact', 'normal', 'detailed']);

function defaultConfigPath() {
  if (process.env.AGENT_DASHBOARD_CODEX_CONFIG) {
    return process.env.AGENT_DASHBOARD_CODEX_CONFIG;
  }
  const configRoot = process.platform === 'win32'
    ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
    : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
  return path.join(configRoot, 'agent-dashboard', 'codex-statusline.json');
}

export function loadConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(defaultConfigPath(), 'utf8'));
    const preset = PRESETS.has(parsed?.preset) ? parsed.preset : 'detailed';
    return { preset };
  } catch {
    return { preset: 'detailed' };
  }
}

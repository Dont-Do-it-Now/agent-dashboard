import type { ExtensionConfig, ExtensionLevel, ExtensionMode } from '../types.js';

export interface ModelPolicyInput {
  provider: string;
  currentModelId?: string;
  currentEffort?: string;
  projectedPercent: number | null;
  confidence: 'low' | 'medium' | 'high';
  atTurnBoundary: boolean;
  sessionBusy: boolean;
  lastActionAt?: number;
  now?: number;
  sharedQuotaKey?: string;
}
export interface ModelPolicyResult { mode: ExtensionMode; action: 'none' | 'warn' | 'ask' | 'auto'; level?: ExtensionLevel; reason: string; supported: boolean; }

export function evaluateModelPolicy(config: ExtensionConfig | undefined, input: ModelPolicyInput, supportedLevels: ExtensionLevel[]): ModelPolicyResult {
  const adaptive = config?.adaptive;
  const mode = adaptive?.mode ?? 'off';
  const configured = adaptive?.providers?.[input.provider]?.levels ?? [];
  if (mode === 'off' || configured.length === 0) return { mode, action: 'none', reason: 'policy-disabled', supported: true };
  const unsupported = configured.find((level) => !supportedLevels.some((supported) => supported.modelId === level.modelId && supported.effort === level.effort));
  if (unsupported) return { mode, action: 'none', reason: 'configured-level-unsupported', supported: false };
  const projected = input.projectedPercent ?? 0;
  if (projected < 85) return { mode, action: 'none', reason: 'below-warning-threshold', supported: true };
  const level = configured[0];
  const cooldown = (adaptive.cooldownMinutes ?? 10) * 60_000;
  if (input.lastActionAt !== undefined && (input.now ?? Date.now()) - input.lastActionAt < cooldown) return { mode, action: 'none', level, reason: 'cooldown', supported: true };
  if (mode === 'warn') return { mode, action: 'warn', level, reason: projected >= 95 ? 'switch-recommended' : 'warning-threshold', supported: true };
  if (mode === 'ask') return { mode, action: 'ask', level, reason: projected >= 95 ? 'user-confirmation-required' : 'warning-threshold', supported: true };
  if (mode === 'auto' && projected >= 110 && input.confidence === 'high' && input.atTurnBoundary && !input.sessionBusy) return { mode, action: 'auto', level, reason: 'verified-turn-boundary', supported: true };
  return { mode, action: 'none', level, reason: 'auto-safety-gate', supported: true };
}

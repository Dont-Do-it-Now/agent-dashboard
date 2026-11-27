#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { loadConfig } from './config.mjs';

const URI = 'ui://agent-dashboard/statusline';
const TOOL_NAME = 'agent-dashboard-statusline';
const sessionStarts = new Map();

const text = (value, color = null) => ({
  type: 'text',
  props: color ? { color } : undefined,
  children: [String(value)],
});

function contextBar(value) {
  if (!Number.isFinite(value)) return null;
  const bounded = Math.max(0, Math.min(100, value));
  const filled = Math.round(bounded / 10);
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${Math.round(value)}%`;
}

function remainingPercent(window) {
  if (!window || !Number.isFinite(window.used_percent)) return null;
  return Math.max(0, 100 - window.used_percent);
}

function formatTokens(value) {
  if (!Number.isFinite(value)) return null;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function formatDuration(milliseconds) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h${minutes % 60}m`;
}

function tokenTotal(total) {
  if (!total || typeof total !== 'object') return null;
  const fields = ['input_tokens', 'cache_read_tokens', 'cache_write_tokens', 'other_input_tokens', 'output_tokens'];
  const values = fields.map((field) => total[field]).filter(Number.isFinite);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
}

function gitBranch(cwd) {
  if (!cwd) return null;
  try {
    const branch = execFileSync('git', ['-C', cwd, 'branch', '--show-current'], {
      encoding: 'utf8',
      timeout: 250,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

function resetLabel(window) {
  if (!window || !Number.isFinite(window.resets_at)) return null;
  const seconds = Math.max(0, Math.round(window.resets_at - Date.now() / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function rateLimit(state, minutes) {
  for (const account of state?.account?.rate_limits ?? []) {
    for (const window of [account.primary_limit, account.secondary_limit]) {
      if (window?.window_minutes === minutes) return window;
    }
  }
  return null;
}

function row(children) {
  return { type: 'row', props: { gap: 1, wrap: 'wrap' }, children };
}

function render(state, config = loadConfig()) {
  const thread = state?.thread ?? {};
  const model = thread.model?.display_name || 'Codex';
  const context = thread.usage?.context;
  const usedTokens = formatTokens(context?.used_tokens);
  const contextWindow = formatTokens(context?.context_window_size);
  const cost = thread.usage?.cost?.total_cost_usd;
  const primary = rateLimit(state, 300);
  const secondary = rateLimit(state, 10080);
  const workspace = thread.workspace?.cwd || thread.name;
  const workspaceLabel = thread.name || workspace?.split(/[\\/]/).filter(Boolean).pop();
  const runState = thread.agent?.state;
  const sessionId = thread.id || workspace || 'default';
  const startedAt = sessionStarts.get(sessionId) ?? Date.now();
  sessionStarts.set(sessionId, startedAt);
  const elapsedMs = Date.now() - startedAt;
  const totalTokens = tokenTotal(thread.usage?.total);
  const burnRate = totalTokens !== null && elapsedMs >= 60_000
    ? Math.round(totalTokens / (elapsedMs / 60_000))
    : null;
  const branch = gitBranch(workspace);

  const modelText = text(`◆ ${model}`, 'status-model');
  const contextText = contextBar(context?.used_percentage)
    ? text(`ctx ${contextBar(context.used_percentage)}`, 'status-usage')
    : null;
  const tokensText = usedTokens && contextWindow
    ? text(`${usedTokens}/${contextWindow}`, 'status-usage')
    : null;
  const costText = Number.isFinite(cost) ? text(`$${cost.toFixed(2)}`, 'status-metadata') : null;
  const limitText = (label, window) => {
    const remaining = remainingPercent(window);
    if (remaining === null) return null;
    const reset = resetLabel(window);
    return text(`${label}: ${Math.round(remaining)}%${reset ? ` (${reset})` : ''}`, 'status-limit');
  };
  const limits = [limitText('5h', primary), limitText('7d', secondary)].filter(Boolean);
  const firstLine = [modelText, contextText, tokensText, costText, ...limits].filter(Boolean);

  if (config.preset === 'compact') {
    return row([modelText, contextText, ...limits, runState ? text(runState, 'status-state') : null].filter(Boolean));
  }
  const projectText = workspaceLabel
    ? text(`📁 ${workspaceLabel}${branch ? ` (${branch})` : ''}`, 'status-path')
    : text('📁 —', 'status-path');
  const durationText = text(`⏱ ${formatDuration(elapsedMs)}`, 'status-metadata');
  const burnText = burnRate === null ? text('🔥 —/min', 'status-metadata') : text(`🔥 ${formatTokens(burnRate)}/min`, 'status-metadata');
  const stateText = runState ? text(runState, 'status-state') : text('state —', 'status-state');
  const normalLine = [projectText, durationText, burnText, text('Todos: —', 'status-metadata'), stateText];
  if (config.preset === 'normal') {
    return { type: 'col', props: { gap: 0 }, children: [row(firstLine), row(normalLine)] };
  }
  const secondLine = [
    ...normalLine,
    text('Tools: —', 'status-metadata'),
    text('Retry: manual', 'status-metadata'),
    state?.app?.cli_version ? text(`Codex ${state.app.cli_version}`, 'status-metadata') : null,
  ].filter(Boolean);
  return { type: 'col', props: { gap: 0 }, children: [row(firstLine), row(secondLine)] };
}

const TOOL = {
  name: TOOL_NAME,
  title: 'Agent Dashboard',
  description: 'Render Agent Dashboard usage and thread state in the Codex footer.',
  inputSchema: { type: 'object', properties: {} },
  _meta: {
    'openai/ui': { entrypoints: [{ type: 'statusline', resourceUri: URI }] },
  },
};

function respond(method, params = {}) {
  if (method === 'initialize') {
    return {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: 'agent-dashboard', version: '0.1.5' },
    };
  }
  if (method === 'ping') return {};
  if (method === 'tools/list') return { tools: [TOOL] };
  if (method === 'tools/call') {
    if (params.name !== TOOL_NAME) throw new Error('Unknown tool name');
    return { content: [{ type: 'text', text: `Statusline resource: ${URI}` }] };
  }
  if (method === 'resources/list') {
    return { resources: [{ name: 'statusline', uri: URI, mimeType: 'application/json' }] };
  }
  if (method === 'resources/templates/list') return { resourceTemplates: [] };
  if (method === 'resources/read') {
    if (params.uri !== URI) throw new Error('Unknown resource URI');
    const state = params._meta?.['com.openai/codex-statusline-state'] ?? {};
    return {
      contents: [{ uri: URI, mimeType: 'application/json', text: JSON.stringify(render(state)) }],
    };
  }
  throw new Error(`Method not found: ${method}`);
}

process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  while (true) {
    const newline = buffer.indexOf('\n');
    if (newline < 0) break;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let response = { jsonrpc: '2.0', id: null };
    try {
      const request = JSON.parse(line);
      if (!request || typeof request.method !== 'string') {
        response.error = { code: -32600, message: 'Invalid request' };
      } else if (!Object.prototype.hasOwnProperty.call(request, 'id')) {
        continue;
      } else {
        response.id = request.id;
        response.result = respond(request.method, request.params ?? {});
      }
    } catch (error) {
      response.error = {
        code: error instanceof SyntaxError ? -32700 : -32602,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
});

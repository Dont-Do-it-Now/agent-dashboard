#!/usr/bin/env node

const URI = 'ui://agent-dashboard/statusline';
const TOOL_NAME = 'agent-dashboard-statusline';

const text = (value, color = null) => ({
  type: 'text',
  props: color ? { color } : undefined,
  children: [String(value)],
});

function percent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : null;
}

function remainingPercent(window) {
  if (!window || !Number.isFinite(window.used_percent)) return null;
  return Math.max(0, 100 - window.used_percent);
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

function render(state) {
  const thread = state?.thread ?? {};
  const account = state?.account ?? {};
  const model = thread.model?.display_name || 'Codex';
  const context = thread.usage?.context;
  const children = [text(`◆ ${model}`, 'status-model')];

  const used = percent(context?.used_percentage);
  if (used) children.push(text(`ctx ${used}`, 'status-usage'));

  const primary = account.rate_limits?.[0]?.primary_limit;
  const secondary = account.rate_limits?.[0]?.secondary_limit;
  const primaryRemaining = remainingPercent(primary);
  const secondaryRemaining = remainingPercent(secondary);
  if (primaryRemaining !== null) {
    const reset = resetLabel(primary);
    children.push(text(`5h ${Math.round(primaryRemaining)}%${reset ? ` (${reset})` : ''}`, 'status-limit'));
  }
  if (secondaryRemaining !== null) {
    const reset = resetLabel(secondary);
    children.push(text(`7d ${Math.round(secondaryRemaining)}%${reset ? ` (${reset})` : ''}`, 'status-limit'));
  }

  const runState = thread.agent?.state;
  if (runState) children.push(text(runState, 'status-state'));
  return { type: 'row', props: { gap: 1, wrap: 'wrap' }, children };
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
      serverInfo: { name: 'agent-dashboard', version: '0.1.4' },
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

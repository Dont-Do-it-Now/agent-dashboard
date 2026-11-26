#!/usr/bin/env node
/**
 * Claude Hook boundary for Agent Dashboard.
 *
 * This adapter deliberately has no persistence or control side effects. It only
 * validates host payloads and maps documented Claude lifecycle events to internal
 * names. Later opt-in collectors can consume those names without changing the
 * host hook contract.
 */

const MAX_INPUT_BYTES = 64 * 1024;

const EVENT_NAMES = {
  sessionStarted: 'sessionStarted',
  turnStarted: 'turnStarted',
  turnEnded: 'turnEnded',
  sessionEnded: 'sessionEnded',
};

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** Return a bounded JSON object, or null for malformed and oversized payloads. */
export function parseHookPayload(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_INPUT_BYTES) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Map only documented host lifecycle names. Stop means a completed response,
 * not a user cancellation. Unknown host events stay unavailable.
 */
export function mapClaudeHookEvent(eventName, payload) {
  const type = EVENT_NAMES[eventName];
  if (!type || !payload) return null;

  return {
    type,
    provider: 'claude',
    ...(nonEmptyText(payload.session_id) ? { sessionId: payload.session_id } : {}),
  };
}

async function readStdin() {
  let size = 0;
  const chunks = [];
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_INPUT_BYTES) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  try {
    const raw = await readStdin();
    mapClaudeHookEvent(process.argv[2], raw === null ? null : parseHookPayload(raw));
  } catch {
    // Hooks are observational. A malformed payload or local failure must not block Claude.
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}

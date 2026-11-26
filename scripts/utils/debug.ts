/**
 * Debug utilities for agent-dashboard
 * @handbook 6.3-debug-mode
 *
 * Enable debug logging by setting DEBUG=agent-dashboard or DEBUG=1
 */

const DEBUG =
  process.env.DEBUG === 'agent-dashboard' ||
  process.env.DEBUG === '1' ||
  process.env.DEBUG === 'true';

/**
 * Log debug message if DEBUG is enabled
 */
export function debugLog(context: string, message: string, error?: unknown): void {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString();
  const prefix = `[agent-dashboard:${context}]`;

  if (error) {
    console.error(`${timestamp} ${prefix} ${message}`, error);
  } else {
    console.log(`${timestamp} ${prefix} ${message}`);
  }
}

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return DEBUG;
}

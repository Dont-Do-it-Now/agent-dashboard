import type { Widget } from './base.js';
import type { RetryCountdownData, WidgetContext } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

export const retryCountdownWidget: Widget<RetryCountdownData> = {
  id: 'retryCountdown',
  name: 'Retry Countdown',
  async getData(ctx: WidgetContext): Promise<RetryCountdownData | null> {
    return parseRetryCountdown(ctx.config.extension?.retry?.enabled === true, process.env.AGENT_DASHBOARD_RETRY_STATUS, process.env.AGENT_DASHBOARD_RETRY_DUE_AT, Date.now());
  },
  render(data, _ctx) {
    const time = data.minutes === null ? 'unknown' : data.minutes <= 0 ? 'now' : `${data.minutes}m`;
    const label = data.status === 'MANUAL' ? 'Reset' : data.status;
    return colorize(`${label} ${time}`, getTheme().warning);
  },
};

export function parseRetryCountdown(enabled: boolean, status: string | undefined, dueAtValue: string | undefined, now: number): RetryCountdownData | null {
  if (!enabled || !status || !['WAIT', 'QUEUED', 'RESUMING', 'AUTO', 'MANUAL'].includes(status)) return null;
  const dueAt = Number(dueAtValue);
  return { status: status as RetryCountdownData['status'], minutes: Number.isFinite(dueAt) ? Math.max(0, Math.ceil((dueAt - now) / 60_000)) : null };
}

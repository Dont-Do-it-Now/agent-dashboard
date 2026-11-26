import { toPlainText, type DisplayLine, type SemanticColor } from '../core/display.js';

const COLORS: Record<SemanticColor, string> = {
  model: '\u001b[36m',
  path: '\u001b[34m',
  branch: '\u001b[35m',
  usage: '\u001b[32m',
  limit: '\u001b[33m',
  metadata: '\u001b[90m',
};

/** Callers decide host color capability; the renderer does not read process.env. */
export function renderAnsi(line: DisplayLine, options: { color?: boolean } = {}): string {
  if (options.color === false) return toPlainText(line);

  return line.map((segment) => {
    if (!segment.text || !segment.color) return segment.text;
    return `${COLORS[segment.color]}${segment.text}\u001b[0m`;
  }).join('');
}

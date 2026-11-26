import type { DisplayLine, SemanticColor } from '../core/display.js';

// Independently defined subset of the pinned contract documented in
// docs/01-foundation/codex-contract.md. This is a renderer, not an MCP adapter.
export interface CodexText {
  readonly type: 'text';
  readonly props: { readonly color?: `status-${SemanticColor}` };
  readonly children: readonly string[];
}

export interface CodexRow {
  readonly type: 'row';
  readonly props: { readonly gap: number };
  readonly children: readonly CodexText[];
}

export function renderCodex(line: DisplayLine): CodexRow | null {
  const children: CodexText[] = line
    .filter((segment) => segment.text !== '')
    .map((segment): CodexText => ({
      type: 'text',
      props: segment.color ? { color: `status-${segment.color}` } : {},
      children: [segment.text],
    }));

  return children.length === 0 ? null : { type: 'row', props: { gap: 0 }, children };
}

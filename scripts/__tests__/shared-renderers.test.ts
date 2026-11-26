import { describe, expect, it } from 'vitest';
import { toPlainText, type DisplayLine } from '../core/display.js';
import { renderAnsi } from '../renderers/ansi.js';
import { renderCodex } from '../renderers/codex.js';

// Synthetic display fixture: no provider snapshot or credentials are involved.
const line: DisplayLine = [
  { text: 'GPT High', color: 'model' },
  { text: ' | ' },
  { text: 'Ctx 0%', color: 'usage' },
  { text: ' | ' },
  { text: '5h 47%', color: 'limit' },
];

describe('shared renderer boundary', () => {
  it('preserves text order and known zero values in the pure core', () => {
    expect(toPlainText(line)).toBe('GPT High | Ctx 0% | 5h 47%');
  });

  it('renders the same fixture as ANSI with isolated semantic colors', () => {
    expect(renderAnsi(line)).toBe(
      '\u001b[36mGPT High\u001b[0m | \u001b[32mCtx 0%\u001b[0m | \u001b[33m5h 47%\u001b[0m',
    );
    expect(renderAnsi(line, { color: false })).toBe('GPT High | Ctx 0% | 5h 47%');
  });

  it('renders the same fixture as a Codex row without ANSI or added gaps', () => {
    expect(renderCodex(line)).toEqual({
      type: 'row',
      props: { gap: 0 },
      children: [
        { type: 'text', props: { color: 'status-model' }, children: ['GPT High'] },
        { type: 'text', props: {}, children: [' | '] },
        { type: 'text', props: { color: 'status-usage' }, children: ['Ctx 0%'] },
        { type: 'text', props: {}, children: [' | '] },
        { type: 'text', props: { color: 'status-limit' }, children: ['5h 47%'] },
      ],
    });
    expect(JSON.stringify(renderCodex(line))).not.toContain('\\u001b');
  });

  it('clears empty output instead of producing an empty host element', () => {
    expect(toPlainText([])).toBe('');
    expect(renderAnsi([])).toBe('');
    expect(renderCodex([])).toBeNull();
    expect(renderCodex([{ text: '', color: 'metadata' }])).toBeNull();
  });

  it('keeps Unicode content identical for both renderers', () => {
    const unicode: DisplayLine = [{ text: 'branch/日本語 🟢', color: 'branch' }];
    expect(renderAnsi(unicode, { color: false })).toBe('branch/日本語 🟢');
    expect(renderCodex(unicode)).toEqual({
      type: 'row',
      props: { gap: 0 },
      children: [
        { type: 'text', props: { color: 'status-branch' }, children: ['branch/日本語 🟢'] },
      ],
    });
  });
});

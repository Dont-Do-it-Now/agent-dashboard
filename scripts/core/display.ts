/** Host-independent display contract. No filesystem, network or host imports. */
export type SemanticColor = 'model' | 'path' | 'branch' | 'usage' | 'limit' | 'metadata';

export interface DisplaySegment {
  readonly text: string;
  readonly color?: SemanticColor;
}

/** Separators belong to the layout, so both hosts receive identical content. */
export type DisplayLine = readonly DisplaySegment[];

export function toPlainText(line: DisplayLine): string {
  return line.map((segment) => segment.text).join('');
}

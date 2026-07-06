export type MarkdownHeadingLevel = 1 | 2 | 3 | 4;

export type MarkdownBlock =
  | { type: 'heading'; level: MarkdownHeadingLevel; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'quote'; text: string }
  | { type: 'divider' };

export type MarkdownTocItem = {
  id: string;
  level: MarkdownHeadingLevel;
  text: string;
};

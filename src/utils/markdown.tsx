import { MarkdownBlock, MarkdownHeadingLevel, MarkdownTocItem } from '../types.js';
import React from 'react';

export function buildMarkdownNavigation(blocks: MarkdownBlock[]) {
  const slugCounts = new Map<string, number>();
  const headingIds = new Map<number, string>();
  const tocItems: MarkdownTocItem[] = [];

  blocks.forEach((block, index) => {
    if (block.type !== 'heading') return;
    const baseSlug = slugifyHeading(block.text) || `section-${index + 1}`;
    const seen = slugCounts.get(baseSlug) || 0;
    const id = seen ? `${baseSlug}-${seen + 1}` : baseSlug;
    slugCounts.set(baseSlug, seen + 1);
    headingIds.set(index, id);
    tocItems.push({ id, level: block.level, text: stripMarkdownTokens(block.text) });
  });

  return { headingIds, tocItems };
}

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```([\w-]*)\s*$/);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', language: fence[1] || '', code: codeLines.join('\n') });
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 4) as MarkdownHeadingLevel, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ type: 'divider' });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = isOrdered ? current.match(/^\d+[.)]\s+(.+)$/) : current.match(/^[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index].trim();
      if (!current || isMarkdownBlockStart(current)) break;
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
  }

  return blocks;
}

export function isMarkdownBlockStart(line: string) {
  return (
    line.startsWith('```') ||
    /^(#{1,4})\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+[.)]\s+/.test(line) ||
    line.startsWith('>') ||
    /^(-{3,}|\*{3,})$/.test(line)
  );
}

export function slugifyHeading(text: string) {
  return stripMarkdownTokens(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function stripMarkdownTokens(text: string) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export function renderInlineMarkdown(text: string): React.ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index || 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(<code key={`code-${start}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={`strong-${start}`}>{renderInlineMarkdown(token.slice(2, -2))}</strong>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = link[2];
        const isExternal = /^https?:\/\//.test(href);
        nodes.push(
          <a
            key={`link-${start}`}
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noreferrer' : undefined}
          >
            {renderInlineMarkdown(link[1])}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

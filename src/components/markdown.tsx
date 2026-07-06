import { copyTextToClipboard } from '../utils/clipboard.js';
import { buildMarkdownNavigation, parseMarkdownBlocks, renderInlineMarkdown } from '../utils/markdown.js';
import { Check, Copy } from 'lucide-react';
import React from 'react';

export function MarkdownRenderer({ source, copyLabel, copiedLabel }: { source: string; copyLabel: string; copiedLabel: string }) {
  const blocks = React.useMemo(() => parseMarkdownBlocks(source), [source]);
  const { headingIds, tocItems } = React.useMemo(() => buildMarkdownNavigation(blocks), [blocks]);

  function scrollToHeading(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="markdown-layout">
      <aside className="markdown-toc" aria-label="文档目录">
        {tocItems.map((item) => (
          <button
            type="button"
            className={`markdown-toc-item level-${item.level}`}
            key={item.id}
            onClick={() => scrollToHeading(item.id)}
          >
            {item.text}
          </button>
        ))}
      </aside>

      <article className="markdown-body">
        {blocks.map((block, index) => {
          if (block.type === 'heading') {
            const tagName = `h${block.level}`;
            return React.createElement(
              tagName,
              { id: headingIds.get(index), key: `${block.type}-${index}` },
              renderInlineMarkdown(block.text)
            );
          }

          if (block.type === 'paragraph') {
            return <p key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</p>;
          }

          if (block.type === 'quote') {
            return <blockquote key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</blockquote>;
          }

          if (block.type === 'divider') {
            return <hr key={`${block.type}-${index}`} />;
          }

          if (block.type === 'code') {
            return (
              <MarkdownCodeBlock
                code={block.code}
                copiedLabel={copiedLabel}
                copyLabel={copyLabel}
                key={`${block.type}-${index}`}
                language={block.language}
              />
            );
          }

          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ListTag>
          );
        })}
      </article>
    </div>
  );
}

export function MarkdownCodeBlock({
  code,
  language,
  copyLabel,
  copiedLabel
}: {
  code: string;
  language: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const resetTimerRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  async function copyCode() {
    await copyTextToClipboard(code);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    setCopied(true);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-topbar">
        {language ? <span className="markdown-code-label">{language}</span> : <span aria-hidden="true" />}
        <button
          type="button"
          className="markdown-code-copy"
          onClick={copyCode}
          aria-label={copied ? copiedLabel : copyLabel}
          title={copied ? copiedLabel : copyLabel}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

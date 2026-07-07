import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist/client');
const publicBaseUrl = normalizeBaseUrl(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || 'https://relayhub.chrisley.site');
const generatedAt = new Date().toISOString();

const guidePages = [
  {
    agent: 'claude-code',
    os: 'macos',
    label: 'Claude Code MacOS',
    title: 'Claude Code MacOS 接入 RelayHub 中转站指南',
    description: '在 MacOS 上安装 Claude Code，并接入 RelayHub API 中转站、配置密钥和 ANTHROPIC_BASE_URL 的完整指南。',
    keywords: ['Claude Code', 'MacOS', 'RelayHub', '中转站', 'API 中转站', 'AI 智能体', 'AI智能体'],
    source: 'public/guides/claude-code-macos.md'
  },
  {
    agent: 'claude-code',
    os: 'windows',
    label: 'Claude Code Windows',
    title: 'Claude Code Windows 接入 RelayHub 中转站指南',
    description: '在 Windows 上安装 Claude Code，通过 RelayHub Claude Code API 中转站完成密钥、Git Bash 和客户端配置。',
    keywords: ['Claude Code', 'Windows', 'RelayHub', '中转站', 'Claude 中转', 'AI 智能体', 'AI智能体'],
    source: 'public/guides/claude-code-windows.md'
  },
  {
    agent: 'claude-code',
    os: 'linux',
    label: 'Claude Code Linux',
    title: 'Claude Code Linux 接入 RelayHub 中转站指南',
    description: '在 Linux 上安装 Claude Code 并接入 RelayHub 中转站，包含 Node.js、密钥和 settings.json 配置步骤。',
    keywords: ['Claude Code', 'Linux', 'RelayHub', '中转站', 'API 中转', 'AI 智能体', 'AI智能体'],
    source: 'public/guides/claude-code-linux.md'
  },
  {
    agent: 'codex',
    os: 'macos-linux',
    label: 'Codex MacOS/Linux',
    title: 'Codex MacOS/Linux 接入 RelayHub 中转站指南',
    description: '在 MacOS 或 Linux 上安装 Codex CLI，并通过 RelayHub Codex API 中转站配置 auth.json 和 config.toml。',
    keywords: ['Codex', 'MacOS', 'Linux', 'RelayHub', '中转站', 'OpenAI Codex', 'AI 智能体', 'AI智能体'],
    source: 'public/guides/codex-macos-linux.md'
  },
  {
    agent: 'codex',
    os: 'windows',
    label: 'Codex Windows',
    title: 'Codex Windows 接入 RelayHub 中转站指南',
    description: '在 Windows 上安装 Codex CLI，并通过 RelayHub 中转站配置 OPENAI_API_KEY、base_url 和 Responses API。',
    keywords: ['Codex', 'Windows', 'RelayHub', '中转站', 'Codex 中转', 'AI 智能体', 'AI智能体'],
    source: 'public/guides/codex-windows.md'
  }
];

async function main() {
  if (!existsSync(distDir)) {
    throw new Error(`Missing build output: ${distDir}`);
  }

  const indexPath = path.join(distDir, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf8');
  const normalizedIndexHtml = normalizeIndexSeoUrls(indexHtml);
  if (normalizedIndexHtml !== indexHtml) {
    await writeFile(indexPath, normalizedIndexHtml, 'utf8');
  }
  const assetTags = extractAssetTags(normalizedIndexHtml);
  const guideHtmlPages = [];

  for (const page of guidePages) {
    const markdown = await readFile(path.join(rootDir, page.source), 'utf8');
    const blocks = parseMarkdownBlocks(markdown);
    const navigation = buildMarkdownNavigation(blocks);
    const articleHtml = renderMarkdown(blocks, navigation.headingIds);
    const excerpt = firstParagraph(blocks) || page.description;
    const urlPath = `/guide/${page.agent}/${page.os}/`;
    const html = renderPage({
      title: page.title,
      description: page.description,
      keywords: page.keywords,
      canonicalPath: urlPath,
      assetTags,
      body: renderGuideBody({ page, navigation, articleHtml, excerpt })
    });
    await writeHtml(urlPath, html);
    guideHtmlPages.push({ ...page, urlPath, excerpt });
  }

  await writeHtml(
    '/guide/',
    renderPage({
      title: 'RelayHub 向导 - Claude Code / Codex 中转站接入指南',
      description: 'RelayHub 向导汇总 Claude Code、Codex、AI 智能体和 API 中转站接入教程，覆盖 MacOS、Linux 与 Windows。',
      keywords: ['RelayHub', '中转站', 'Claude Code', 'Codex', 'AI 智能体', 'AI智能体', 'API 中转站'],
      canonicalPath: '/guide/',
      assetTags,
      pageType: 'CollectionPage',
      body: renderGuideIndexBody(guideHtmlPages)
    })
  );

  await writeXml('/sitemap.xml', renderSitemap(guideHtmlPages));
  await writeText('/robots.txt', renderRobots());
}

function renderPage({ title, description, keywords, canonicalPath, assetTags, body, pageType = 'TechArticle' }) {
  const canonicalUrl = `${publicBaseUrl}${canonicalPath}`;
  const keywordText = keywords.join(',');
  const socialImageUrl = `${publicBaseUrl}/guide-icon.png`;
  const breadcrumbItems = [
    { name: '首页', item: `${publicBaseUrl}/` },
    { name: '接入指南', item: `${publicBaseUrl}/guide/` }
  ];
  if (canonicalPath !== '/guide/') {
    breadcrumbItems.push({ name: title, item: canonicalUrl });
  }
  const pageData = {
    '@type': pageType,
    headline: title,
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: 'zh-CN',
    dateModified: generatedAt,
    publisher: {
      '@type': 'Organization',
      name: 'RelayHub',
      url: publicBaseUrl
    },
    about: keywords.map((name) => ({ '@type': 'Thing', name }))
  };
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      pageData,
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.item
        }))
      }
    ]
  };

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeAttr(description)}" />
    <meta name="keywords" content="${escapeAttr(keywordText)}" />
    <meta name="robots" content="index,follow,max-image-preview:large" />
    <meta name="theme-color" content="#d89d16" />
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    ${assetTags}
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="zh_CN" />
    <meta property="og:site_name" content="RelayHub" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}" />
    <meta property="og:image" content="${escapeAttr(socialImageUrl)}" />
    <meta property="og:image:alt" content="${escapeAttr(title)}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(socialImageUrl)}" />
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    ${body}
  </body>
</html>
`;
}

function renderGuideBody({ page, navigation, articleHtml, excerpt }) {
  return `<div class="seo-static-shell">
  ${renderStaticSidebar()}
  <main class="main-panel">
    ${renderStaticTopbar()}
    <section class="guide-page">
      <section class="guide-intro">
        <div class="guide-intro-icon"><img src="/guide-icon.png" alt="" /></div>
        <div>
          <span>RelayHub 中转站接入指南</span>
          <h1>${escapeHtml(page.title)}</h1>
          <p>${escapeHtml(excerpt)}</p>
        </div>
      </section>
      <section class="guide-selector-panel">
        <div>
          <span>客户端</span>
          <div class="guide-segmented-control">${renderAgentLinks(page)}</div>
        </div>
        <div>
          <span>系统</span>
          <div class="guide-segmented-control">${renderOsLinks(page)}</div>
        </div>
        <p>本页为搜索引擎和无脚本访问生成的静态指南。登录后可在管理台创建密钥并导入 CC-Switch。</p>
      </section>
      <section class="guide-document">
        <div class="section-heading">
          <div>
            <h2>${escapeHtml(page.label)} 配置步骤</h2>
            <p>围绕 RelayHub、Claude Code、Codex、API 中转站、AI 智能体和 AI智能体接入整理。</p>
          </div>
        </div>
        <div class="markdown-layout">
          <aside class="markdown-toc" aria-label="文档目录">${navigation.tocItems
            .map((item) => `<a class="markdown-toc-item level-${item.level}" href="#${escapeAttr(item.id)}">${escapeHtml(item.text)}</a>`)
            .join('')}</aside>
          <article class="markdown-body">${articleHtml}</article>
        </div>
      </section>
    </section>
  </main>
</div>`;
}

function renderGuideIndexBody(pages) {
  return `<div class="seo-static-shell">
  ${renderStaticSidebar()}
  <main class="main-panel">
    ${renderStaticTopbar()}
    <section class="guide-page">
      <section class="guide-intro">
        <div class="guide-intro-icon"><img src="/guide-icon.png" alt="" /></div>
        <div>
          <span>RelayHub Guide</span>
          <h1>RelayHub 向导 - Claude Code / Codex 中转站接入指南</h1>
          <p>这里汇总 RelayHub API 中转站的公开接入文档，帮助 Claude Code、Codex、AI 智能体和 AI智能体用户在不同系统上完成密钥与客户端配置。</p>
        </div>
      </section>
      <section class="seo-guide-grid">
        ${pages
          .map(
            (page) => `<article class="seo-guide-card">
          <h2><a href="${escapeAttr(page.urlPath)}">${escapeHtml(page.title)}</a></h2>
          <p>${escapeHtml(page.description)}</p>
          <a class="secondary-button" href="${escapeAttr(page.urlPath)}">查看指南</a>
        </article>`
          )
          .join('')}
      </section>
    </section>
  </main>
</div>`;
}

function renderStaticSidebar() {
  return `<aside class="sidebar seo-static-sidebar">
  <div class="sidebar-head">
    <a class="brand-block seo-brand-link" href="/">
      <div class="brand-mark" aria-hidden="true">
        <svg class="brand-mark-icon" viewBox="0 0 44 44" role="img" aria-label="RelayHub">
          <path class="brand-mark-monogram" d="M13.5 33.2V10.9h11.6c5 0 8.2 2.9 8.2 7.3s-3.2 7.3-8.2 7.3H13.5" />
          <path class="brand-mark-leg" d="M22.5 25.7 32 33.2" />
          <path class="brand-mark-relay" d="M23.2 18.2h9.6m-3.5-3.4 3.5 3.4-3.5 3.4" />
          <circle class="brand-mark-core" cx="22.7" cy="18.2" r="3.1" />
        </svg>
      </div>
      <div>
        <h1>RelayHub</h1>
        <p>Claude Code / Codex API <strong class="brand-subtitle-highlight">满血</strong>中转服务</p>
      </div>
    </a>
  </div>
  <nav class="nav-list" aria-label="公开页面">
    <a class="nav-item" href="/">首页</a>
    <a class="nav-item active" href="/guide/">接入指南</a>
    <a class="nav-item" href="/dashboard">登录管理台</a>
  </nav>
</aside>`;
}

function renderStaticTopbar() {
  return `<header class="topbar">
  <div class="topbar-title-row">
    <div class="topbar-title"><h1>RelayHub 中转站指南</h1></div>
  </div>
  <div class="topbar-actions">
    <a class="secondary-button" href="/">首页</a>
    <a class="primary-button" href="/dashboard">登录</a>
  </div>
</header>`;
}

function renderAgentLinks(currentPage) {
  return ['claude-code', 'codex']
    .map((agent) => {
      const page = guidePages.find((candidate) => candidate.agent === agent && candidate.os === defaultOsForAgent(agent));
      return `<a class="${currentPage.agent === agent ? 'active' : ''}" href="${page ? `/guide/${page.agent}/${page.os}/` : '/guide/'}">${agent === 'claude-code' ? 'Claude Code' : 'Codex'}</a>`;
    })
    .join('');
}

function renderOsLinks(currentPage) {
  return guidePages
    .filter((page) => page.agent === currentPage.agent)
    .map((page) => `<a class="${page.os === currentPage.os ? 'active' : ''}" href="/guide/${page.agent}/${page.os}/">${escapeHtml(osLabel(page.os))}</a>`)
    .join('');
}

function renderSitemap(pages) {
  const urls = [
    { loc: '/', priority: '1.0' },
    { loc: '/guide/', priority: '0.9' },
    ...pages.map((page) => ({ loc: page.urlPath, priority: '0.8' }))
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeHtml(`${publicBaseUrl}${url.loc}`)}</loc>
    <lastmod>${generatedAt.slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /
Disallow: /app/
Disallow: /api/
Disallow: /claude-code/
Disallow: /codex/
Disallow: /dashboard
Disallow: /keys
Disallow: /usage
Disallow: /plans
Disallow: /orders
Disallow: /logs
Disallow: /gift-cards
Disallow: /products
Disallow: /channels
Disallow: /announcements
Disallow: /users

Sitemap: ${publicBaseUrl}/sitemap.xml
`;
}

function renderMarkdown(blocks, headingIds) {
  return blocks
    .map((block, index) => {
      if (block.type === 'heading') {
        const tagName = `h${block.level}`;
        return `<${tagName} id="${escapeAttr(headingIds.get(index) || '')}">${renderInlineMarkdown(block.text)}</${tagName}>`;
      }
      if (block.type === 'paragraph') return `<p>${renderInlineMarkdown(block.text)}</p>`;
      if (block.type === 'quote') return `<blockquote>${renderInlineMarkdown(block.text)}</blockquote>`;
      if (block.type === 'divider') return '<hr />';
      if (block.type === 'code') {
        return `<div class="markdown-code-block">
  <div class="markdown-code-topbar">${block.language ? `<span class="markdown-code-label">${escapeHtml(block.language)}</span>` : '<span aria-hidden="true"></span>'}</div>
  <pre><code>${escapeHtml(block.code)}</code></pre>
</div>`;
      }
      const listTag = block.ordered ? 'ol' : 'ul';
      return `<${listTag}>${block.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${listTag}>`;
    })
    .join('\n');
}

function renderInlineMarkdown(text) {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const chunks = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index || 0;
    if (start > lastIndex) chunks.push(escapeHtml(text.slice(lastIndex, start)));

    const token = match[0];
    if (token.startsWith('`')) {
      chunks.push(`<code>${escapeHtml(token.slice(1, -1))}</code>`);
    } else if (token.startsWith('**')) {
      chunks.push(`<strong>${renderInlineMarkdown(token.slice(2, -2))}</strong>`);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = link[2];
        const externalAttrs = /^https?:\/\//.test(href) ? ' target="_blank" rel="noreferrer"' : '';
        chunks.push(`<a href="${escapeAttr(href)}"${externalAttrs}>${renderInlineMarkdown(link[1])}</a>`);
      } else {
        chunks.push(escapeHtml(token));
      }
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) chunks.push(escapeHtml(text.slice(lastIndex)));
  return chunks.join('');
}

function parseMarkdownBlocks(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(/^```([\w-]*)\s*$/);
    if (fence) {
      const codeLines = [];
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
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 4), text: heading[2] });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ type: 'divider' });
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines = [];
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
      const items = [];
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

    const paragraphLines = [];
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

function buildMarkdownNavigation(blocks) {
  const slugCounts = new Map();
  const headingIds = new Map();
  const tocItems = [];

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

function firstParagraph(blocks) {
  return blocks.find((block) => block.type === 'paragraph')?.text || '';
}

function isMarkdownBlockStart(line) {
  return (
    line.startsWith('```') ||
    /^(#{1,4})\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+[.)]\s+/.test(line) ||
    line.startsWith('>') ||
    /^(-{3,}|\*{3,})$/.test(line)
  );
}

function slugifyHeading(text) {
  return stripMarkdownTokens(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function stripMarkdownTokens(text) {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function extractAssetTags(indexHtml) {
  const tags = [];
  for (const match of indexHtml.matchAll(/<link rel="stylesheet"[^>]+>/g)) {
    tags.push(match[0]);
  }
  return tags.join('\n    ');
}

function normalizeIndexSeoUrls(indexHtml) {
  return indexHtml.replaceAll('https://relayhub.chrisley.site', publicBaseUrl);
}

function defaultOsForAgent(agent) {
  return agent === 'codex' ? 'macos-linux' : 'macos';
}

function osLabel(os) {
  if (os === 'macos-linux') return 'MacOS/Linux';
  if (os === 'macos') return 'MacOS';
  if (os === 'windows') return 'Windows';
  return 'Linux';
}

async function writeHtml(urlPath, content) {
  const targetDir = path.join(distDir, urlPath);
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, 'index.html'), content, 'utf8');
}

async function writeXml(urlPath, content) {
  await writeFile(path.join(distDir, urlPath), content, 'utf8');
}

async function writeText(urlPath, content) {
  await writeFile(path.join(distDir, urlPath), content, 'utf8');
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

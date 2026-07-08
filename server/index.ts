import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import { createSlidingWindowGuard } from './http.js';
import { pruneUsageLogs, seedDefaults } from './store.js';
import { registerActivityRoutes } from './routes/activity.routes.js';
import { registerCoreRoutes } from './routes/core.routes.js';
import { registerGiftCardRoutes } from './routes/gift-cards.routes.js';
import { registerKeyRoutes } from './routes/keys.routes.js';
import { registerTaobaoRoutes } from './routes/taobao.routes.js';
import { registerUpstreamChannelRoutes } from './routes/upstream-channels.routes.js';
import { registerProxyRoutes } from './proxy/routes.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const anthropicVersion = process.env.ANTHROPIC_VERSION || '2023-06-01';
const ccSwitchUsageAutoIntervalMinutes = 5;
const upstreamHealthProbeTimeoutMs = Number(process.env.UPSTREAM_HEALTH_PROBE_TIMEOUT_MS || 30_000);
const upstreamProxyTimeoutMs = Number(process.env.UPSTREAM_PROXY_TIMEOUT_MS || 120_000);
const claudeHealthProbeModel = process.env.CLAUDE_HEALTH_PROBE_MODEL || 'claude-sonnet-4-6';
const codexHealthProbeModel = process.env.CODEX_HEALTH_PROBE_MODEL || 'gpt-5.5';
const healthProbePrompt = 'Reply OK.';
const healthProbeMaxOutputTokens = 8;
const seedOnStart = process.env.SEED_ON_START === '1' || (process.env.NODE_ENV !== 'production' && process.env.SEED_ON_START !== '0');
const pruneUsageLogsOnStart = process.env.PRUNE_USAGE_LOGS_ON_START === '1';
const rateBucketCleanupIntervalMs = Math.max(10_000, Number(process.env.RATE_BUCKET_CLEANUP_INTERVAL_MS || 60_000));
const slidingWindowGuard = createSlidingWindowGuard({ cleanupIntervalMs: rateBucketCleanupIntervalMs });
const dynamicPathPrefixes = ['/api', '/claude-code', '/codex'];

initDb();
if (seedOnStart) {
  seedDefaults();
}
if (pruneUsageLogsOnStart) {
  pruneUsageLogs();
}

app.set('trust proxy', true);
app.use((req, res, next) => {
  if (dynamicPathPrefixes.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, no-transform');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Vary', 'Authorization, X-Api-Key');
  }
  next();
});
app.use(cors());
app.use(express.json({ limit: '12mb' }));

registerCoreRoutes(app, slidingWindowGuard);
registerTaobaoRoutes(app);
registerGiftCardRoutes(app);
registerUpstreamChannelRoutes(app);
registerKeyRoutes(app, { port, ccSwitchUsageAutoIntervalMinutes });
registerActivityRoutes(app);
registerProxyRoutes(app, {
  anthropicVersion,
  timeoutMs: upstreamHealthProbeTimeoutMs,
  claudeModel: claudeHealthProbeModel,
  codexModel: codexHealthProbeModel,
  prompt: healthProbePrompt,
  maxOutputTokens: healthProbeMaxOutputTokens,
  proxyTimeoutMs: upstreamProxyTimeoutMs
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist =
  [path.resolve(__dirname, '../client'), path.resolve(__dirname, '../dist/client')].find((candidate) => existsSync(candidate)) ||
  path.resolve(__dirname, '../client');
const noindexSpaPrefixes = [
  '/app',
  '/dashboard',
  '/keys',
  '/usage',
  '/plans',
  '/orders',
  '/logs',
  '/gift-cards',
  '/products',
  '/channels',
  '/announcements',
  '/users'
];

function shouldNoindexSpaFallback(pathname: string) {
  return noindexSpaPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

if (process.env.NODE_ENV === 'production') {
  const homeIndex = path.join(clientDist, 'home', 'index.html');
  if (existsSync(homeIndex)) {
    app.get(['/home', '/home/'], (_req, res) => {
      res.sendFile(homeIndex);
    });
  }
  app.use(express.static(clientDist));
  app.get(/.*/, (req, res) => {
    if (shouldNoindexSpaFallback(req.path)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Claude Code transfer station listening on http://localhost:${port}`);
});

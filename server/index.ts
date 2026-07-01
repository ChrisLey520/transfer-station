import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import {
  assertQuota,
  createKey,
  createUsageLog,
  getRawKeyById,
  getKeyByRawKey,
  listKeys,
  listPlans,
  listUsageLogs,
  revokeKey,
  seedDefaults,
  touchKey,
  updateKey,
  upsertPlan,
  usageSummary
} from './store.js';
import type { AnthropicUsage, KeyWithPlan } from './types.js';
import { usageCostCents } from './pricing.js';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT || 8787);
const upstreamBaseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const anthropicVersion = process.env.ANTHROPIC_VERSION || '2023-06-01';

initDb();
seedDefaults();

app.use(cors());
app.use(express.json({ limit: '12mb' }));

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || '';
}

function adminGuard(req: Request, res: Response, next: NextFunction) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    next();
    return;
  }

  const token = req.header('x-admin-token') || req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (token !== adminToken) {
    res.status(401).json({ error: 'Admin token is required' });
    return;
  }

  next();
}

function getClientKey(req: Request) {
  const authorization = req.header('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  return req.header('x-api-key') || '';
}

function authProxyKey(req: Request, res: Response): KeyWithPlan | null {
  const rawKey = getClientKey(req);
  if (!rawKey) {
    res.status(401).json({ type: 'error', error: { type: 'authentication_error', message: 'API key is required' } });
    return null;
  }

  const key = getKeyByRawKey(rawKey);
  if (!key) {
    res.status(401).json({ type: 'error', error: { type: 'authentication_error', message: 'Invalid API key' } });
    return null;
  }

  if (key.status !== 'active') {
    res.status(403).json({ type: 'error', error: { type: 'permission_error', message: `API key is ${key.status}` } });
    return null;
  }

  return key;
}

function getTokenUsage(payload: unknown) {
  const usage = payload && typeof payload === 'object' && 'usage' in payload ? (payload as any).usage : undefined;
  return normalizeUsage(usage);
}

function normalizeUsage(usage: AnthropicUsage | undefined) {
  const inputTokens = Number(usage?.input_tokens ?? 0);
  const outputTokens = Number(usage?.output_tokens ?? 0);
  const cacheCreationInputTokens = Number(usage?.cache_creation_input_tokens ?? 0);
  const cacheReadInputTokens = Number(usage?.cache_read_input_tokens ?? 0);
  const costs = usageCostCents({
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens
  });

  return {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    totalTokens: inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens,
    ...costs
  };
}

function buildCcSwitchProviderLink(appName: 'claude' | 'codex', name: string, endpoint: string, apiKey: string) {
  const params = new URLSearchParams({
    resource: 'provider',
    app: appName,
    name,
    endpoint,
    apiKey,
    enabled: 'true'
  });
  return `ccswitch://v1/import?${params.toString()}`;
}

function writeProxyLog(input: {
  key: KeyWithPlan | null;
  model: string;
  path: string;
  method: string;
  statusCode: number;
  startedAt: number;
  usage?: AnthropicUsage;
  errorMessage?: string | null;
  requestId: string;
}) {
  const usage = normalizeUsage(input.usage);
  createUsageLog({
    apiKeyId: input.key?.id ?? null,
    model: input.model || 'unknown',
    path: input.path,
    method: input.method,
    statusCode: input.statusCode,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
    totalTokens: usage.totalTokens,
    inputCostCents: usage.inputCostCents,
    outputCostCents: usage.outputCostCents,
    cacheCreationCostCents: usage.cacheCreationCostCents,
    cacheReadCostCents: usage.cacheReadCostCents,
    totalCostCents: usage.totalCostCents,
    latencyMs: Date.now() - input.startedAt,
    errorMessage: input.errorMessage ?? null,
    requestId: input.requestId
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    upstreamConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    now: new Date().toISOString()
  });
});

app.get('/api/bootstrap', adminGuard, (_req, res) => {
  res.json({
    summary: usageSummary(),
    plans: listPlans(),
    keys: listKeys(),
    logs: listUsageLogs()
  });
});

app.get('/api/plans', adminGuard, (_req, res) => {
  res.json({ plans: listPlans() });
});

app.post('/api/plans', adminGuard, (req, res) => {
  const schema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    description: z.string().default(''),
    fiveHourTokenLimit: z.coerce.number().int().positive(),
    weeklyTokenLimit: z.coerce.number().int().positive(),
    priceCents: z.coerce.number().int().nonnegative(),
    currency: z.string().min(1).default('USD'),
    isActive: z.boolean().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  res.json({ plan: upsertPlan(parsed.data) });
});

app.get('/api/keys', adminGuard, (_req, res) => {
  res.json({ keys: listKeys() });
});

app.post('/api/keys', adminGuard, (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    ownerEmail: z.string().email().nullable().optional().or(z.literal('')),
    planId: z.string().min(1).optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const planId = parsed.data.planId || listPlans().find((plan) => plan.isActive)?.id;
    if (!planId) {
      res.status(400).json({ error: 'No active plan is available' });
      return;
    }

    const result = createKey({
      name: parsed.data.name,
      ownerEmail: parsed.data.ownerEmail || null,
      planId
    });
    res.status(201).json({ key: result.key, preview: result.preview, keys: listKeys() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create key' });
  }
});

app.patch('/api/keys/:id', adminGuard, (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    ownerEmail: z.string().email().nullable().optional().or(z.literal('')),
    planId: z.string().optional(),
    status: z.enum(['active', 'paused', 'revoked']).optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const key = updateKey(routeParam(req.params.id), {
      ...parsed.data,
      ownerEmail: parsed.data.ownerEmail === '' ? null : parsed.data.ownerEmail
    });
    if (!key) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }
    res.json({ key, keys: listKeys() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update key' });
  }
});

app.get('/api/keys/:id/secret', adminGuard, (req, res) => {
  const result = getRawKeyById(routeParam(req.params.id));
  if (!result) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }

  if (!result.rawKey) {
    res.status(409).json({ error: 'The full key is unavailable. This key was created before encrypted key storage was enabled.' });
    return;
  }

  const endpoint = `${req.protocol}://${req.get('host')}/v1`;
  const providerName = result.key.name || result.key.keyPreview;

  res.json({
    key: result.rawKey,
    keyPreview: result.key.keyPreview,
    ccSwitch: {
      codex: buildCcSwitchProviderLink('codex', providerName, endpoint, result.rawKey),
      claude: buildCcSwitchProviderLink('claude', providerName, endpoint, result.rawKey)
    }
  });
});

app.delete('/api/keys/:id', adminGuard, (req, res) => {
  const key = revokeKey(routeParam(req.params.id));
  if (!key) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }
  res.json({ key, keys: listKeys() });
});

app.get('/api/logs', adminGuard, (req, res) => {
  const limit = Number(req.query.limit || 80);
  res.json({ logs: listUsageLogs(Math.min(Math.max(limit, 1), 300)) });
});

app.get('/api/usage', adminGuard, (_req, res) => {
  res.json({ summary: usageSummary(), keys: listKeys() });
});

app.all('/v1/*route', async (req, res) => {
  const startedAt = Date.now();
  const key = authProxyKey(req, res);
  if (!key) return;

  const quotaCheck = assertQuota(key);
  if (!quotaCheck.ok) {
    createUsageLog({
      apiKeyId: key.id,
      model: req.body?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: quotaCheck.statusCode,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMs: Date.now() - startedAt,
      errorMessage: quotaCheck.message,
      requestId: `local_${crypto.randomUUID()}`
    });
    res.status(quotaCheck.statusCode).json({
      type: 'error',
      error: {
        type: 'rate_limit_error',
        message: quotaCheck.message
      },
      quota: quotaCheck.quota
    });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    writeProxyLog({
      key,
      model: req.body?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: 500,
      startedAt,
      errorMessage: 'ANTHROPIC_API_KEY is not configured',
      requestId: `local_${crypto.randomUUID()}`
    });
    res.status(500).json({
      type: 'error',
      error: {
        type: 'configuration_error',
        message: 'Upstream Anthropic API key is not configured'
      }
    });
    return;
  }

  const upstreamUrl = `${upstreamBaseUrl}${req.originalUrl}`;
  const headers = new Headers();
  const incomingAnthropicVersion = req.header('anthropic-version') || anthropicVersion;
  headers.set('x-api-key', process.env.ANTHROPIC_API_KEY);
  headers.set('anthropic-version', incomingAnthropicVersion);
  headers.set('content-type', 'application/json');

  const betaHeader = req.header('anthropic-beta');
  if (betaHeader) headers.set('anthropic-beta', betaHeader);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : JSON.stringify(req.body ?? {})
    });

    touchKey(key.id);
    const requestId = upstream.headers.get('request-id') || upstream.headers.get('x-request-id') || `up_${crypto.randomUUID()}`;
    const contentType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status);
    res.setHeader('content-type', contentType);
    res.setHeader('x-transfer-station-key', key.keyPreview);
    res.setHeader('x-transfer-station-quota-five-hour-remaining', String(quotaCheck.quota.remainingFiveHour));
    res.setHeader('x-transfer-station-quota-weekly-remaining', String(quotaCheck.quota.remainingWeekly));

    if (contentType.includes('text/event-stream') && upstream.body) {
      await streamSse(upstream, res, {
        key,
        model: req.body?.model || 'unknown',
        path: req.path,
        method: req.method,
        statusCode: upstream.status,
        startedAt,
        requestId
      });
      return;
    }

    const text = await upstream.text();
    res.send(text);

    let payload: unknown = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }

    const tokenUsage = getTokenUsage(payload);
    createUsageLog({
      apiKeyId: key.id,
      model: req.body?.model || (payload as any)?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: upstream.status,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      cacheCreationInputTokens: tokenUsage.cacheCreationInputTokens,
      cacheReadInputTokens: tokenUsage.cacheReadInputTokens,
      totalTokens: tokenUsage.totalTokens,
      inputCostCents: tokenUsage.inputCostCents,
      outputCostCents: tokenUsage.outputCostCents,
      cacheCreationCostCents: tokenUsage.cacheCreationCostCents,
      cacheReadCostCents: tokenUsage.cacheReadCostCents,
      totalCostCents: tokenUsage.totalCostCents,
      latencyMs: Date.now() - startedAt,
      errorMessage: upstream.ok ? null : (payload as any)?.error?.message || upstream.statusText,
      requestId
    });
  } catch (error) {
    writeProxyLog({
      key,
      model: req.body?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: 502,
      startedAt,
      errorMessage: error instanceof Error ? error.message : 'Upstream request failed',
      requestId: `local_${crypto.randomUUID()}`
    });
    res.status(502).json({
      type: 'error',
      error: {
        type: 'api_error',
        message: error instanceof Error ? error.message : 'Upstream request failed'
      }
    });
  }
});

async function streamSse(
  upstream: globalThis.Response,
  res: Response,
  logContext: {
    key: KeyWithPlan;
    model: string;
    path: string;
    method: string;
    statusCode: number;
    startedAt: number;
    requestId: string;
  }
) {
  const decoder = new TextDecoder();
  const reader = upstream.body!.getReader();
  let buffered = '';
  let finalUsage: AnthropicUsage = {};
  let errorMessage: string | null = upstream.ok ? null : upstream.statusText;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunkText = decoder.decode(value, { stream: true });
    res.write(chunkText);
    buffered += chunkText;

    const events = buffered.split('\n\n');
    buffered = events.pop() || '';

    for (const eventText of events) {
      const dataLines = eventText
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s?/, ''));

      for (const dataLine of dataLines) {
        if (!dataLine || dataLine === '[DONE]') continue;
        try {
          const event = JSON.parse(dataLine);
          if (event?.message?.usage) {
            finalUsage = { ...finalUsage, ...event.message.usage };
          }
          if (event?.usage) {
            finalUsage = { ...finalUsage, ...event.usage };
          }
          if (event?.type === 'message_delta' && event?.usage) {
            finalUsage = { ...finalUsage, ...event.usage };
          }
          if (event?.type === 'error') {
            errorMessage = event?.error?.message || 'Streaming error';
          }
        } catch {
          // Ignore partial or non-JSON SSE data.
        }
      }
    }
  }

  res.end();
  writeProxyLog({
    ...logContext,
    usage: finalUsage,
    errorMessage
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../dist/client');

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Claude Code transfer station listening on http://localhost:${port}`);
});

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import {
  assertQuota,
  createKey,
  createUsageLog,
  getAccountState,
  getFirstAdminUser,
  getPlan,
  getRawKeyById,
  getKeyByRawKey,
  getUserBySessionToken,
  loginUser,
  listKeys,
  listPlans,
  listUsageLogs,
  previewGiftCard,
  pruneUsageLogs,
  redeemGiftCard,
  registerUser,
  revokeKey,
  seedDefaults,
  touchKey,
  updateKey,
  upsertPlan,
  usageSummaryForUser
} from './store.js';
import type { AnthropicUsage, KeyWithPlan, User } from './types.js';
import { usageCostCents } from './pricing.js';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT || 8787);
const upstreamBaseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const anthropicVersion = process.env.ANTHROPIC_VERSION || '2023-06-01';
const sliderChallengeTtlMs = 5 * 60 * 1000;
const sliderTokenTtlMs = 2 * 60 * 1000;
const puzzleImageWidth = 320;
const puzzleImageHeight = 150;
const puzzlePieceSize = 44;
const puzzleTolerancePct = 2.5;
const ccSwitchUsageAutoIntervalMinutes = 5;

type AuthPurpose = 'login' | 'register';

type SliderChallengeRecord = {
  purpose: AuthPurpose;
  targetPct: number;
  expiresAt: number;
};

type SliderTokenRecord = {
  purpose: AuthPurpose;
  expiresAt: number;
};

const sliderChallenges = new Map<string, SliderChallengeRecord>();
const sliderTokens = new Map<string, SliderTokenRecord>();
const rateBuckets = new Map<string, number[]>();

const pngCrcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

initDb();
seedDefaults();
pruneUsageLogs();

app.use(cors());
app.use(express.json({ limit: '12mb' }));

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || '';
}

function getClientFingerprint(req: Request) {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.ip || req.socket.remoteAddress || 'unknown';
}

function slidingWindowGuard(bucket: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${bucket}:${getClientFingerprint(req)}`;
    const hits = (rateBuckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (hits.length >= limit) {
      rateBuckets.set(key, hits);
      res.status(429).json({ error: '请求过于频繁，请稍后再试。' });
      return;
    }
    hits.push(now);
    rateBuckets.set(key, hits);
    next();
  };
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function setPixel(buffer: Uint8Array, width: number, x: number, y: number, rgba: [number, number, number, number]) {
  const offset = (y * width + x) * 4;
  buffer[offset] = rgba[0];
  buffer[offset + 1] = rgba[1];
  buffer[offset + 2] = rgba[2];
  buffer[offset + 3] = rgba[3];
}

function getPixel(buffer: Uint8Array, width: number, x: number, y: number): [number, number, number, number] {
  const offset = (y * width + x) * 4;
  return [buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]];
}

function mixColor(
  color: [number, number, number, number],
  target: [number, number, number, number],
  amount: number
): [number, number, number, number] {
  return [
    clampChannel(color[0] * (1 - amount) + target[0] * amount),
    clampChannel(color[1] * (1 - amount) + target[1] * amount),
    clampChannel(color[2] * (1 - amount) + target[2] * amount),
    clampChannel(color[3] * (1 - amount) + target[3] * amount)
  ];
}

function puzzleMask(localX: number, localY: number, size: number) {
  const inset = size * 0.19;
  const bodyMin = inset;
  const bodyMax = size - inset;
  const tabRadius = inset * 0.9;
  const inBody = localX >= bodyMin && localX <= bodyMax && localY >= bodyMin && localY <= bodyMax;
  const topTab = Math.hypot(localX - size / 2, localY - bodyMin) <= tabRadius && localY <= bodyMin + tabRadius;
  const rightTab =
    Math.hypot(localX - bodyMax, localY - size / 2) <= tabRadius && localX >= bodyMax - tabRadius;
  const bottomCut = Math.hypot(localX - size / 2, localY - bodyMax) <= tabRadius && localY >= bodyMax - tabRadius;
  const leftCut = Math.hypot(localX - bodyMin, localY - size / 2) <= tabRadius && localX <= bodyMin + tabRadius;
  return (inBody || topTab || rightTab) && !bottomCut && !leftCut;
}

function puzzleEdge(localX: number, localY: number, size: number) {
  if (!puzzleMask(localX, localY, size)) return false;
  return (
    !puzzleMask(localX - 1, localY, size) ||
    !puzzleMask(localX + 1, localY, size) ||
    !puzzleMask(localX, localY - 1, size) ||
    !puzzleMask(localX, localY + 1, size)
  );
}

function pngCrc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = pngCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(pngCrc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function rgbaToPngDataUrl(width: number, height: number, rgba: Uint8Array) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowOffset + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

function puzzleBackgroundPixel(x: number, y: number, seed: number): [number, number, number, number] {
  const nx = x / puzzleImageWidth;
  const ny = y / puzzleImageHeight;
  const sunX = 0.73 + Math.sin(seed * 0.013) * 0.07;
  const sunY = 0.27 + Math.cos(seed * 0.017) * 0.035;
  const sunDistance = Math.hypot(nx - sunX, ny - sunY);
  const glow = Math.max(0, 1 - sunDistance / 0.44);
  const skyTop: [number, number, number] = [92, 158, 214];
  const skyBottom: [number, number, number] = [250, 205, 154];
  const mist: [number, number, number] = [246, 239, 219];
  const cloudWave = Math.sin((nx * 7.4 + ny * 2.4 + seed * 0.011) * Math.PI) * 0.035;
  const farRidge = 0.54 + Math.sin(nx * 8.2 + seed * 0.021) * 0.08 + Math.cos(nx * 17.4) * 0.025;
  const nearRidge = 0.71 + Math.cos(nx * 10.6 + seed * 0.018) * 0.07 + Math.sin(nx * 21.8) * 0.018;
  const waterLine = 0.82 + Math.sin(nx * 9.5 + seed * 0.016) * 0.025;
  let color: [number, number, number] = [
    skyTop[0] * (1 - ny) + skyBottom[0] * ny,
    skyTop[1] * (1 - ny) + skyBottom[1] * ny,
    skyTop[2] * (1 - ny) + skyBottom[2] * ny
  ];

  if (sunDistance < 0.075) {
    const sunCore = 1 - sunDistance / 0.075;
    color = [
      color[0] * (1 - sunCore) + 255 * sunCore,
      color[1] * (1 - sunCore) + 232 * sunCore,
      color[2] * (1 - sunCore) + 150 * sunCore
    ];
  }

  if (ny > farRidge) {
    const depth = Math.min(1, (ny - farRidge) / 0.42);
    color = [
      64 + depth * 30,
      131 + depth * 38,
      143 + depth * 26
    ];
  }

  if (ny > nearRidge) {
    const depth = Math.min(1, (ny - nearRidge) / 0.28);
    color = [
      38 + depth * 22,
      126 + depth * 42,
      104 + depth * 20
    ];
  }

  if (ny > waterLine) {
    const waterDepth = Math.min(1, (ny - waterLine) / 0.2);
    const ripple = Math.sin((nx * 28 + seed * 0.019) * Math.PI) * 9 + Math.sin((nx * 70 + ny * 8) * Math.PI) * 3;
    color = [
      39 + waterDepth * 20 + ripple,
      139 + waterDepth * 24 + ripple * 0.3,
      154 + waterDepth * 28 + ripple * 0.5
    ];
  }

  const cloudBand = Math.exp(-Math.pow((ny - 0.34 - cloudWave) / 0.052, 2));
  const cloudBlob =
    Math.max(0, 1 - Math.hypot(nx - 0.22, ny - 0.29) / 0.18) +
    Math.max(0, 1 - Math.hypot(nx - 0.42, ny - 0.25) / 0.16) +
    Math.max(0, 1 - Math.hypot(nx - 0.58, ny - 0.33) / 0.2);
  const treeA = Math.max(0, 1 - Math.hypot(nx - 0.12, ny - 0.72) / 0.055);
  const treeB = Math.max(0, 1 - Math.hypot(nx - 0.9, ny - 0.69) / 0.06);
  const texture = ((x * 17 + y * 31 + seed) % 47 === 0 ? 7 : 0) + Math.sin((x + seed) * 0.11) * 1.6;
  const cloud = Math.min(0.35, cloudBand * 0.22 + cloudBlob * 0.18);
  color = [
    color[0] * (1 - cloud) + mist[0] * cloud + glow * 36 + texture - (treeA + treeB) * 28,
    color[1] * (1 - cloud) + mist[1] * cloud + glow * 26 + texture - (treeA + treeB) * 10,
    color[2] * (1 - cloud) + mist[2] * cloud + glow * 14 + texture - (treeA + treeB) * 32
  ];

  return [
    clampChannel(color[0]),
    clampChannel(color[1]),
    clampChannel(color[2]),
    255
  ];
}

function buildPuzzleImages(targetX: number, targetY: number) {
  const seed = crypto.randomInt(0, 100_000);
  const base = new Uint8Array(puzzleImageWidth * puzzleImageHeight * 4);
  for (let y = 0; y < puzzleImageHeight; y += 1) {
    for (let x = 0; x < puzzleImageWidth; x += 1) {
      setPixel(base, puzzleImageWidth, x, y, puzzleBackgroundPixel(x, y, seed));
    }
  }

  const background = new Uint8Array(base);
  const piece = new Uint8Array(puzzlePieceSize * puzzlePieceSize * 4);
  for (let localY = 0; localY < puzzlePieceSize; localY += 1) {
    for (let localX = 0; localX < puzzlePieceSize; localX += 1) {
      const x = targetX + localX;
      const y = targetY + localY;
      if (!puzzleMask(localX, localY, puzzlePieceSize)) {
        setPixel(piece, puzzlePieceSize, localX, localY, [0, 0, 0, 0]);
        continue;
      }

      const original = getPixel(base, puzzleImageWidth, x, y);
      const isEdge = puzzleEdge(localX, localY, puzzlePieceSize);
      const piecePixel = isEdge ? mixColor(original, [255, 255, 255, 255], 0.36) : original;
      const slotPixel = isEdge
        ? mixColor(original, [18, 38, 48, 255], 0.36)
        : mixColor(original, [18, 38, 48, 255], 0.22);
      setPixel(piece, puzzlePieceSize, localX, localY, piecePixel);
      setPixel(background, puzzleImageWidth, x, y, slotPixel);
    }
  }

  return {
    backgroundImage: rgbaToPngDataUrl(puzzleImageWidth, puzzleImageHeight, background),
    pieceImage: rgbaToPngDataUrl(puzzlePieceSize, puzzlePieceSize, piece)
  };
}

function pruneSliderRecords() {
  const now = Date.now();
  for (const [id, challenge] of sliderChallenges) {
    if (challenge.expiresAt <= now) sliderChallenges.delete(id);
  }
  for (const [token, record] of sliderTokens) {
    if (record.expiresAt <= now) sliderTokens.delete(token);
  }
}

function verifySliderToken(token: string, purpose: AuthPurpose) {
  pruneSliderRecords();
  const record = sliderTokens.get(token);
  if (!record || record.purpose !== purpose || record.expiresAt <= Date.now()) {
    return false;
  }
  sliderTokens.delete(token);
  return true;
}

function adminGuard(req: Request, res: Response, next: NextFunction) {
  const bearerToken = getBearerToken(req);
  const sessionUser = bearerToken ? getUserBySessionToken(bearerToken) : null;
  const adminToken = process.env.ADMIN_TOKEN?.trim();
  const suppliedAdminToken = req.header('x-admin-token') || (sessionUser ? '' : bearerToken);

  if (adminToken && suppliedAdminToken === adminToken) {
    const adminUser = getFirstAdminUser();
    if (!adminUser) {
      res.status(401).json({ error: '未配置管理员用户。' });
      return;
    }
    res.locals.adminUser = adminUser;
    next();
    return;
  }

  if (sessionUser?.role === 'admin') {
    res.locals.adminUser = sessionUser;
    next();
    return;
  }

  res.status(sessionUser ? 403 : 401).json({ error: '需要管理员身份。' });
}

function getBearerToken(req: Request) {
  return req.header('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
}

function authUser(req: Request, res: Response): User | null {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: '请先登录。' });
    return null;
  }

  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: '登录已过期，请重新登录。' });
    return null;
  }

  return user;
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

function authStatusKey(req: Request, res: Response): KeyWithPlan | null {
  const rawKey = getClientKey(req);
  if (!rawKey) {
    res.status(401).json({ ok: false, error: 'API key is required' });
    return null;
  }

  const key = getKeyByRawKey(rawKey);
  if (!key) {
    res.status(401).json({ ok: false, error: 'Invalid API key' });
    return null;
  }

  if (key.status !== 'active') {
    res.status(403).json({ ok: false, error: `API key is ${key.status}`, status: key.status });
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

function requestOrigin(req: Request) {
  const configuredBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').trim();
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '');

  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host') || `localhost:${port}`;
  return `${protocol}://${host}`;
}

function requestApiEndpoint(req: Request) {
  const origin = requestOrigin(req);
  return origin.endsWith('/v1') ? origin : `${origin}/v1`;
}

function centsToAmount(cents: number) {
  return Number(((cents || 0) / 100).toFixed(2));
}

function keyCurrency(key: KeyWithPlan) {
  const account = key.userId ? getAccountState(key.userId) : null;
  const plan = getPlan(account?.currentPlanId || key.planId) || getPlan(key.planId);
  return plan?.currency || 'CNY';
}

function buildKeyHealth(key: KeyWithPlan) {
  const quotaCheck = assertQuota(key);
  const upstreamConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const ok = upstreamConfigured && quotaCheck.ok;

  return {
    ok,
    status: ok ? 'healthy' : upstreamConfigured ? 'quota_exceeded' : 'configuration_error',
    message: ok
      ? 'Key is ready'
      : upstreamConfigured
        ? quotaCheck.message
        : 'ANTHROPIC_API_KEY is not configured',
    upstreamConfigured,
    key: {
      id: key.id,
      name: key.name,
      preview: key.keyPreview,
      status: key.status
    },
    quota: quotaCheck.quota,
    now: new Date().toISOString()
  };
}

function buildKeyBalance(key: KeyWithPlan) {
  const account = key.userId ? getAccountState(key.userId) : null;
  const unit = keyCurrency(key);
  const amountCents = account?.freeCreditCents ?? 0;

  return {
    ok: true,
    balance: centsToAmount(amountCents),
    amount: centsToAmount(amountCents),
    balanceCents: amountCents,
    unit,
    planName: account?.currentPlanName || key.planName,
    planExpiresAt: account?.planExpiresAt ?? null,
    keyPreview: key.keyPreview,
    now: new Date().toISOString()
  };
}

function buildKeyUsageStatus(key: KeyWithPlan) {
  const unit = keyCurrency(key);
  const quota = assertQuota(key).quota;
  const summary = key.userId ? usageSummaryForUser(key.userId) : null;
  const balance = buildKeyBalance(key);

  const fiveHour = {
    used: centsToAmount(quota.fiveHourUsed),
    usedCents: quota.fiveHourUsed,
    limit: centsToAmount(quota.fiveHourLimit),
    limitCents: quota.fiveHourLimit,
    remaining: centsToAmount(quota.remainingFiveHour),
    remainingCents: quota.remainingFiveHour,
    resetAt: quota.fiveHourResetAt
  };
  const weekly = {
    used: centsToAmount(quota.weeklyUsed),
    usedCents: quota.weeklyUsed,
    limit: centsToAmount(quota.weeklyLimit),
    limitCents: quota.weeklyLimit,
    remaining: centsToAmount(quota.remainingWeekly),
    remainingCents: quota.remainingWeekly,
    resetAt: quota.weeklyResetAt
  };

  return {
    ok: true,
    health: buildKeyHealth(key),
    balance: {
      amount: balance.amount,
      amountCents: balance.balanceCents,
      unit: balance.unit
    },
    usage: {
      unit,
      today: {
        cost: centsToAmount(summary?.todayCostCents ?? 0),
        costCents: summary?.todayCostCents ?? 0,
        tokens: summary?.todayTokens ?? 0,
        requests: summary?.todayRequests ?? 0
      },
      total: {
        cost: centsToAmount(summary?.totalCostCents ?? 0),
        costCents: summary?.totalCostCents ?? 0,
        tokens: summary?.totalTokens ?? 0,
        requests: summary?.requests ?? 0
      },
      fiveHour,
      weekly
    },
    ccSwitch: [
      {
        planName: 'Account Balance',
        remaining: balance.amount,
        total: balance.amount,
        used: 0,
        unit: balance.unit
      },
      {
        planName: '5h Rolling Limit',
        remaining: fiveHour.remaining,
        total: fiveHour.limit,
        used: fiveHour.used,
        unit,
        extra: `Resets at ${fiveHour.resetAt}`
      },
      {
        planName: '7d Rolling Limit',
        remaining: weekly.remaining,
        total: weekly.limit,
        used: weekly.used,
        unit,
        extra: `Resets at ${weekly.resetAt}`
      }
    ],
    keyPreview: key.keyPreview,
    planName: balance.planName,
    now: new Date().toISOString()
  };
}

function buildCcSwitchUsageScript() {
  return `({
  request: {
    url: "{{baseUrl}}/key/usage",
    method: "GET",
    headers: {
      "Authorization": "Bearer {{apiKey}}",
      "User-Agent": "cc-switch/1.0"
    }
  },
  extractor: function(response) {
    if (!response.ok) {
      return {
        isValid: false,
        invalidMessage: response.error || "Usage query failed"
      };
    }

    return response.ccSwitch || {
      remaining: response.balance && response.balance.amount,
      unit: response.balance && response.balance.unit
    };
  }
})`;
}

function buildCcSwitchProviderLink(appName: 'claude' | 'codex', name: string, endpoint: string, apiKey: string) {
  const params = new URLSearchParams({
    resource: 'provider',
    app: appName,
    name,
    endpoint,
    apiKey,
    enabled: 'true',
    usageEnabled: 'true',
    usageScript: Buffer.from(buildCcSwitchUsageScript(), 'utf8').toString('base64'),
    usageApiKey: apiKey,
    usageBaseUrl: endpoint,
    usageAutoInterval: String(ccSwitchUsageAutoIntervalMinutes)
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

app.post('/api/auth/slider-challenge', slidingWindowGuard('slider-challenge', 60, 60_000), (req, res) => {
  const schema = z.object({ purpose: z.enum(['login', 'register']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  pruneSliderRecords();
  const challengeId = crypto.randomUUID();
  const targetX = crypto.randomInt(Math.round(puzzleImageWidth * 0.26), puzzleImageWidth - puzzlePieceSize - 18);
  const targetY = crypto.randomInt(18, puzzleImageHeight - puzzlePieceSize - 18);
  const targetPct = (targetX / (puzzleImageWidth - puzzlePieceSize)) * 100;
  const puzzle = buildPuzzleImages(targetX, targetY);
  const expiresAt = Date.now() + sliderChallengeTtlMs;
  sliderChallenges.set(challengeId, {
    purpose: parsed.data.purpose,
    targetPct,
    expiresAt
  });
  res.json({
    challengeId,
    purpose: parsed.data.purpose,
    backgroundImage: puzzle.backgroundImage,
    pieceImage: puzzle.pieceImage,
    imageWidth: puzzleImageWidth,
    imageHeight: puzzleImageHeight,
    pieceTopPct: (targetY / puzzleImageHeight) * 100,
    pieceWidthPct: (puzzlePieceSize / puzzleImageWidth) * 100,
    pieceHeightPct: (puzzlePieceSize / puzzleImageHeight) * 100,
    expiresAt: new Date(expiresAt).toISOString()
  });
});

app.post('/api/auth/slider-verify', slidingWindowGuard('slider-verify', 80, 60_000), (req, res) => {
  const schema = z.object({
    challengeId: z.string().min(1),
    purpose: z.enum(['login', 'register']),
    positionPct: z.coerce.number().min(0).max(100)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  pruneSliderRecords();
  const challenge = sliderChallenges.get(parsed.data.challengeId);
  if (!challenge || challenge.purpose !== parsed.data.purpose || challenge.expiresAt <= Date.now()) {
    res.status(400).json({ error: '拼图验证已过期，请重试。' });
    return;
  }

  sliderChallenges.delete(parsed.data.challengeId);
  if (Math.abs(parsed.data.positionPct - challenge.targetPct) > puzzleTolerancePct) {
    res.status(400).json({ error: '拼图验证失败，请重试。' });
    return;
  }

  const captchaToken = crypto.randomUUID();
  const expiresAt = Date.now() + sliderTokenTtlMs;
  sliderTokens.set(captchaToken, {
    purpose: parsed.data.purpose,
    expiresAt
  });
  res.json({
    captchaToken,
    expiresAt: new Date(expiresAt).toISOString()
  });
});

app.post('/api/auth/register', slidingWindowGuard('auth-register', 20, 10 * 60_000), (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    captchaToken: z.string().min(1),
    displayName: z.string().min(1).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  if (!verifySliderToken(parsed.data.captchaToken, 'register')) {
    res.status(400).json({ error: '请先完成拼图验证。' });
    return;
  }

  try {
    res.status(201).json(
      registerUser({
        email: parsed.data.email,
        password: parsed.data.password,
        displayName: parsed.data.displayName
      })
    );
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '注册失败。' });
  }
});

app.post('/api/auth/login', slidingWindowGuard('auth-login', 40, 10 * 60_000), (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    captchaToken: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  if (!verifySliderToken(parsed.data.captchaToken, 'login')) {
    res.status(400).json({ error: '请先完成拼图验证。' });
    return;
  }

  try {
    res.json(loginUser({ email: parsed.data.email, password: parsed.data.password }));
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : '登录失败。' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  res.json({ user });
});

app.get('/api/bootstrap', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  res.json({
    user,
    account: getAccountState(user.id),
    summary: usageSummaryForUser(user.id),
    plans: listPlans(),
    keys: listKeys(user.id)
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

app.get('/api/user/keys', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  res.json({ keys: listKeys(user.id) });
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
    const adminUser = res.locals.adminUser as User | undefined;
    if (!adminUser) {
      res.status(401).json({ error: '未配置管理员用户。' });
      return;
    }

    const result = createKey({
      name: parsed.data.name,
      ownerEmail: parsed.data.ownerEmail || null,
      planId,
      userId: adminUser.id
    });
    res.status(201).json({ key: result.key, preview: result.preview, keys: listKeys() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create key' });
  }
});

app.post('/api/user/keys', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  const schema = z.object({
    name: z.string().min(1),
    ownerEmail: z.string().email().nullable().optional().or(z.literal(''))
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = createKey({
      name: parsed.data.name,
      ownerEmail: parsed.data.ownerEmail || null,
      userId: user.id
    });
    res.status(201).json({ key: result.key, preview: result.preview, keys: listKeys(user.id) });
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

app.patch('/api/user/keys/:id', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
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
    const key = updateKey(
      routeParam(req.params.id),
      { ...parsed.data, ownerEmail: parsed.data.ownerEmail === '' ? null : parsed.data.ownerEmail },
      user.id
    );
    if (!key) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }
    res.json({ key, keys: listKeys(user.id) });
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

  const endpoint = requestApiEndpoint(req);
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

app.get('/api/user/keys/:id/secret', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  const result = getRawKeyById(routeParam(req.params.id), user.id);
  if (!result) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }
  if (!result.rawKey) {
    res.status(409).json({ error: 'The full key is unavailable. This key was created before encrypted key storage was enabled.' });
    return;
  }

  const endpoint = requestApiEndpoint(req);
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

app.delete('/api/user/keys/:id', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  const key = revokeKey(routeParam(req.params.id), user.id);
  if (!key) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }
  res.json({ key, keys: listKeys(user.id) });
});

app.get('/api/logs', adminGuard, (req, res) => {
  const schema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['all', 'success', 'failed']).default('all'),
    apiKeyId: z.string().optional(),
    range: z.enum(['24h', '3d', '7d', '30d']).default('24h')
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const apiKeyId = parsed.data.apiKeyId && parsed.data.apiKeyId !== 'all' ? parsed.data.apiKeyId : undefined;
  res.json(listUsageLogs({ ...parsed.data, apiKeyId }));
});

app.get('/api/user/logs', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  const schema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['all', 'success', 'failed']).default('all'),
    apiKeyId: z.string().optional(),
    range: z.enum(['24h', '3d', '7d', '30d']).default('24h')
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const apiKeyId = parsed.data.apiKeyId && parsed.data.apiKeyId !== 'all' ? parsed.data.apiKeyId : undefined;
  res.json(listUsageLogs({ ...parsed.data, apiKeyId, userId: user.id }));
});

app.get('/api/user/usage', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  res.json({ summary: usageSummaryForUser(user.id), keys: listKeys(user.id), account: getAccountState(user.id) });
});

app.post('/api/user/gift-cards/preview', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  const schema = z.object({ code: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    res.json(previewGiftCard(user.id, parsed.data.code));
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode || 400).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : '无法预览礼品卡。' });
  }
});

app.post('/api/user/gift-cards/redeem', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  const schema = z.object({ code: z.string().min(1), confirm: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    res.json(redeemGiftCard(user.id, parsed.data));
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode || 400).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : '无法兑换礼品卡。' });
  }
});

app.get('/api/usage', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  res.json({ summary: usageSummaryForUser(user.id), keys: listKeys(user.id), account: getAccountState(user.id) });
});

app.head('/v1', (_req, res) => {
  res.status(204).end();
});

app.get('/v1', (_req, res) => {
  res.json({
    ok: true,
    service: 'transfer-station',
    health: '/v1/key/health',
    balance: '/v1/key/balance',
    usage: '/v1/key/usage',
    now: new Date().toISOString()
  });
});

app.get('/v1/health', (_req, res) => {
  res.json({
    ok: true,
    upstreamConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    now: new Date().toISOString()
  });
});

app.get('/v1/key/health', (req, res) => {
  const key = authStatusKey(req, res);
  if (!key) return;
  res.json(buildKeyHealth(key));
});

app.get('/v1/key/balance', (req, res) => {
  const key = authStatusKey(req, res);
  if (!key) return;
  res.json(buildKeyBalance(key));
});

app.get('/v1/key/usage', (req, res) => {
  const key = authStatusKey(req, res);
  if (!key) return;
  res.json(buildKeyUsageStatus(key));
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

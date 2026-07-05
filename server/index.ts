import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import {
  addUpstreamChannelKey,
  assertQuota,
  claimTaobaoOrderGiftCards,
  createKey,
  createGiftCards,
  createUsageLog,
  deleteTaobaoProductMapping,
  deleteUpstreamChannel,
  deleteUpstreamChannelKey,
  deleteUpstreamModelRate,
  getAccountState,
  getFirstAdminUser,
  getPlan,
  getUserDetail,
  getRawKeyById,
  getKeyByRawKey,
  getTaobaoShop,
  getUserBySessionToken,
  loginUser,
  hasAvailableUpstreamChannels,
  listGiftCards,
  listRedeemedGiftCards,
  listKeys,
  listClaimedPlatformOrdersForUser,
  listPlatformOrders,
  listUsers,
  listPlans,
  listProductLinks,
  listTaobaoProductMappings,
  listTaobaoShops,
  listUpstreamChannels,
  listUpstreamSelections,
  listUsageLogs,
  extractResetTime,
  markUpstreamGroupFailure,
  markUpstreamKeyFailure,
  previewGiftCard,
  pruneUsageLogs,
  redeemGiftCard,
  revokeGiftCard,
  registerUser,
  revokeKey,
  resolveUpstreamRates,
  seedDefaults,
  saveTaobaoShop,
  touchKey,
  touchUpstreamKey,
  updateKey,
  resetUpstreamKeyFailureState,
  updateUpstreamChannelKey,
  updateProductLinks,
  markTaobaoShopMessagePermitted,
  upsertTaobaoProductMapping,
  upsertUpstreamChannel,
  upsertUpstreamModelRate,
  upsertPlan,
  usageSummaryForUser
} from './store.js';
import { decryptKey, encryptKey } from './crypto.js';
import type { AgentType, AnthropicUsage, KeyWithPlan, UpstreamSelection, User } from './types.js';
import { usageCostCents, type UsageRates } from './pricing.js';
import { exchangeTaobaoAuthCode, permitTaobaoTmcUser } from './taobao.js';
import { z } from 'zod';

const app = express();
const port = Number(process.env.PORT || 8787);
const anthropicVersion = process.env.ANTHROPIC_VERSION || '2023-06-01';
const sliderChallengeTtlMs = 5 * 60 * 1000;
const sliderTokenTtlMs = 2 * 60 * 1000;
const puzzleImageWidth = 320;
const puzzleImageHeight = 150;
const puzzlePieceSize = 44;
const puzzleTolerancePct = 2.5;
const ccSwitchUsageAutoIntervalMinutes = 5;
const upstreamHealthProbeTimeoutMs = Number(process.env.UPSTREAM_HEALTH_PROBE_TIMEOUT_MS || 30_000);
const claudeHealthProbeModel = process.env.CLAUDE_HEALTH_PROBE_MODEL || 'claude-sonnet-4-6';
const codexHealthProbeModel = process.env.CODEX_HEALTH_PROBE_MODEL || 'gpt-5.5';
const healthProbePrompt = 'Reply OK.';
const healthProbeMaxOutputTokens = 8;

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

function getClientKey(req: Request, options: { allowQuery?: boolean } = {}) {
  const authorization = req.header('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  const headerKey = req.header('x-api-key');
  if (headerKey) return headerKey;

  if (options.allowQuery) {
    const queryKey = routeParam(req.query.apiKey as string | string[] | undefined)
      || routeParam(req.query.api_key as string | string[] | undefined)
      || routeParam(req.query.key as string | string[] | undefined);
    if (queryKey) return queryKey;
  }

  return '';
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

function authStatusKey(req: Request, res: Response, options: { allowQuery?: boolean } = {}): KeyWithPlan | null {
  const rawKey = getClientKey(req, options);
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

function getTokenUsage(payload: unknown, rates: UsageRates = {}, usageMultiplier = 1) {
  const usage = payload && typeof payload === 'object' && 'usage' in payload ? (payload as any).usage : undefined;
  return normalizeUsage(usage, rates, usageMultiplier);
}

function usageFromStreamingEvent(event: unknown): AnthropicUsage | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const record = event as Record<string, any>;
  return record.usage || record.message?.usage || record.response?.usage;
}

function mergeStreamingUsage(current: AnthropicUsage, event: unknown) {
  const usage = usageFromStreamingEvent(event);
  if (!usage) return current;
  return { ...current, ...usage };
}

function scaleTokenCount(value: number, multiplier = 1) {
  return Math.max(0, Math.round(value * Math.max(1, multiplier || 1)));
}

function normalizeUsage(usage: AnthropicUsage | undefined, rates: UsageRates = {}, usageMultiplier = 1) {
  const inputTokenDetails = (usage as any)?.input_tokens_details || (usage as any)?.prompt_tokens_details;
  const totalTokenValue = (usage as any)?.total_tokens ?? (usage as any)?.totalTokens;
  const inputTokens = scaleTokenCount(Number((usage as any)?.input_tokens ?? (usage as any)?.prompt_tokens ?? 0), usageMultiplier);
  const outputTokens = scaleTokenCount(Number((usage as any)?.output_tokens ?? (usage as any)?.completion_tokens ?? 0), usageMultiplier);
  const cacheCreationInputTokens = scaleTokenCount(
    Number((usage as any)?.cache_creation_input_tokens ?? inputTokenDetails?.cache_creation_input_tokens ?? 0),
    usageMultiplier
  );
  const cacheReadInputTokens = scaleTokenCount(
    Number((usage as any)?.cache_read_input_tokens ?? inputTokenDetails?.cache_read_input_tokens ?? inputTokenDetails?.cached_tokens ?? 0),
    usageMultiplier
  );
  const totalTokens =
    typeof totalTokenValue === 'number' && Number.isFinite(totalTokenValue)
      ? scaleTokenCount(totalTokenValue, usageMultiplier)
      : inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens;
  const costs = usageCostCents({
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens
  }, rates);

  return {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    totalTokens,
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

function requestAgentApiEndpoint(req: Request, agent: 'claude' | 'codex') {
  const origin = requestOrigin(req);
  const segment = agent === 'claude' ? 'claude-code' : 'codex';
  return `${origin}/${segment}/v1`;
}

function centsToAmount(cents: number) {
  return Number(((cents || 0) / 100).toFixed(2));
}

function keyCurrency(key: KeyWithPlan) {
  const account = key.userId ? getAccountState(key.userId) : null;
  const plan = getPlan(account?.currentPlanId || key.planId) || getPlan(key.planId);
  return plan?.currency || 'CNY';
}

function upstreamConfigured() {
  return hasAvailableUpstreamChannels('claude-code') || hasAvailableUpstreamChannels('codex');
}

function routeToUpstreamPath(req: Request) {
  const pathValue = req.originalUrl;
  if (pathValue.startsWith('/claude-code/v1')) return `/v1${pathValue.slice('/claude-code/v1'.length)}`;
  if (pathValue.startsWith('/codex/v1')) return `/v1${pathValue.slice('/codex/v1'.length)}`;
  return '/v1';
}

function buildUpstreamHeaders(req: Request | null, selection: UpstreamSelection) {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  if (selection.agent === 'claude-code') {
    headers.set('x-api-key', selection.rawKey);
    headers.set('anthropic-version', req?.header('anthropic-version') || anthropicVersion);
    const betaHeader = req?.header('anthropic-beta');
    if (betaHeader) headers.set('anthropic-beta', betaHeader);
    return headers;
  }

  headers.set('authorization', `Bearer ${selection.rawKey}`);
  const openAiOrg = req?.header('openai-organization');
  const openAiProject = req?.header('openai-project');
  if (openAiOrg) headers.set('openai-organization', openAiOrg);
  if (openAiProject) headers.set('openai-project', openAiProject);
  return headers;
}

function parseJsonText(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function scaledTokenValue(value: unknown, multiplier: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  return Math.max(0, Math.round(value * multiplier));
}

function isUsageObjectKey(key: string) {
  return key === 'usage' || key.endsWith('_usage') || key.endsWith('Usage');
}

function scaleUsageObject(usage: unknown, multiplier: number) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return;
  const seen = new WeakSet<object>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    if (seen.has(value)) return;
    seen.add(value);

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (child && typeof child === 'object') {
        visit(child);
        continue;
      }
      if (/tokens?/i.test(key)) record[key] = scaledTokenValue(child, multiplier);
    }
  };
  visit(usage);
}

function scaleUsageInPayload(payload: unknown, multiplier: number) {
  if (multiplier === 1 || !payload || typeof payload !== 'object') return payload;
  const cloned = structuredClone(payload);
  const scaledUsageObjects = new WeakSet<object>();
  const scaleUsageOnce = (usage: unknown) => {
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return;
    if (scaledUsageObjects.has(usage)) return;
    scaledUsageObjects.add(usage);
    scaleUsageObject(usage, multiplier);
  };
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (isUsageObjectKey(key)) scaleUsageOnce(child);
    }
    for (const [key, child] of Object.entries(record)) {
      if (!isUsageObjectKey(key)) visit(child);
    }
  };
  visit(cloned);
  return cloned;
}

function rewriteJsonUsageText(text: string, multiplier: number) {
  if (!text) return { text, payload: {} };
  if (multiplier === 1) return { text, payload: parseJsonText(text) };
  const payload = parseJsonText(text);
  const scaledPayload = scaleUsageInPayload(payload, multiplier);
  return {
    text: JSON.stringify(scaledPayload),
    payload: scaledPayload
  };
}

function scaleSseEvent(eventText: string, multiplier: number) {
  if (multiplier === 1) return eventText;
  if (!eventText.includes('"usage"')) return eventText;
  return eventText
    .split('\n')
    .map((line) => {
      if (!line.startsWith('data:')) return line;
      const prefix = line.match(/^data:\s?/)?.[0] || 'data: ';
      const data = line.slice(prefix.length);
      if (!data || data === '[DONE]') return line;
      try {
        return `${prefix}${JSON.stringify(scaleUsageInPayload(JSON.parse(data), multiplier))}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

function upstreamErrorMessage(payload: unknown, fallback: string) {
  const error = payload && typeof payload === 'object' && 'error' in payload ? (payload as any).error : null;
  if (typeof error === 'string') return error;
  if (error?.message) return String(error.message);
  if (payload && typeof payload === 'object' && 'message' in payload && (payload as any).message) {
    return String((payload as any).message);
  }
  return fallback;
}

function parseRetryValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const now = Date.now();
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (value > 1_000_000_000_000) return new Date(value).toISOString();
    if (value > 1_000_000_000) return new Date(value * 1000).toISOString();
    return new Date(now + value * 1000).toISOString();
  }

  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return parseRetryValue(Number(text));

  const duration = text.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/i);
  if (duration) {
    const amount = Number(duration[1]);
    const unit = duration[2].toLowerCase();
    const multiplier = unit === 'ms' ? 1 : unit === 's' ? 1000 : unit === 'm' ? 60_000 : 3_600_000;
    return new Date(now + amount * multiplier).toISOString();
  }

  const parsed = Date.parse(text);
  if (Number.isFinite(parsed) && parsed > now) return new Date(parsed).toISOString();
  return null;
}

function nestedValue(source: unknown, pathValue: string) {
  return pathValue.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

function recoveryUntilFromUpstream(headers: Headers, payload: unknown) {
  const headerNames = [
    'retry-after',
    'x-ratelimit-reset',
    'x-ratelimit-reset-requests',
    'x-ratelimit-reset-tokens',
    'x-rate-limit-reset',
    'x-quota-reset'
  ];
  for (const name of headerNames) {
    const parsed = parseRetryValue(headers.get(name));
    if (parsed) return parsed;
  }

  const jsonPaths = [
    'retry_after',
    'retryAfter',
    'retry_after_ms',
    'reset_at',
    'resetAt',
    'resets_at',
    'quota_reset_at',
    'error.retry_after',
    'error.retryAfter',
    'error.retry_after_ms',
    'error.reset_at',
    'error.resetAt',
    'error.resets_at'
  ];
  for (const pathValue of jsonPaths) {
    const value = nestedValue(payload, pathValue);
    if (pathValue.endsWith('_ms') && typeof value === 'number') {
      const parsed = parseRetryValue(value / 1000);
      if (parsed) return parsed;
      continue;
    }
    const parsed = parseRetryValue(value);
    if (parsed) return parsed;
  }

  return null;
}

function isKeyLevelFailure(statusCode: number, message: string) {
  if (statusCode === 402 || statusCode === 429) return true;
  const normalized = message.toLowerCase();
  return /\b(quota|credit|balance|exhaust|insufficient|rate limit|billing)\b/.test(normalized);
}

function isGroupLevelFailure(statusCode: number) {
  return statusCode >= 500;
}

function buildKeyHealth(key: KeyWithPlan) {
  const quotaCheck = assertQuota(key);
  const configured = upstreamConfigured();
  const ok = configured && quotaCheck.ok;

  return {
    ok,
    status: ok ? 'healthy' : configured ? 'quota_exceeded' : 'configuration_error',
    message: ok
      ? 'Key is ready'
      : configured
        ? quotaCheck.message
        : 'No upstream channel is available',
    upstreamConfigured: configured,
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

function healthProbeSpec(agent: AgentType) {
  if (agent === 'claude-code') {
    return {
      path: '/v1/messages',
      model: claudeHealthProbeModel,
      body: {
        model: claudeHealthProbeModel,
        max_tokens: healthProbeMaxOutputTokens,
        messages: [{ role: 'user', content: healthProbePrompt }]
      }
    };
  }

  return {
    path: '/v1/responses',
    model: codexHealthProbeModel,
    body: {
      model: codexHealthProbeModel,
      input: healthProbePrompt,
      max_output_tokens: healthProbeMaxOutputTokens
    }
  };
}

function extractHealthProbeReply(agent: AgentType, payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;

  if (agent === 'claude-code') {
    const content = record.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const text = (part as Record<string, unknown>).text;
          return typeof text === 'string' ? text : '';
        })
        .filter(Boolean)
        .join(' ')
        .trim();
    }
    return '';
  }

  if (typeof record.output_text === 'string') return record.output_text.trim();
  if (!Array.isArray(record.output)) return '';
  return record.output
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) return [];
      return content.map((part) => {
        if (!part || typeof part !== 'object') return '';
        const value = part as Record<string, unknown>;
        const text = value.text || value.content || value.value;
        return typeof text === 'string' ? text : '';
      });
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function probeKeyHealth(key: KeyWithPlan, agent: AgentType) {
  const startedAt = Date.now();
  const quotaCheck = assertQuota(key);
  const selections = listUpstreamSelections(agent);
  const spec = healthProbeSpec(agent);
  const attempts: Array<{
    upstream: string;
    channelNumber: number | null;
    statusCode: number | null;
    ok: boolean;
    latencyMs: number;
    message: string;
    requestId: string | null;
  }> = [];

  if (!selections.length) {
    return {
      ok: false,
      status: 'configuration_error',
      message: `No upstream channel is available for ${agent}`,
      upstreamConfigured: upstreamConfigured(),
      key: {
        id: key.id,
        name: key.name,
        preview: key.keyPreview,
        status: key.status
      },
      probe: {
        agent,
        model: spec.model,
        promptTokenBudget: 'fixed-minimal',
        maxOutputTokens: healthProbeMaxOutputTokens,
        attempts
      },
      quota: quotaCheck.quota,
      quotaOk: quotaCheck.ok,
      now: new Date().toISOString()
    };
  }

  if (!quotaCheck.ok) {
    return {
      ok: false,
      status: 'quota_exceeded',
      message: quotaCheck.message,
      upstreamConfigured: upstreamConfigured(),
      key: {
        id: key.id,
        name: key.name,
        preview: key.keyPreview,
        status: key.status
      },
      probe: {
        agent,
        model: spec.model,
        promptTokenBudget: 'fixed-minimal',
        maxOutputTokens: healthProbeMaxOutputTokens,
        attempts
      },
      quota: quotaCheck.quota,
      quotaOk: quotaCheck.ok,
      now: new Date().toISOString(),
      statusCode: quotaCheck.statusCode
    };
  }

  for (const selection of selections) {
    const attemptStartedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), upstreamHealthProbeTimeoutMs);
    try {
      const upstream = await fetch(`${selection.apiUrl}${spec.path}`, {
        method: 'POST',
        headers: buildUpstreamHeaders(null, selection),
        body: JSON.stringify(spec.body),
        signal: controller.signal
      });
      touchUpstreamKey(selection.key.id);
      const text = await upstream.text();
      const payload = parseJsonText(text);
      const requestId = upstream.headers.get('request-id') || upstream.headers.get('x-request-id');
      const reply = upstream.ok ? extractHealthProbeReply(agent, payload) : '';
      const errorMessage = upstreamErrorMessage(payload, upstream.statusText);
      const attempt = {
        upstream: 'RelayHub',
        channelNumber: selection.group.channelNumber,
        statusCode: upstream.status,
        ok: upstream.ok && Boolean(reply),
        latencyMs: Date.now() - attemptStartedAt,
        message: upstream.ok && reply ? 'Probe response received' : errorMessage || 'Probe did not return a text response',
        requestId
      };
      attempts.push(attempt);

      if (attempt.ok) {
        return {
          ok: true,
          status: 'healthy',
          message: 'Upstream probe succeeded',
          upstreamConfigured: true,
          key: {
            id: key.id,
            name: key.name,
            preview: key.keyPreview,
            status: key.status
          },
          probe: {
            agent,
            model: spec.model,
            upstream: 'RelayHub',
            channelNumber: selection.group.channelNumber,
            responseStatusCode: upstream.status,
            responseTimeMs: Date.now() - startedAt,
            requestId,
            promptTokenBudget: 'fixed-minimal',
            maxOutputTokens: healthProbeMaxOutputTokens
          },
          quota: quotaCheck.quota,
          quotaOk: quotaCheck.ok,
          now: new Date().toISOString()
        };
      }
    } catch (error) {
      attempts.push({
        upstream: 'RelayHub',
        channelNumber: selection.group.channelNumber,
        statusCode: null,
        ok: false,
        latencyMs: Date.now() - attemptStartedAt,
        message: error instanceof Error ? error.message : 'Probe request failed',
        requestId: null
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    status: 'upstream_unavailable',
    message: 'All upstream health probes failed',
    upstreamConfigured: true,
    key: {
      id: key.id,
      name: key.name,
      preview: key.keyPreview,
      status: key.status
    },
    probe: {
      agent,
      model: spec.model,
      responseTimeMs: Date.now() - startedAt,
      promptTokenBudget: 'fixed-minimal',
      maxOutputTokens: healthProbeMaxOutputTokens,
      attempts
    },
    quota: quotaCheck.quota,
    quotaOk: quotaCheck.ok,
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
  const healthUrl = `${endpoint}/key/health`;
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
    usageAutoInterval: String(ccSwitchUsageAutoIntervalMinutes),
    healthUrl,
    healthCheckUrl: healthUrl,
    healthApiKey: apiKey
  });
  return `ccswitch://v1/import?${params.toString()}`;
}

function writeProxyLog(input: {
  key: KeyWithPlan | null;
  channelGroupId?: string | null;
  channelNumber?: number | null;
  model: string;
  path: string;
  method: string;
  statusCode: number;
  startedAt: number;
  usage?: AnthropicUsage;
  usageSource?: 'plan' | 'balance' | 'none';
  rates?: UsageRates;
  usageMultiplier?: number;
  errorMessage?: string | null;
  requestId: string;
}) {
  const usage = normalizeUsage(input.usage, input.rates, input.usageMultiplier);
  createUsageLog({
    apiKeyId: input.key?.id ?? null,
    channelGroupId: input.channelGroupId ?? null,
    channelNumber: input.channelNumber ?? null,
    usageSource: input.usageSource || 'plan',
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
    upstreamConfigured: upstreamConfigured(),
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
    productLinks: listProductLinks(),
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

app.get('/api/product-links', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  res.json({ productLinks: listProductLinks() });
});

app.patch('/api/product-links', adminGuard, (req, res) => {
  const schema = z.object({
    productLinks: z.array(
      z.object({
        itemType: z.enum(['plan', 'credit']),
        itemId: z.string().min(1),
        channel: z.enum(['taobao', 'xianyu']),
        url: z.string().url()
      })
    )
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    res.json({ productLinks: updateProductLinks(parsed.data.productLinks) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save product links' });
  }
});

app.get('/api/taobao/shops', adminGuard, (_req, res) => {
  res.json({ shops: listTaobaoShops() });
});

app.post('/api/taobao/shops', adminGuard, (req, res) => {
  const schema = z.object({
    id: z.string().min(1),
    nick: z.string().optional(),
    sessionKey: z.string().min(1),
    sessionExpiresAt: z.string().nullable().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const shop = saveTaobaoShop({
    id: parsed.data.id,
    nick: parsed.data.nick,
    sessionCiphertext: encryptKey(parsed.data.sessionKey),
    sessionExpiresAt: parsed.data.sessionExpiresAt || null
  });
  res.status(201).json({ shop, shops: listTaobaoShops() });
});

app.get('/api/taobao/oauth/start', adminGuard, (_req, res) => {
  const appKey = process.env.TAOBAO_APP_KEY?.trim();
  const redirectUri = process.env.TAOBAO_REDIRECT_URI?.trim();
  const state = (process.env.TAOBAO_OAUTH_STATE || process.env.ADMIN_TOKEN || '').trim();

  if (!appKey || !redirectUri || !state) {
    res.status(400).json({ error: '缺少淘宝 OAuth 配置，请检查 TAOBAO_APP_KEY、TAOBAO_REDIRECT_URI、TAOBAO_OAUTH_STATE。' });
    return;
  }

  const authorizeUrl = new URL('https://oauth.taobao.com/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', appKey);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);

  res.json({ authorizeUrl: authorizeUrl.toString() });
});

app.get('/api/taobao/oauth/callback', async (req, res) => {
  const schema = z.object({
    code: z.string().min(1),
    state: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const expectedState = process.env.TAOBAO_OAUTH_STATE || process.env.ADMIN_TOKEN || '';
  if (!expectedState || parsed.data.state !== expectedState) {
    res.status(403).json({ error: '淘宝授权 state 不匹配。' });
    return;
  }

  try {
    const token = await exchangeTaobaoAuthCode(parsed.data.code, process.env.TAOBAO_REDIRECT_URI);
    const savedShop = saveTaobaoShop({
      id: String(token.taobao_user_id || token.taobao_user_nick || 'default'),
      nick: token.taobao_user_nick || '',
      sessionCiphertext: encryptKey(token.access_token),
      sessionExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null
    });
    const title = encodeURIComponent('淘宝店铺授权成功');
    const savedShopLabel = savedShop ? (savedShop.nick || savedShop.id) : String(token.taobao_user_nick || token.taobao_user_id || 'default');
    const detail = encodeURIComponent(`已保存店铺 ${savedShopLabel} 的授权信息，请返回管理台刷新查看。`);
    res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>淘宝授权成功</title><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><script>try{window.opener?.postMessage({type:'taobao-oauth-complete',ok:true,title:decodeURIComponent('${title}'),detail:decodeURIComponent('${detail}')},window.location.origin);}catch(e){}window.close();</script><p>淘宝授权成功，正在返回管理台…</p></body></html>`);
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : '淘宝授权失败。');
    res.status(400).type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>淘宝授权失败</title><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><script>try{window.opener?.postMessage({type:'taobao-oauth-complete',ok:false,title:'淘宝店铺授权失败',detail:decodeURIComponent('${message}')},window.location.origin);}catch(e){}window.close();</script><p>淘宝授权失败，请返回管理台重试。</p></body></html>`);
  }
});

app.post('/api/taobao/shops/:id/permit', adminGuard, async (req, res) => {
  const shop = getTaobaoShop(routeParam(req.params.id));
  const session = shop ? decryptKey(shop.sessionCiphertext) : null;
  if (!shop || !session) {
    res.status(404).json({ error: '淘宝店铺授权不存在或不可解密。' });
    return;
  }

  const schema = z.object({
    topics: z.array(z.string().min(1)).optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const permitted = await permitTaobaoTmcUser(session, parsed.data.topics);
    if (!permitted) throw new Error('淘宝 TMC 开通未返回成功状态。');
    res.json({ shop: markTaobaoShopMessagePermitted(shop.id), shops: listTaobaoShops() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '淘宝消息开通失败。' });
  }
});

app.get('/api/taobao/product-mappings', adminGuard, (_req, res) => {
  res.json({ mappings: listTaobaoProductMappings() });
});

app.post('/api/taobao/product-mappings', adminGuard, (req, res) => {
  const schema = z.discriminatedUnion('giftType', [
    z.object({
      id: z.string().optional(),
      numIid: z.string().min(1),
      skuId: z.string().nullable().optional(),
      title: z.string().optional(),
      giftType: z.literal('credit'),
      amountCents: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().min(1).max(20).default(1),
      isActive: z.boolean().optional()
    }),
    z.object({
      id: z.string().optional(),
      numIid: z.string().min(1),
      skuId: z.string().nullable().optional(),
      title: z.string().optional(),
      giftType: z.literal('plan'),
      planId: z.string().min(1),
      durationMonths: z.coerce.number().int().min(1).max(36).default(1),
      quantity: z.coerce.number().int().min(1).max(20).default(1),
      isActive: z.boolean().optional()
    })
  ]);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    res.status(201).json({ mappings: upsertTaobaoProductMapping(parsed.data) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : '保存淘宝商品映射失败。' });
  }
});

app.delete('/api/taobao/product-mappings/:id', adminGuard, (req, res) => {
  const mapping = deleteTaobaoProductMapping(routeParam(req.params.id));
  if (!mapping) {
    res.status(404).json({ error: '淘宝商品映射不存在。' });
    return;
  }
  res.json({ mapping, mappings: listTaobaoProductMappings() });
});

app.get('/api/taobao/orders', adminGuard, (req, res) => {
  const schema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json(listPlatformOrders(parsed.data));
});

app.post('/api/user/orders/claim', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  const schema = z.object({ orderId: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const orders = claimTaobaoOrderGiftCards(parsed.data.orderId, user.id);
    if (!orders.length) {
      res.status(404).json({ error: '订单未找到或兑换码尚未生成，请确认付款后稍后再试。' });
      return;
    }

    res.json({
      orders: orders.map((order) => ({
        orderId: order.orderId,
        subOrderId: order.subOrderId,
        platform: order.platform,
        title: order.title,
        giftCardCode: order.giftCardCode,
        deliveryStatus: order.deliveryStatus,
        claimedAt: order.claimedAt,
        updatedAt: order.updatedAt
      }))
    });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode || 400).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : '领取兑换码失败。' });
  }
});

app.get('/api/user/orders/claims', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  const schema = z.object({
    days: z.coerce.number().int().positive().max(30).default(30),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    giftCardType: z.enum(['all', 'credit', 'plan']).default('all'),
    giftCardCode: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json(listClaimedPlatformOrdersForUser(
    user.id,
    parsed.data.days,
    parsed.data.page,
    parsed.data.pageSize,
    parsed.data.giftCardType,
    parsed.data.giftCardCode || ''
  ));
});

app.get('/api/user/gift-card-redemptions', (req, res) => {
  const user = authUser(req, res);
  if (!user) return;
  const schema = z.object({
    days: z.coerce.number().int().positive().max(30).default(30),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    type: z.enum(['all', 'credit', 'plan']).default('all'),
    code: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json(listRedeemedGiftCards({ userId: user.id, ...parsed.data }));
});

app.get('/api/admin/gift-card-redemptions', adminGuard, (req, res) => {
  const schema = z.object({
    days: z.coerce.number().int().positive().max(30).default(30),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    userId: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json(listRedeemedGiftCards(parsed.data));
});

app.get('/api/gift-cards', adminGuard, (req, res) => {
  const schema = z.object({
    type: z.enum(['plan', 'credit']).optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20)
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json(listGiftCards(parsed.data));
});

app.post('/api/gift-cards', adminGuard, (req, res) => {
  const schema = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('credit'),
      amountCents: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().min(1).max(200).default(1),
      prefix: z.string().optional()
    }),
    z.object({
      type: z.literal('plan'),
      planId: z.string().min(1),
      durationMonths: z.coerce.number().int().min(1).max(36).default(1),
      quantity: z.coerce.number().int().min(1).max(200).default(1),
      prefix: z.string().optional()
    })
  ]);

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const adminUser = res.locals.adminUser as User | undefined;
    const giftCards = createGiftCards({
      ...parsed.data,
      createdByUserId: adminUser?.id || null
    });
    res.status(201).json({ giftCards });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode || 400).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create gift cards' });
  }
});

app.patch('/api/gift-cards/:code/revoke', adminGuard, (req, res) => {
  try {
    const adminUser = res.locals.adminUser as User | undefined;
    const giftCard = revokeGiftCard(routeParam(req.params.code), adminUser?.id || null);
    res.json({ giftCard, giftCards: listGiftCards({ page: 1, pageSize: 20 }) });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      res.status((error as any).statusCode || 400).json({ error: error.message });
      return;
    }
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to revoke gift card' });
  }
});

const upstreamChannelSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  status: z.enum(['active', 'paused']).optional(),
  claudeApiUrl: z.string().url(),
  codexApiUrl: z.string().url(),
  useIndependentAgentKeys: z.boolean().optional(),
  inputRatePerMillion: z.coerce.number().nonnegative().optional(),
  outputRatePerMillion: z.coerce.number().nonnegative().optional(),
  cacheCreationRatePerMillion: z.coerce.number().nonnegative().optional(),
  cacheReadRatePerMillion: z.coerce.number().nonnegative().optional(),
  serverErrorRecoveryMinutes: z.coerce.number().int().min(5).max(300).optional(),
  displayUsageMultiplier: z.coerce.number().min(1).optional(),
  sortOrder: z.coerce.number().int().positive().optional()
});

const upstreamKeySchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  agentType: z.enum(['shared', 'claude-code', 'codex']).optional(),
  sortOrder: z.coerce.number().int().optional(),
  expiresAt: z.string().nullable().optional()
});

const upstreamModelRateSchema = z.object({
  id: z.string().min(1).optional(),
  agentType: z.enum(['claude-code', 'codex']),
  model: z.string().min(1),
  inputRatePerMillion: z.coerce.number().nonnegative().optional(),
  outputRatePerMillion: z.coerce.number().nonnegative().optional(),
  cacheCreationRatePerMillion: z.coerce.number().nonnegative().optional(),
  cacheReadRatePerMillion: z.coerce.number().nonnegative().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

app.get('/api/upstream-channels', adminGuard, (_req, res) => {
  res.json({ channels: listUpstreamChannels() });
});

app.post('/api/upstream-channels', adminGuard, (req, res) => {
  const parsed = upstreamChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const channel = upsertUpstreamChannel(parsed.data);
    res.status(parsed.data.id ? 200 : 201).json({ channel, channels: listUpstreamChannels() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save upstream channel' });
  }
});

app.patch('/api/upstream-channels/:id', adminGuard, (req, res) => {
  const parsed = upstreamChannelSchema.omit({ id: true }).partial().required({ name: true, claudeApiUrl: true, codexApiUrl: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const channel = upsertUpstreamChannel({ id: routeParam(req.params.id), ...parsed.data });
    res.json({ channel, channels: listUpstreamChannels() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save upstream channel' });
  }
});

app.delete('/api/upstream-channels/:id', adminGuard, (req, res) => {
  const channel = deleteUpstreamChannel(routeParam(req.params.id));
  if (!channel) {
    res.status(404).json({ error: 'Channel not found' });
    return;
  }
  res.json({ channel, channels: listUpstreamChannels() });
});

app.post('/api/upstream-channels/:id/keys', adminGuard, (req, res) => {
  const parsed = upstreamKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const channel = addUpstreamChannelKey(routeParam(req.params.id), parsed.data);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.status(201).json({ channel, channels: listUpstreamChannels() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to add upstream key' });
  }
});

app.patch('/api/upstream-channels/:id/keys/:keyId', adminGuard, (req, res) => {
  const parsed = upstreamKeySchema.extend({ key: z.string().optional() }).partial().extend({
    status: z.enum(['active', 'paused', 'revoked', 'banned']).optional()
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const channel = updateUpstreamChannelKey(routeParam(req.params.id), routeParam(req.params.keyId), parsed.data);
    if (!channel) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }
    res.json({ channel, channels: listUpstreamChannels() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update upstream key' });
  }
});

app.delete('/api/upstream-channels/:id/keys/:keyId', adminGuard, (req, res) => {
  const key = deleteUpstreamChannelKey(routeParam(req.params.id), routeParam(req.params.keyId));
  if (!key) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }
  res.json({ key, channels: listUpstreamChannels() });
});

app.post('/api/upstream-channels/:id/model-rates', adminGuard, (req, res) => {
  const parsed = upstreamModelRateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const channel = upsertUpstreamModelRate(routeParam(req.params.id), parsed.data);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.status(201).json({ channel, channels: listUpstreamChannels() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save model rate' });
  }
});

app.patch('/api/upstream-channels/:id/model-rates/:rateId', adminGuard, (req, res) => {
  const parsed = upstreamModelRateSchema.partial().required({ agentType: true, model: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const channel = upsertUpstreamModelRate(routeParam(req.params.id), { id: routeParam(req.params.rateId), ...parsed.data });
    if (!channel) {
      res.status(404).json({ error: 'Rate not found' });
      return;
    }
    res.json({ channel, channels: listUpstreamChannels() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save model rate' });
  }
});

app.delete('/api/upstream-channels/:id/model-rates/:rateId', adminGuard, (req, res) => {
  const rate = deleteUpstreamModelRate(routeParam(req.params.id), routeParam(req.params.rateId));
  if (!rate) {
    res.status(404).json({ error: 'Rate not found' });
    return;
  }
  res.json({ rate, channels: listUpstreamChannels() });
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

  res.json({
    key: result.rawKey,
    keyPreview: result.key.keyPreview,
    ccSwitch: {
      codex: buildCcSwitchProviderLink('codex', 'RelayHub Codex', requestAgentApiEndpoint(req, 'codex'), result.rawKey),
      claude: buildCcSwitchProviderLink('claude', 'RelayHub Claude Code', requestAgentApiEndpoint(req, 'claude'), result.rawKey)
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

  res.json({
    key: result.rawKey,
    keyPreview: result.key.keyPreview,
    ccSwitch: {
      codex: buildCcSwitchProviderLink('codex', 'RelayHub Codex', requestAgentApiEndpoint(req, 'codex'), result.rawKey),
      claude: buildCcSwitchProviderLink('claude', 'RelayHub Claude Code', requestAgentApiEndpoint(req, 'claude'), result.rawKey)
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

app.get('/api/admin/users', adminGuard, (req, res) => {
  const schema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    sortField: z.enum(['freeCreditCents', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json(listUsers(parsed.data));
});

app.get('/api/admin/users/:id', adminGuard, (req, res) => {
  const user = getUserDetail(routeParam(req.params.id));
  if (!user) {
    res.status(404).json({ error: '用户不存在。' });
    return;
  }
  res.json({ user });
});

app.get('/api/admin/users/:id/logs', adminGuard, (req, res) => {
  const targetUser = getUserDetail(routeParam(req.params.id));
  if (!targetUser) {
    res.status(404).json({ error: '用户不存在。' });
    return;
  }
  const schema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['all', 'success', 'failed']).default('all'),
    apiKeyId: z.string().optional(),
    range: z.enum(['24h', '3d', '7d', '30d']).default('30d')
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const apiKeyId = parsed.data.apiKeyId && parsed.data.apiKeyId !== 'all' ? parsed.data.apiKeyId : undefined;
  res.json(listUsageLogs({ ...parsed.data, apiKeyId, userId: targetUser.id }));
});

app.get('/api/admin/users/:id/order-claims', adminGuard, (req, res) => {
  const targetUser = getUserDetail(routeParam(req.params.id));
  if (!targetUser) {
    res.status(404).json({ error: '用户不存在。' });
    return;
  }
  const schema = z.object({
    days: z.coerce.number().int().positive().max(30).default(30),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    giftCardType: z.enum(['all', 'credit', 'plan']).default('all'),
    giftCardCode: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json(listClaimedPlatformOrdersForUser(
    targetUser.id,
    parsed.data.days,
    parsed.data.page,
    parsed.data.pageSize,
    parsed.data.giftCardType,
    parsed.data.giftCardCode || ''
  ));
});

app.get('/api/admin/users/:id/gift-card-redemptions', adminGuard, (req, res) => {
  const targetUser = getUserDetail(routeParam(req.params.id));
  if (!targetUser) {
    res.status(404).json({ error: '用户不存在。' });
    return;
  }
  const schema = z.object({
    days: z.coerce.number().int().positive().max(30).default(30),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    type: z.enum(['all', 'credit', 'plan']).default('all'),
    code: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  res.json(listRedeemedGiftCards({ userId: targetUser.id, ...parsed.data }));
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

for (const prefix of ['/claude-code/v1', '/codex/v1']) {
  app.head(prefix, (_req, res) => {
    res.status(204).end();
  });

  app.get(prefix, (_req, res) => {
    res.json({
      ok: true,
      service: 'transfer-station',
      health: `${prefix}/key/health`,
      balance: `${prefix}/key/balance`,
      usage: `${prefix}/key/usage`,
      now: new Date().toISOString()
    });
  });

  app.get(`${prefix}/health`, (_req, res) => {
    res.json({
      ok: true,
      upstreamConfigured: upstreamConfigured(),
      now: new Date().toISOString()
    });
  });

  app.get(`${prefix}/key/health`, (req, res) => {
    const key = authStatusKey(req, res, { allowQuery: true });
    if (!key) return;
    const agent: AgentType = prefix.startsWith('/codex') ? 'codex' : 'claude-code';
    void probeKeyHealth(key, agent)
      .then((health) => {
        const statusCode =
          typeof (health as { statusCode?: unknown }).statusCode === 'number'
            ? ((health as { statusCode: number }).statusCode || 503)
            : health.ok
              ? 200
              : 503;
        res.status(statusCode).json(health);
      })
      .catch((error) => {
        res.status(503).json({
          ok: false,
          status: 'probe_error',
          message: error instanceof Error ? error.message : 'Health probe failed',
          now: new Date().toISOString()
        });
      });
  });

  app.get(`${prefix}/key/balance`, (req, res) => {
    const key = authStatusKey(req, res);
    if (!key) return;
    res.json(buildKeyBalance(key));
  });

  app.get(`${prefix}/key/usage`, (req, res) => {
    const key = authStatusKey(req, res);
    if (!key) return;
    res.json(buildKeyUsageStatus(key));
  });
}

async function handleProxyRequest(req: Request, res: Response, agent: AgentType) {
  const startedAt = Date.now();
  const key = authProxyKey(req, res);
  if (!key) return;
  const upstreamPath = routeToUpstreamPath(req);

  const quotaCheck = assertQuota(key);
  if (!quotaCheck.ok) {
    createUsageLog({
      apiKeyId: key.id,
      channelGroupId: null,
      channelNumber: null,
      usageSource: 'none',
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

  const selections = listUpstreamSelections(agent);
  if (!selections.length) {
    writeProxyLog({
      key,
      model: req.body?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: 500,
      startedAt,
      errorMessage: `No upstream channel is available for ${agent}`,
      requestId: `local_${crypto.randomUUID()}`
    });
    res.status(500).json({
      type: 'error',
      error: {
        type: 'configuration_error',
        message: `No upstream channel is available for ${agent}`
      }
    });
    return;
  }

  let lastFailure: {
    statusCode: number;
    message: string;
    requestId: string;
  } | null = null;
  const attemptedGroupIds = new Set<string>();
  try {
    for (const selection of selections) {
      if (attemptedGroupIds.has(selection.group.id) && isGroupLevelFailure(lastFailure?.statusCode || 0)) {
        continue;
      }

      const upstreamUrl = `${selection.apiUrl}${upstreamPath}`;
      const upstream = await fetch(upstreamUrl, {
        method: req.method,
        headers: buildUpstreamHeaders(req, selection),
        body: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : JSON.stringify(req.body ?? {})
      });

      touchUpstreamKey(selection.key.id);
      const requestId = upstream.headers.get('request-id') || upstream.headers.get('x-request-id') || `up_${crypto.randomUUID()}`;
      const contentType = upstream.headers.get('content-type') || 'application/json';
      const requestModel = req.body?.model || 'unknown';
      const rates = resolveUpstreamRates({ groupId: selection.group.id, agent, model: requestModel });
      const displayUsageMultiplier = selection.group.displayUsageMultiplier;

      if (contentType.includes('text/event-stream') && upstream.body) {
        touchKey(key.id);
        res.status(upstream.status);
        res.setHeader('content-type', contentType);
        res.setHeader('x-transfer-station-key', key.keyPreview);
        res.setHeader('x-transfer-station-upstream', 'RelayHub');
        res.setHeader('x-transfer-station-quota-five-hour-remaining', String(quotaCheck.quota.remainingFiveHour));
        res.setHeader('x-transfer-station-quota-weekly-remaining', String(quotaCheck.quota.remainingWeekly));
        await streamSse(upstream, req, res, {
          key,
          channelGroupId: selection.group.id,
          channelNumber: selection.group.channelNumber,
          model: requestModel,
          path: req.path,
          method: req.method,
          statusCode: upstream.status,
          startedAt,
          requestId,
          rates,
          displayUsageMultiplier,
          usageSource: quotaCheck.quota.quotaSource
        });
        return;
      }

      const text = await upstream.text();
      const payload = parseJsonText(text);
      const errorMessage = upstreamErrorMessage(payload, upstream.statusText);

      if (!upstream.ok && isKeyLevelFailure(upstream.status, errorMessage)) {
        markUpstreamKeyFailure({
          keyId: selection.key.id,
          statusCode: upstream.status,
          reason: errorMessage,
          until: recoveryUntilFromUpstream(upstream.headers, payload) || extractResetTime(payload)
        });
        lastFailure = { statusCode: upstream.status, message: errorMessage, requestId };
        continue;
      }

      if (!upstream.ok && isGroupLevelFailure(upstream.status)) {
        attemptedGroupIds.add(selection.group.id);
        markUpstreamGroupFailure({
          groupId: selection.group.id,
          statusCode: upstream.status,
          reason: errorMessage,
          until: recoveryUntilFromUpstream(upstream.headers, payload)
        });
        lastFailure = { statusCode: upstream.status, message: errorMessage, requestId };
        continue;
      }

      resetUpstreamKeyFailureState(selection.key.id);
      touchKey(key.id);
      res.status(upstream.status);
      res.setHeader('content-type', contentType);
      res.setHeader('x-transfer-station-key', key.keyPreview);
      res.setHeader('x-transfer-station-upstream', 'RelayHub');
      res.setHeader('x-transfer-station-usage-multiplier', displayUsageMultiplier.toFixed(2));
      res.setHeader('x-transfer-station-quota-five-hour-remaining', String(quotaCheck.quota.remainingFiveHour));
      res.setHeader('x-transfer-station-quota-weekly-remaining', String(quotaCheck.quota.remainingWeekly));
      const responseBody = contentType.includes('application/json')
        ? rewriteJsonUsageText(text, displayUsageMultiplier).text
        : text;
      res.send(responseBody);

      const loggedModel = req.body?.model || (payload as any)?.model || 'unknown';
      const tokenUsage = getTokenUsage(
        payload,
        resolveUpstreamRates({ groupId: selection.group.id, agent, model: loggedModel }),
        displayUsageMultiplier
      );
      createUsageLog({
        apiKeyId: key.id,
        channelGroupId: selection.group.id,
        channelNumber: selection.group.channelNumber,
        usageSource: quotaCheck.quota.quotaSource,
        model: loggedModel,
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
        errorMessage: upstream.ok ? null : errorMessage,
        requestId
      });
      return;
    }

    const message = lastFailure?.message || 'All upstream channels failed';
    writeProxyLog({
      key,
      model: req.body?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: lastFailure?.statusCode || 502,
      startedAt,
      errorMessage: message,
      requestId: lastFailure?.requestId || `local_${crypto.randomUUID()}`
    });
    res.status(lastFailure?.statusCode || 502).json({
      type: 'error',
      error: {
        type: lastFailure?.statusCode === 402 ? 'rate_limit_error' : 'api_error',
        message
      }
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
}

app.all('/claude-code/v1/*route', (req, res) => {
  void handleProxyRequest(req, res, 'claude-code');
});

app.all('/codex/v1/*route', (req, res) => {
  void handleProxyRequest(req, res, 'codex');
});

app.all(['/v1', '/v1/*route'], (_req, res) => {
  res.status(404).json({
    type: 'error',
    error: {
      type: 'not_found_error',
      message: 'Legacy /v1 endpoint has been removed. Use /claude-code/v1 or /codex/v1.'
    }
  });
});

async function streamSse(
  upstream: globalThis.Response,
  req: Request,
  res: Response,
  logContext: {
    key: KeyWithPlan;
    channelGroupId?: string | null;
    channelNumber?: number | null;
    model: string;
    path: string;
    method: string;
    statusCode: number;
    startedAt: number;
	    requestId: string;
	    usageSource?: 'plan' | 'balance' | 'none';
	    rates?: UsageRates;
    displayUsageMultiplier?: number;
  }
) {
  const decoder = new TextDecoder();
  const reader = upstream.body!.getReader();
  let buffered = '';
  let finalUsage: AnthropicUsage = {};
  let errorMessage: string | null = upstream.ok ? null : upstream.statusText;
  const displayUsageMultiplier = logContext.displayUsageMultiplier || 1;
  let clientClosed = false;

  const markClientClosed = () => {
    clientClosed = true;
  };
  req.on('aborted', markClientClosed);
  res.on('close', markClientClosed);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunkText = decoder.decode(value, { stream: true });
    buffered += chunkText;

    const events = buffered.split('\n\n');
    buffered = events.pop() || '';

    for (const eventText of events) {
      if (!clientClosed && !res.writableEnded && !res.destroyed) {
        res.write(`${scaleSseEvent(eventText, displayUsageMultiplier)}\n\n`);
      }
      const dataLines = eventText
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s?/, ''));

      for (const dataLine of dataLines) {
        if (!dataLine || dataLine === '[DONE]') continue;
        try {
          const event = JSON.parse(dataLine);
          finalUsage = mergeStreamingUsage(finalUsage, event);
          if (event?.type === 'error') {
            errorMessage = event?.error?.message || 'Streaming error';
          }
        } catch {
          // Ignore partial or non-JSON SSE data.
        }
      }
    }
  }
  if (buffered && !clientClosed && !res.writableEnded && !res.destroyed) {
    res.write(scaleSseEvent(buffered, displayUsageMultiplier));
  }

  req.off('aborted', markClientClosed);
  res.off('close', markClientClosed);
  if (!clientClosed && !res.writableEnded && !res.destroyed) res.end();
  writeProxyLog({
    ...logContext,
    usage: finalUsage,
    usageSource: logContext.usageSource,
    usageMultiplier: logContext.displayUsageMultiplier,
    errorMessage: errorMessage || (clientClosed ? 'Client disconnected; upstream drained for final usage' : null)
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../dist/client');

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Claude Code transfer station listening on http://localhost:${port}`);
});

import { customAlphabet } from 'nanoid';
import { db, mapUpstreamChannel, mapUpstreamChannelKey, mapUpstreamModelRate, nowIso } from '../../db.js';
import type {
  AgentType,
  UpstreamChannelGroup,
  UpstreamChannelGroupListItem,
  UpstreamChannelKey,
  UpstreamChannelKeyListItem,
  UpstreamKeyAgentType,
  UpstreamModelRate,
  UpstreamSelectionCandidate
} from '../../types.js';

export const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
export const upstreamKeyDegradeMs = 30 * 60 * 1000;
export const lastUsedTouchIntervalMs = 60 * 1000;
export const upstreamSelectionCacheTtlMs = 10 * 1000;
export const upstreamRawKeyCacheTtlMs = 5 * 60 * 1000;

export const upstreamKeyTouchedAt = new Map<string, number>();
export const upstreamSelectionCache = new Map<AgentType, { expiresAt: number; selections: UpstreamSelectionCandidate[] }>();
export const upstreamRawKeyCache = new Map<
  string,
  { ciphertext: string; updatedAt: string; rawKey: string; expiresAt: number }
>();

export type UpstreamChannelInput = {
  id?: string;
  name: string;
  websiteUrl?: string;
  status?: UpstreamChannelGroup['status'];
  claudeApiUrl: string;
  codexApiUrl: string;
  useIndependentAgentKeys?: boolean;
  inputRatePerMillion?: number;
  outputRatePerMillion?: number;
  cacheCreationRatePerMillion?: number;
  cacheReadRatePerMillion?: number;
  serverErrorRecoveryMinutes?: number;
  displayUsageMultiplier?: number;
  sortOrder?: number;
};

export type UpstreamChannelKeyInput = {
  key: string;
  name?: string;
  agentType?: UpstreamKeyAgentType;
  sortOrder?: number;
  expiresAt?: string | null;
};

export type UpstreamModelRateInput = {
  id?: string;
  agentType: AgentType;
  model: string;
  inputRatePerMillion?: number;
  outputRatePerMillion?: number;
  cacheCreationRatePerMillion?: number;
  cacheReadRatePerMillion?: number;
  isDefault?: boolean;
  sortOrder?: number;
};

export function normalizeUpstreamUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function normalizeOptionalUpstreamUrl(value: string) {
  return normalizeUpstreamUrl(value);
}

export function normalizeUpstreamStatus(value: unknown): UpstreamChannelGroup['status'] {
  if (value === 'banned') return 'banned';
  return value === 'paused' ? 'paused' : 'active';
}

export function normalizeUpstreamKeyStatus(value: unknown): UpstreamChannelKey['status'] {
  if (value === 'paused' || value === 'revoked' || value === 'banned') return value;
  return 'active';
}

function parseResetTimeCandidate(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return parseResetTimeCandidate(numeric);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return null;
}

export function extractResetTime(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;

  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  const candidateKeys = [
    'resetAt',
    'reset_at',
    'resetTime',
    'reset_time',
    'resetsAt',
    'resets_at',
    'retryAfter',
    'retry_after',
    'availableAt',
    'available_at'
  ];

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    for (const key of candidateKeys) {
      const value = (current as Record<string, unknown>)[key];
      const parsed = parseResetTimeCandidate(value);
      if (parsed) return parsed;
    }

    for (const value of Object.values(current as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return null;
}

export function normalizeUpstreamKeyAgent(value: unknown): UpstreamKeyAgentType {
  if (value === 'claude-code' || value === 'codex') return value;
  return 'shared';
}

export function upstreamRate(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function normalizeModelRateInput(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 10000) / 10000 : fallback;
}

export function recoveryMinutes(value: unknown, fallback = 10) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(300, Math.max(5, numeric));
}

export function usageMultiplier(value: unknown, fallback = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.round(numeric * 100) / 100);
}

export function normalizeUpstreamKeyExpiry(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) {
    throw new Error('到期时间格式无效。');
  }
  return new Date(timestamp).toISOString();
}

export function invalidateUpstreamSelectionCache() {
  upstreamSelectionCache.clear();
  upstreamRawKeyCache.clear();
}

export function clearExpiredUpstreamDegradations() {
  const timestamp = nowIso();
  const groupResult = db.prepare(
    `
    UPDATE upstream_channel_groups
    SET degraded_until = NULL,
        degraded_reason = NULL,
        degraded_status_code = NULL,
        updated_at = @updatedAt
    WHERE degraded_until IS NOT NULL AND degraded_until <= @now
  `
  ).run({ now: timestamp, updatedAt: timestamp });

  const keyResult = db.prepare(
    `
    UPDATE upstream_channel_keys
    SET exhausted_until = NULL,
        failure_reason = NULL,
        failure_status_code = NULL,
        updated_at = @updatedAt
    WHERE exhausted_until IS NOT NULL AND exhausted_until <= @now
  `
  ).run({ now: timestamp, updatedAt: timestamp });

  if (groupResult.changes > 0 || keyResult.changes > 0) {
    invalidateUpstreamSelectionCache();
  }
}

export function publicUpstreamKey(key: UpstreamChannelKey): UpstreamChannelKeyListItem {
  return {
    id: key.id,
    channelGroupId: key.channelGroupId,
    name: key.name,
    agentType: key.agentType,
    keyPreview: key.keyPreview,
    status: key.status,
    sortOrder: key.sortOrder,
    expiresAt: key.expiresAt,
    exhaustedUntil: key.exhaustedUntil,
    failureReason: key.failureReason,
    failureStatusCode: key.failureStatusCode,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
    updatedAt: key.updatedAt
  };
}

export function keysForGroup(groupId: string) {
  return (db
    .prepare(
      `
      SELECT *
      FROM upstream_channel_keys
      WHERE channel_group_id = @groupId
        AND status != 'revoked'
      ORDER BY
        CASE WHEN expires_at IS NOT NULL AND expires_at <= @now THEN 1 ELSE 0 END ASC,
        CASE WHEN exhausted_until IS NOT NULL THEN 1 ELSE 0 END ASC,
        sort_order ASC,
        created_at ASC
    `
    )
    .all({ groupId, now: nowIso() }) as any[]).map((row) => mapUpstreamChannelKey(row) as UpstreamChannelKey);
}

export function modelRatesForGroup(groupId: string) {
  return (db
    .prepare(
      `
      SELECT *
      FROM upstream_model_rates
      WHERE channel_group_id = @groupId
      ORDER BY agent_type ASC, sort_order ASC, model ASC
    `
    )
    .all({ groupId }) as any[]).map((row) => mapUpstreamModelRate(row) as UpstreamModelRate);
}

export function buildUpstreamGroupListItem(row: any): UpstreamChannelGroupListItem {
  const group = mapUpstreamChannel(row) as UpstreamChannelGroup;
  const keys = keysForGroup(group.id).map(publicUpstreamKey);
  const modelRates = modelRatesForGroup(group.id);
  const keyCounts: Record<UpstreamKeyAgentType, number> = {
    shared: 0,
    'claude-code': 0,
    codex: 0
  };
  keys.forEach((key) => {
    keyCounts[key.agentType] += 1;
  });

  return {
    ...group,
    keys,
    modelRates,
    keyCounts
  };
}

export function normalizeChannelPriority(value: unknown, fallback = 100) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    if (Number.isInteger(fallback) && Number(fallback) > 0) return Number(fallback);
    throw new Error('渠道优先级必须是大于 0 的正整数。');
  }
  return numeric;
}

export function normalizeUpstreamKeyPriority(value: unknown, fallback = 100) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    if (Number.isInteger(fallback) && Number(fallback) > 0) return Number(fallback);
    throw new Error('Key 优先级必须是大于 0 的正整数。');
  }
  return numeric;
}

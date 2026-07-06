import { customAlphabet } from 'nanoid';
import { db, mapKey, mapPlan, nowIso } from '../db.js';
import { createApiKey, decryptKey, encryptKey, hashKey, previewKey } from '../crypto.js';
import type { ApiKeyRecord, KeyListItem, KeyWithPlan, Plan } from '../types.js';
import { ensureAccountState } from './accounts.js';
import { getQuotaSnapshot } from './usage.js';

const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
const lastUsedTouchIntervalMs = 60 * 1000;
const apiKeyTouchedAt = new Map<string, number>();

function getPlan(id: string): Plan | null {
  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  return row ? mapPlan(row) : null;
}

export function listKeys(userId?: string): KeyListItem[] {
  if (userId) {
    ensureAccountState(userId);
  }
  const filters = ["api_keys.status != 'revoked'", 'api_keys.user_id IS NOT NULL'];
  const params: Record<string, string> = {};
  if (userId) {
    filters.push('api_keys.user_id = @userId');
    params.userId = userId;
  }
  const rows = db
    .prepare(
      `
      SELECT api_keys.*, plans.name as plan_name, plans.five_hour_token_limit, plans.weekly_token_limit
      FROM api_keys
      JOIN plans ON plans.id = api_keys.plan_id
      WHERE ${filters.join(' AND ')}
      ORDER BY api_keys.created_at DESC
    `
    )
    .all(params);

  return rows.map((row: any) => {
    const key = mapKey(row);
    return {
      id: key.id,
      name: key.name,
      keyPreview: key.keyPreview,
      userId: key.userId,
      planId: key.planId,
      status: key.status,
      ownerEmail: key.ownerEmail,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      planName: row.plan_name,
      usage: getQuotaSnapshot(row.id),
      todayUsageCents: getTodayUsageCents(row.id)
    };
  });
}

export function createKey(input: { name: string; ownerEmail?: string | null; planId?: string; userId: string }) {
  const account = ensureAccountState(input.userId);
  const planId = input.planId || account.currentPlanId || 'free';
  const plan = getPlan(planId);
  if (!plan || !plan.isActive) {
    throw new Error('Plan is not available');
  }

  const rawKey = createApiKey();
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO api_keys (
      id,
      name,
      key_hash,
      key_preview,
      key_ciphertext,
      user_id,
      plan_id,
      status,
      owner_email,
      created_at,
      last_used_at
    )
    VALUES (
      @id,
      @name,
      @keyHash,
      @keyPreview,
      @keyCiphertext,
      @userId,
      @planId,
      'active',
      @ownerEmail,
      @createdAt,
      NULL
    )
  `
  ).run({
    id: makeId(),
    name: input.name,
    keyHash: hashKey(rawKey),
    keyPreview: previewKey(rawKey),
    keyCiphertext: encryptKey(rawKey),
    userId: input.userId,
    planId,
    ownerEmail: input.ownerEmail || null,
    createdAt: timestamp
  });

  return {
    key: rawKey,
    preview: previewKey(rawKey)
  };
}

export function updateKey(
  id: string,
  input: Partial<{ name: string; ownerEmail: string | null; planId: string; status: ApiKeyRecord['status'] }>,
  userId?: string
) {
  const current = db
    .prepare(`SELECT * FROM api_keys WHERE id = ? AND user_id IS NOT NULL${userId ? ' AND user_id = ?' : ''}`)
    .get(...(userId ? [id, userId] : [id]));
  if (!current) return null;

  const next = {
    ...mapKey(current),
    ...input
  };

  if (input.planId) {
    const plan = getPlan(input.planId);
    if (!plan || !plan.isActive) {
      throw new Error('Plan is not available');
    }
  }

  db.prepare(
    `
    UPDATE api_keys
    SET name = @name,
        owner_email = @ownerEmail,
        plan_id = @planId,
        status = @status
    WHERE id = @id
  `
  ).run({
    id,
    name: next.name,
    ownerEmail: next.ownerEmail,
    planId: next.planId,
    status: next.status
  });

  return getKeyById(id, userId);
}

export function revokeKey(id: string, userId?: string) {
  return updateKey(id, { status: 'revoked' }, userId);
}

export function getKeyById(id: string, userId?: string): ApiKeyRecord | null {
  const row = db
    .prepare(`SELECT * FROM api_keys WHERE id = ? AND user_id IS NOT NULL${userId ? ' AND user_id = ?' : ''}`)
    .get(...(userId ? [id, userId] : [id]));
  return row ? mapKey(row) : null;
}

export function getRawKeyById(id: string, userId?: string) {
  const row = db
    .prepare(`SELECT * FROM api_keys WHERE id = ? AND user_id IS NOT NULL${userId ? ' AND user_id = ?' : ''}`)
    .get(...(userId ? [id, userId] : [id]));
  if (!row) return null;

  const key = mapKey(row);
  const rawKey = decryptKey(key.keyCiphertext);
  if (!rawKey) {
    return {
      key,
      rawKey: null
    };
  }

  return {
    key,
    rawKey
  };
}

function getTodayUsageCents(apiKeyId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const row = db
    .prepare(
      `
      SELECT COALESCE(SUM(total_cost_cents), 0) as used
      FROM usage_logs
      WHERE api_key_id = ? AND created_at >= ? AND status_code BETWEEN 200 AND 299
    `
    )
    .get(apiKeyId, today.toISOString()) as { used: number };

  return Number(row.used ?? 0);
}

export function getKeyByRawKey(rawKey: string): KeyWithPlan | null {
  const found = db
    .prepare(
      `
      SELECT api_keys.*
      FROM api_keys
      WHERE api_keys.key_hash = ?
        AND api_keys.user_id IS NOT NULL
    `
    )
    .get(hashKey(rawKey)) as any;

  if (!found) return null;
  const mapped = mapKey(found);
  ensureAccountState(mapped.userId!);

  const row = db
    .prepare(
      `
      SELECT api_keys.*, plans.name as plan_name, plans.five_hour_token_limit, plans.weekly_token_limit
      FROM api_keys
      JOIN plans ON plans.id = api_keys.plan_id
      WHERE api_keys.id = ?
        AND api_keys.user_id IS NOT NULL
    `
    )
    .get(mapped.id) as any;

  return {
    ...mapKey(row),
    planName: row.plan_name,
    fiveHourTokenLimit: row.five_hour_token_limit,
    weeklyTokenLimit: row.weekly_token_limit
  };
}

export function touchKey(id: string) {
  const now = Date.now();
  const lastTouchedAt = apiKeyTouchedAt.get(id) || 0;
  if (now - lastTouchedAt < lastUsedTouchIntervalMs) return;
  apiKeyTouchedAt.set(id, now);
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(nowIso(), id);
}

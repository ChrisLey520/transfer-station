import { customAlphabet } from 'nanoid';
import { db, mapKey, mapLog, mapPlan, nowIso } from './db.js';
import { createApiKey, decryptKey, encryptKey, hashKey, previewKey } from './crypto.js';
import { usageCostCents } from './pricing.js';
import type { ApiKeyRecord, KeyListItem, KeyWithPlan, Plan, QuotaSnapshot, UsageLog } from './types.js';

const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
const fiveHoursMs = 5 * 60 * 60 * 1000;
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

type LogRange = '24h' | '3d' | '7d' | '30d';
type LogStatus = 'all' | 'success' | 'failed';

type UsageLogQuery = {
  page?: number;
  pageSize?: number;
  status?: LogStatus;
  apiKeyId?: string;
  range?: LogRange;
};

const logRangeMs: Record<LogRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': sevenDaysMs,
  '30d': thirtyDaysMs
};

export function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number };
  if (count.count > 0) {
    normalizeLegacyPlanLimits();
    backfillUsageLogCosts();
    return;
  }

  const createdAt = nowIso();
  const insertPlan = db.prepare(`
    INSERT INTO plans (id, name, description, five_hour_token_limit, weekly_token_limit, price_cents, currency, is_active, created_at, updated_at)
    VALUES (@id, @name, @description, @fiveHourTokenLimit, @weeklyTokenLimit, @priceCents, @currency, 1, @createdAt, @createdAt)
  `);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'For individual Claude Code exploration and light automation.',
      fiveHourTokenLimit: 1200,
      weeklyTokenLimit: 9000,
      priceCents: 1200,
      currency: 'USD',
      createdAt
    },
    {
      id: 'team',
      name: 'Team',
      description: 'Shared team pool with higher rolling capacity.',
      fiveHourTokenLimit: 4900,
      weeklyTokenLimit: 38000,
      priceCents: 4900,
      currency: 'USD',
      createdAt
    },
    {
      id: 'scale',
      name: 'Scale',
      description: 'Production proxying with a larger weekly ceiling.',
      fiveHourTokenLimit: 14900,
      weeklyTokenLimit: 120000,
      priceCents: 14900,
      currency: 'USD',
      createdAt
    }
  ];

  const tx = db.transaction(() => plans.forEach((plan) => insertPlan.run(plan)));
  tx();

  createKey({
    name: 'Demo Claude Code Key',
    ownerEmail: 'ops@example.com',
    planId: 'team'
  });

  seedSampleLogs();
  backfillUsageLogCosts();
}

export function pruneUsageLogs() {
  const cutoff = new Date(Date.now() - thirtyDaysMs).toISOString();
  return db.prepare('DELETE FROM usage_logs WHERE created_at < ?').run(cutoff).changes;
}

function normalizeLegacyPlanLimits() {
  const legacyPlans = [
    { id: 'starter', fiveHourTokenLimit: 1200, weeklyTokenLimit: 9000 },
    { id: 'team', fiveHourTokenLimit: 4900, weeklyTokenLimit: 38000 },
    { id: 'scale', fiveHourTokenLimit: 14900, weeklyTokenLimit: 120000 }
  ];

  const update = db.prepare(`
    UPDATE plans
    SET five_hour_token_limit = @fiveHourTokenLimit,
        weekly_token_limit = @weeklyTokenLimit,
        updated_at = @updatedAt
    WHERE id = @id
      AND (five_hour_token_limit >= 100000 OR weekly_token_limit >= 900000)
  `);

  const updatedAt = nowIso();
  const tx = db.transaction(() => {
    legacyPlans.forEach((plan) => update.run({ ...plan, updatedAt }));
  });
  tx();
}

function backfillUsageLogCosts() {
  const rows = db
    .prepare(
      `
      SELECT id, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
      FROM usage_logs
      WHERE total_cost_cents = 0 AND status_code BETWEEN 200 AND 299
    `
    )
    .all() as Array<{
      id: string;
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    }>;

  if (!rows.length) return;

  const update = db.prepare(`
    UPDATE usage_logs
    SET input_cost_cents = @inputCostCents,
        output_cost_cents = @outputCostCents,
        cache_creation_cost_cents = @cacheCreationCostCents,
        cache_read_cost_cents = @cacheReadCostCents,
        total_cost_cents = @totalCostCents
    WHERE id = @id
  `);

  const tx = db.transaction(() => {
    rows.forEach((row) => {
      const costs = usageCostCents({
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cacheCreationInputTokens: row.cache_creation_input_tokens,
        cacheReadInputTokens: row.cache_read_input_tokens
      });
      update.run({ id: row.id, ...costs });
    });
  });
  tx();
}

function seedSampleLogs() {
  const key = db.prepare('SELECT id FROM api_keys LIMIT 1').get() as { id: string } | undefined;
  if (!key) return;

  const insert = db.prepare(`
    INSERT INTO usage_logs (
      id,
      api_key_id,
      model,
      path,
      method,
      status_code,
      input_tokens,
      output_tokens,
      cache_creation_input_tokens,
      cache_read_input_tokens,
      total_tokens,
      input_cost_cents,
      output_cost_cents,
      cache_creation_cost_cents,
      cache_read_cost_cents,
      total_cost_cents,
      latency_ms,
      error_message,
      request_id,
      created_at
    )
    VALUES (
      @id,
      @apiKeyId,
      @model,
      @path,
      @method,
      @statusCode,
      @inputTokens,
      @outputTokens,
      @cacheCreationInputTokens,
      @cacheReadInputTokens,
      @totalTokens,
      @inputCostCents,
      @outputCostCents,
      @cacheCreationCostCents,
      @cacheReadCostCents,
      @totalCostCents,
      @latencyMs,
      @errorMessage,
      @requestId,
      @createdAt
    )
  `);

  const now = Date.now();
  const samples = Array.from({ length: 18 }, (_, index) => {
    const inputTokens = 2800 + index * 310;
    const outputTokens = 900 + index * 115;
    const cacheCreationInputTokens = index % 4 === 0 ? 1200 + index * 40 : 0;
    const cacheReadInputTokens = index % 3 === 0 ? 5200 + index * 130 : 0;
    const costs = usageCostCents({
      inputTokens,
      outputTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens
    });
    return {
      id: makeId(),
      apiKeyId: key.id,
      model: index % 3 === 0 ? 'claude-3-5-sonnet-latest' : 'claude-sonnet-4-5',
      path: '/v1/messages',
      method: 'POST',
      statusCode: index === 13 ? 429 : 200,
      inputTokens,
      outputTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
      totalTokens: inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens,
      ...costs,
      latencyMs: 1200 + index * 67,
      errorMessage: index === 13 ? 'Five-hour rolling limit exceeded' : null,
      requestId: `seed_${makeId()}`,
      createdAt: new Date(now - index * 86 * 60 * 1000).toISOString()
    };
  });

  const tx = db.transaction(() => samples.forEach((sample) => insert.run(sample)));
  tx();
}

export function listPlans(): Plan[] {
  return db.prepare('SELECT * FROM plans ORDER BY price_cents ASC').all().map(mapPlan);
}

export function upsertPlan(input: {
  id?: string;
  name: string;
  description: string;
  fiveHourTokenLimit: number;
  weeklyTokenLimit: number;
  priceCents: number;
  currency: string;
  isActive?: boolean;
}) {
  const id = input.id || makeId();
  const existing = db.prepare('SELECT id FROM plans WHERE id = ?').get(id);
  const timestamp = nowIso();

  if (existing) {
    db.prepare(`
      UPDATE plans
      SET name = @name,
          description = @description,
          five_hour_token_limit = @fiveHourTokenLimit,
          weekly_token_limit = @weeklyTokenLimit,
          price_cents = @priceCents,
          currency = @currency,
          is_active = @isActive,
          updated_at = @updatedAt
      WHERE id = @id
    `).run({
      ...input,
      id,
      isActive: input.isActive === false ? 0 : 1,
      updatedAt: timestamp
    });
  } else {
    db.prepare(`
      INSERT INTO plans (id, name, description, five_hour_token_limit, weekly_token_limit, price_cents, currency, is_active, created_at, updated_at)
      VALUES (@id, @name, @description, @fiveHourTokenLimit, @weeklyTokenLimit, @priceCents, @currency, @isActive, @createdAt, @updatedAt)
    `).run({
      ...input,
      id,
      isActive: input.isActive === false ? 0 : 1,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  return getPlan(id);
}

export function getPlan(id: string): Plan | null {
  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
  return row ? mapPlan(row) : null;
}

export function listKeys(): KeyListItem[] {
  const rows = db
    .prepare(
      `
      SELECT api_keys.*, plans.name as plan_name, plans.five_hour_token_limit, plans.weekly_token_limit
      FROM api_keys
      JOIN plans ON plans.id = api_keys.plan_id
      WHERE api_keys.status != 'revoked'
      ORDER BY api_keys.created_at DESC
    `
    )
    .all();

  return rows.map((row: any) => {
    const key = mapKey(row);
    return {
      id: key.id,
      name: key.name,
      keyPreview: key.keyPreview,
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

export function createKey(input: { name: string; ownerEmail?: string | null; planId: string }) {
  const plan = getPlan(input.planId);
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
    planId: input.planId,
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
  input: Partial<{ name: string; ownerEmail: string | null; planId: string; status: ApiKeyRecord['status'] }>
) {
  const current = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
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

  return getKeyById(id);
}

export function revokeKey(id: string) {
  return updateKey(id, { status: 'revoked' });
}

export function getKeyById(id: string): ApiKeyRecord | null {
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
  return row ? mapKey(row) : null;
}

export function getRawKeyById(id: string) {
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
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
  const row = db
    .prepare(
      `
      SELECT api_keys.*, plans.name as plan_name, plans.five_hour_token_limit, plans.weekly_token_limit
      FROM api_keys
      JOIN plans ON plans.id = api_keys.plan_id
      WHERE api_keys.key_hash = ?
    `
    )
    .get(hashKey(rawKey)) as any;

  if (!row) return null;

  return {
    ...mapKey(row),
    planName: row.plan_name,
    fiveHourTokenLimit: row.five_hour_token_limit,
    weeklyTokenLimit: row.weekly_token_limit
  };
}

export function touchKey(id: string) {
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(nowIso(), id);
}

export function getQuotaSnapshot(apiKeyId: string): QuotaSnapshot {
  const key = db
    .prepare(
      `
      SELECT api_keys.id, plans.five_hour_token_limit, plans.weekly_token_limit
      FROM api_keys
      JOIN plans ON plans.id = api_keys.plan_id
      WHERE api_keys.id = ?
    `
    )
    .get(apiKeyId) as { id: string; five_hour_token_limit: number; weekly_token_limit: number } | undefined;

  if (!key) {
    const resetAt = new Date(nowIso()).toISOString();
    return {
      fiveHourUsed: 0,
      fiveHourLimit: 0,
      weeklyUsed: 0,
      weeklyLimit: 0,
      remainingFiveHour: 0,
      remainingWeekly: 0,
      fiveHourResetAt: resetAt,
      weeklyResetAt: resetAt
    };
  }

  const now = Date.now();
  const fiveHourSince = new Date(now - fiveHoursMs).toISOString();
  const weeklySince = new Date(now - sevenDaysMs).toISOString();

  const fiveHour = db
    .prepare(
      `
      SELECT COALESCE(SUM(total_cost_cents), 0) as used
      FROM usage_logs
      WHERE api_key_id = ? AND created_at >= ? AND status_code BETWEEN 200 AND 299
    `
    )
    .get(apiKeyId, fiveHourSince) as { used: number };

  const weekly = db
    .prepare(
      `
      SELECT COALESCE(SUM(total_cost_cents), 0) as used
      FROM usage_logs
      WHERE api_key_id = ? AND created_at >= ? AND status_code BETWEEN 200 AND 299
    `
    )
    .get(apiKeyId, weeklySince) as { used: number };

  const oldestFiveHour = db
    .prepare(
      `
      SELECT MIN(created_at) as oldest
      FROM usage_logs
      WHERE api_key_id = ? AND created_at >= ? AND status_code BETWEEN 200 AND 299
    `
    )
    .get(apiKeyId, fiveHourSince) as { oldest: string | null };

  const oldestWeekly = db
    .prepare(
      `
      SELECT MIN(created_at) as oldest
      FROM usage_logs
      WHERE api_key_id = ? AND created_at >= ? AND status_code BETWEEN 200 AND 299
    `
    )
    .get(apiKeyId, weeklySince) as { oldest: string | null };

  const fiveHourUsed = Number(fiveHour.used ?? 0);
  const weeklyUsed = Number(weekly.used ?? 0);
  const fiveHourResetAt = oldestFiveHour.oldest
    ? new Date(new Date(oldestFiveHour.oldest).getTime() + fiveHoursMs).toISOString()
    : new Date(now + fiveHoursMs).toISOString();
  const weeklyResetAt = oldestWeekly.oldest
    ? new Date(new Date(oldestWeekly.oldest).getTime() + sevenDaysMs).toISOString()
    : new Date(now + sevenDaysMs).toISOString();

  return {
    fiveHourUsed,
    fiveHourLimit: key.five_hour_token_limit,
    weeklyUsed,
    weeklyLimit: key.weekly_token_limit,
    remainingFiveHour: Math.max(0, key.five_hour_token_limit - fiveHourUsed),
    remainingWeekly: Math.max(0, key.weekly_token_limit - weeklyUsed),
    fiveHourResetAt,
    weeklyResetAt
  };
}

export function assertQuota(key: KeyWithPlan) {
  const quota = getQuotaSnapshot(key.id);
  if (quota.remainingFiveHour <= 0) {
    return {
      ok: false as const,
      statusCode: 429,
      message: 'Five-hour rolling cost limit exceeded',
      quota
    };
  }

  if (quota.remainingWeekly <= 0) {
    return {
      ok: false as const,
      statusCode: 429,
      message: 'Weekly rolling cost limit exceeded',
      quota
    };
  }

  return { ok: true as const, quota };
}

type UsageLogDefaults =
  | 'cacheCreationInputTokens'
  | 'cacheReadInputTokens'
  | 'inputCostCents'
  | 'outputCostCents'
  | 'cacheCreationCostCents'
  | 'cacheReadCostCents'
  | 'totalCostCents';

export function createUsageLog(
  input: Omit<UsageLog, 'id' | 'createdAt' | UsageLogDefaults> &
    Partial<Pick<UsageLog, UsageLogDefaults>> & { createdAt?: string }
) {
  const id = makeId();
  const log = {
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    inputCostCents: 0,
    outputCostCents: 0,
    cacheCreationCostCents: 0,
    cacheReadCostCents: 0,
    totalCostCents: 0,
    ...input,
    id,
    createdAt: input.createdAt || nowIso()
  };

  db.prepare(
    `
    INSERT INTO usage_logs (
      id,
      api_key_id,
      model,
      path,
      method,
      status_code,
      input_tokens,
      output_tokens,
      cache_creation_input_tokens,
      cache_read_input_tokens,
      total_tokens,
      input_cost_cents,
      output_cost_cents,
      cache_creation_cost_cents,
      cache_read_cost_cents,
      total_cost_cents,
      latency_ms,
      error_message,
      request_id,
      created_at
    )
    VALUES (
      @id,
      @apiKeyId,
      @model,
      @path,
      @method,
      @statusCode,
      @inputTokens,
      @outputTokens,
      @cacheCreationInputTokens,
      @cacheReadInputTokens,
      @totalTokens,
      @inputCostCents,
      @outputCostCents,
      @cacheCreationCostCents,
      @cacheReadCostCents,
      @totalCostCents,
      @latencyMs,
      @errorMessage,
      @requestId,
      @createdAt
    )
  `
  ).run(log);

  pruneUsageLogs();
  return id;
}

export function listUsageLogs(input: UsageLogQuery = {}) {
  pruneUsageLogs();

  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.min(Math.max(1, Math.floor(input.pageSize || 20)), 100);
  const range = input.range || '24h';
  const status = input.status || 'all';
  const since = new Date(Date.now() - logRangeMs[range]).toISOString();
  const params: Record<string, string | number> = { since };
  const filters = ['created_at >= @since'];

  if (status === 'success') {
    filters.push('status_code BETWEEN 200 AND 299');
  } else if (status === 'failed') {
    filters.push('(status_code < 200 OR status_code >= 300)');
  }

  if (input.apiKeyId) {
    filters.push('api_key_id = @apiKeyId');
    params.apiKeyId = input.apiKeyId;
  }

  const where = `WHERE ${filters.join(' AND ')}`;
  const total = db.prepare(`SELECT COUNT(*) as count FROM usage_logs ${where}`).get(params) as { count: number };
  const pageParams = {
    ...params,
    pageSize,
    offset: (page - 1) * pageSize
  };
  const logs = db
    .prepare(
      `
      SELECT * FROM usage_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT @pageSize OFFSET @offset
    `
    )
    .all(pageParams)
    .map(mapLog);

  return {
    logs,
    total: total.count,
    page,
    pageSize
  };
}

export function usageSummary() {
  pruneUsageLogs();
  const now = Date.now();
  const fiveHourSince = new Date(now - fiveHoursMs).toISOString();
  const weeklySince = new Date(now - sevenDaysMs).toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySince = today.toISOString();

  const totals = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(cache_creation_input_tokens), 0) as cache_creation_input_tokens,
        COALESCE(SUM(cache_read_input_tokens), 0) as cache_read_input_tokens,
        COALESCE(SUM(total_cost_cents), 0) as total_cost_cents,
        COUNT(*) as requests
      FROM usage_logs
      WHERE status_code BETWEEN 200 AND 299
    `
    )
    .get() as any;

  const rolling = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= @fiveHourSince AND status_code BETWEEN 200 AND 299 THEN total_tokens ELSE 0 END), 0) as five_hour_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @weeklySince AND status_code BETWEEN 200 AND 299 THEN total_tokens ELSE 0 END), 0) as weekly_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @fiveHourSince AND status_code BETWEEN 200 AND 299 THEN total_cost_cents ELSE 0 END), 0) as five_hour_cost_cents,
        COALESCE(SUM(CASE WHEN created_at >= @weeklySince AND status_code BETWEEN 200 AND 299 THEN total_cost_cents ELSE 0 END), 0) as weekly_cost_cents,
        COALESCE(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END), 0) as errors
      FROM usage_logs
    `
    )
    .get({ fiveHourSince, weeklySince }) as any;

  const activeKeys = db.prepare("SELECT COUNT(*) as count FROM api_keys WHERE status = 'active'").get() as { count: number };

  const todayUsage = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(SUM(total_cost_cents), 0) as cost_cents,
        COUNT(*) as requests
      FROM usage_logs
      WHERE created_at >= ? AND status_code BETWEEN 200 AND 299
    `
    )
    .get(todaySince) as { tokens: number; cost_cents: number; requests: number };

  const series = db
    .prepare(
      `
      SELECT substr(created_at, 1, 13) as bucket, COALESCE(SUM(total_tokens), 0) as tokens, COUNT(*) as requests
      FROM usage_logs
      WHERE created_at >= ?
      GROUP BY bucket
      ORDER BY bucket ASC
    `
    )
    .all(new Date(now - 24 * 60 * 60 * 1000).toISOString());

  return {
    totalTokens: Number(totals.total_tokens),
    inputTokens: Number(totals.input_tokens),
    outputTokens: Number(totals.output_tokens),
    cacheCreationInputTokens: Number(totals.cache_creation_input_tokens),
    cacheReadInputTokens: Number(totals.cache_read_input_tokens),
    totalCostCents: Number(totals.total_cost_cents),
    requests: Number(totals.requests),
    fiveHourTokens: Number(rolling.five_hour_tokens),
    weeklyTokens: Number(rolling.weekly_tokens),
    fiveHourCostCents: Number(rolling.five_hour_cost_cents),
    weeklyCostCents: Number(rolling.weekly_cost_cents),
    todayTokens: Number(todayUsage.tokens),
    todayCostCents: Number(todayUsage.cost_cents),
    todayRequests: Number(todayUsage.requests),
    accountBalanceCents: 26840,
    errors: Number(rolling.errors),
    activeKeys: activeKeys.count,
    series
  };
}

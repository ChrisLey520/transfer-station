import { customAlphabet } from 'nanoid';
import { db, mapLog, nowIso } from '../db.js';
import { formatBeijingDateTime } from '../time.js';
import type { KeyWithPlan, QuotaSnapshot, UsageLog } from '../types.js';
import { ensureAccountState, setAccountQuotaCycleStart, type AccountState } from './accounts.js';

const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
const fiveHoursMs = 5 * 60 * 60 * 1000;
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
const usageLogPruneIntervalMs = 60 * 60 * 1000;
const usageSummaryCacheTtlMs = Math.max(0, Number(process.env.USAGE_SUMMARY_CACHE_TTL_MS || 5_000));

let lastUsageLogPrunedAt = 0;
const usageSummaryCache = new Map<string, { expiresAt: number; summary: any }>();

type LogRange = '24h' | '3d' | '7d' | '30d';
type LogStatus = 'all' | 'success' | 'failed';

type UsageLogQuery = {
  page?: number;
  pageSize?: number;
  status?: LogStatus;
  apiKeyId?: string;
  range?: LogRange;
  userId?: string;
  ignoreRange?: boolean;
};

const logRangeMs: Record<LogRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': sevenDaysMs,
  '30d': thirtyDaysMs
};

type QuotaScope = {
  apiKeyId: string;
  userId: string | null;
  fiveHourLimit: number;
  weeklyLimit: number;
};

type QuotaWindowKind = 'fiveHour' | 'weekly';

type QuotaWindowUsage = {
  costCents: number;
  tokens: number;
  resetAt: string;
  cycleStartAt: string | null;
};

const quotaWindowConfig: Record<
  QuotaWindowKind,
  { windowMs: number; field: 'fiveHourCycleStartAt' | 'weeklyCycleStartAt' }
> = {
  fiveHour: { windowMs: fiveHoursMs, field: 'fiveHourCycleStartAt' },
  weekly: { windowMs: sevenDaysMs, field: 'weeklyCycleStartAt' }
};

export function pruneUsageLogs() {
  const cutoff = new Date(Date.now() - thirtyDaysMs).toISOString();
  lastUsageLogPrunedAt = Date.now();
  return db.prepare('DELETE FROM usage_logs WHERE created_at < ?').run(cutoff).changes;
}

function pruneUsageLogsIfDue() {
  if (Date.now() - lastUsageLogPrunedAt < usageLogPruneIntervalMs) return 0;
  return pruneUsageLogs();
}

function invalidateUsageSummaryCacheForApiKey(apiKeyId: string | null | undefined) {
  if (!apiKeyId) return;
  const row = db.prepare('SELECT user_id FROM api_keys WHERE id = ?').get(apiKeyId) as { user_id: string | null } | undefined;
  if (row?.user_id) {
    usageSummaryCache.delete(row.user_id);
  }
}

function quotaScopeKeyFilter(scope: Pick<QuotaScope, 'userId'>) {
  return 'api_key_id IN (SELECT id FROM api_keys WHERE user_id = @userId)';
}

export function planQuotaConsumptionFilter(tablePrefix = '') {
  const prefix = tablePrefix ? `${tablePrefix}.` : '';
  return `COALESCE(${prefix}total_cost_cents, 0) > 0`;
}

function getQuotaScope(apiKeyId: string): QuotaScope | null {
  const key = db
    .prepare(
      `
      SELECT api_keys.id, api_keys.user_id
      FROM api_keys
      WHERE api_keys.id = ?
    `
    )
    .get(apiKeyId) as { id: string; user_id: string | null } | undefined;

  if (!key?.user_id) return null;
  ensureAccountState(key.user_id);

  const scoped = db
    .prepare(
      `
      SELECT
        api_keys.id,
        api_keys.user_id,
        COALESCE(account_plans.five_hour_token_limit, 0) as five_hour_token_limit,
        COALESCE(account_plans.weekly_token_limit, 0) as weekly_token_limit
      FROM api_keys
      LEFT JOIN account_state ON account_state.id = api_keys.user_id
      LEFT JOIN plans account_plans ON account_plans.id = account_state.current_plan_id
      WHERE api_keys.id = ?
    `
    )
    .get(apiKeyId) as
    | { id: string; user_id: string | null; five_hour_token_limit: number; weekly_token_limit: number }
    | undefined;

  if (!scoped) return null;
  if (!scoped.user_id) return null;
  return {
    apiKeyId: scoped.id,
    userId: scoped.user_id,
    fiveHourLimit: Number(scoped.five_hour_token_limit ?? 0),
    weeklyLimit: Number(scoped.weekly_token_limit ?? 0)
  };
}

export function quotaResetAt(
  limit: number,
  used: number,
  oldestUsageAt: string | null | undefined,
  windowMs: number,
  now: number
) {
  if (limit <= 0) return '';
  const oldestTime = oldestUsageAt ? new Date(oldestUsageAt).getTime() : NaN;
  if (Number.isFinite(oldestTime)) return new Date(oldestTime + windowMs).toISOString();
  return new Date(now + windowMs).toISOString();
}

function activeCycleStartMs(value: string | null | undefined, windowMs: number, now: number) {
  if (!value) return null;
  const startMs = Date.parse(value);
  if (!Number.isFinite(startMs) || startMs > now) return null;
  if (startMs + windowMs <= now) return null;
  return startMs;
}

// A quota cycle starts at the first successful plan consumption while no
// cycle is active and lasts exactly one window. Expired anchors are cleared
// so the next successful plan consumption opens a fresh cycle.
export function getAccountQuotaCycles(userId: string, now: number, account?: AccountState) {
  const state = account ?? ensureAccountState(userId);
  const cleared: Partial<{ fiveHourCycleStartAt: string | null; weeklyCycleStartAt: string | null }> = {};

  const resolve = (kind: QuotaWindowKind) => {
    const { windowMs, field } = quotaWindowConfig[kind];
    const value = state[field];
    if (activeCycleStartMs(value, windowMs, now) !== null) return value;
    if (value) cleared[field] = null;
    return null;
  };

  const fiveHourCycleStartAt = resolve('fiveHour');
  const weeklyCycleStartAt = resolve('weekly');
  if (Object.keys(cleared).length) setAccountQuotaCycleStart(userId, cleared);

  return { fiveHourCycleStartAt, weeklyCycleStartAt };
}

export function getPlanQuotaCycleUsage(input: {
  whereSql: string;
  params: Record<string, string | number | null>;
  cycleStartAt: string | null;
  windowMs: number;
  limit: number;
  now: number;
}): QuotaWindowUsage {
  const cycleStartMs = activeCycleStartMs(input.cycleStartAt, input.windowMs, input.now);
  if (cycleStartMs === null) {
    return {
      costCents: 0,
      tokens: 0,
      resetAt: quotaResetAt(input.limit, 0, null, input.windowMs, input.now),
      cycleStartAt: null
    };
  }

  const totals = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(total_cost_cents), 0) as total_cost_cents,
        COALESCE(SUM(total_tokens), 0) as total_tokens
      FROM usage_logs
      WHERE ${input.whereSql}
        AND created_at >= @quotaCycleStart
        AND created_at <= @quotaCycleNow
        AND status_code BETWEEN 200 AND 299
        AND COALESCE(usage_source, 'plan') = 'plan'
        AND ${planQuotaConsumptionFilter()}
    `
    )
    .get({
      ...input.params,
      quotaCycleStart: new Date(cycleStartMs).toISOString(),
      quotaCycleNow: new Date(input.now).toISOString()
    }) as { total_cost_cents: number; total_tokens: number };

  return {
    costCents: Math.max(0, Number(totals.total_cost_cents ?? 0)),
    tokens: Math.max(0, Number(totals.total_tokens ?? 0)),
    resetAt: input.limit > 0 ? new Date(cycleStartMs + input.windowMs).toISOString() : '',
    cycleStartAt: new Date(cycleStartMs).toISOString()
  };
}

export function getQuotaSnapshot(apiKeyId: string): QuotaSnapshot {
  const scope = getQuotaScope(apiKeyId);

  let balanceCents = 0;
  if (scope?.userId) {
    balanceCents = ensureAccountState(scope.userId).freeCreditCents;
  }

  if (!scope) {
    return {
      fiveHourUsed: 0,
      fiveHourLimit: 0,
      weeklyUsed: 0,
      weeklyLimit: 0,
      remainingFiveHour: 0,
      remainingWeekly: 0,
      balanceCents,
      quotaSource: balanceCents > 0 ? 'balance' : 'none',
      fiveHourResetAt: '',
      weeklyResetAt: ''
    };
  }

  const now = Date.now();
  const cycles = getAccountQuotaCycles(scope.userId!, now);
  const quotaWhereSql = quotaScopeKeyFilter(scope);
  const quotaParams = { userId: scope.userId };
  const fiveHourUsage = getPlanQuotaCycleUsage({
    whereSql: quotaWhereSql,
    params: quotaParams,
    cycleStartAt: cycles.fiveHourCycleStartAt,
    windowMs: fiveHoursMs,
    limit: scope.fiveHourLimit,
    now
  });
  const weeklyUsage = getPlanQuotaCycleUsage({
    whereSql: quotaWhereSql,
    params: quotaParams,
    cycleStartAt: cycles.weeklyCycleStartAt,
    windowMs: sevenDaysMs,
    limit: scope.weeklyLimit,
    now
  });

  const fiveHourUsed = fiveHourUsage.costCents;
  const weeklyUsed = weeklyUsage.costCents;
  const fiveHourResetAt = fiveHourUsage.resetAt;
  const weeklyResetAt = weeklyUsage.resetAt;

  const remainingFiveHour = Math.max(0, scope.fiveHourLimit - fiveHourUsed);
  const remainingWeekly = Math.max(0, scope.weeklyLimit - weeklyUsed);
  const hasPlanQuota = remainingFiveHour > 0 && remainingWeekly > 0;
  const quotaSource = hasPlanQuota ? 'plan' : balanceCents > 0 ? 'balance' : 'none';

  return {
    fiveHourUsed,
    fiveHourLimit: scope.fiveHourLimit,
    weeklyUsed,
    weeklyLimit: scope.weeklyLimit,
    remainingFiveHour,
    remainingWeekly,
    balanceCents,
    quotaSource,
    fiveHourResetAt,
    weeklyResetAt
  };
}

export function getAccountState(userId: string) {
  return ensureAccountState(userId);
}

function formatQuotaResetAt(value: string) {
  return formatBeijingDateTime(value);
}

function combinedQuotaResetAt(quota: QuotaSnapshot) {
  const exhaustedResetTimes = [
    quota.remainingFiveHour <= 0 ? Date.parse(quota.fiveHourResetAt) : NaN,
    quota.remainingWeekly <= 0 ? Date.parse(quota.weeklyResetAt) : NaN
  ].filter(Number.isFinite);
  const resetAt = exhaustedResetTimes.length ? Math.max(...exhaustedResetTimes) : 0;
  return resetAt > 0 ? new Date(resetAt).toISOString() : quota.weeklyResetAt || quota.fiveHourResetAt;
}

export function assertQuota(key: KeyWithPlan) {
  const quota = getQuotaSnapshot(key.id);
  const hasPlanQuota = quota.remainingFiveHour > 0 && quota.remainingWeekly > 0;
  if (hasPlanQuota || quota.balanceCents > 0) {
    return { ok: true as const, quota };
  }

  const resetAt = combinedQuotaResetAt(quota);

  return {
    ok: false as const,
    statusCode: 402,
    message: resetAt ? `额度使用已达上限，恢复时间：${formatQuotaResetAt(resetAt)}` : '额度使用已达上限，暂无可恢复时间。',
    quota
  };
}

type UsageLogDefaults =
  | 'usageSource'
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
    usageSource: 'plan',
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
      channel_group_id,
      channel_number,
      usage_source,
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
      @channelGroupId,
      @channelNumber,
      @usageSource,
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

  invalidateUsageSummaryCacheForApiKey(log.apiKeyId);

  const isSuccessfulPaidUsage =
    Boolean(log.apiKeyId) && log.statusCode >= 200 && log.statusCode <= 299 && log.totalCostCents > 0;

  if (isSuccessfulPaidUsage && log.usageSource === 'plan') {
    openQuotaCyclesForApiKey(log.apiKeyId!, log.createdAt);
  }

  if (isSuccessfulPaidUsage && log.usageSource === 'balance') {
    db.prepare(
      `
      UPDATE account_state
      SET free_credit_cents = MAX(0, free_credit_cents - @costCents),
          updated_at = @updatedAt
      WHERE id = (SELECT user_id FROM api_keys WHERE id = @apiKeyId)
    `
    ).run({
      apiKeyId: log.apiKeyId,
      costCents: log.totalCostCents,
      updatedAt: nowIso()
    });
  }

  pruneUsageLogsIfDue();
  return id;
}

// First successful plan consumption while no cycle is active anchors the
// cycle to that consumption's timestamp.
function openQuotaCyclesForApiKey(apiKeyId: string, consumedAt: string) {
  const row = db.prepare('SELECT user_id FROM api_keys WHERE id = ?').get(apiKeyId) as
    | { user_id: string | null }
    | undefined;
  if (!row?.user_id) return;

  const consumedMs = Date.parse(consumedAt);
  const anchorMs = Number.isFinite(consumedMs) ? consumedMs : Date.now();
  const cycles = getAccountQuotaCycles(row.user_id, anchorMs);

  const updates: Partial<{ fiveHourCycleStartAt: string; weeklyCycleStartAt: string }> = {};
  if (!cycles.fiveHourCycleStartAt) updates.fiveHourCycleStartAt = new Date(anchorMs).toISOString();
  if (!cycles.weeklyCycleStartAt) updates.weeklyCycleStartAt = new Date(anchorMs).toISOString();
  if (Object.keys(updates).length) setAccountQuotaCycleStart(row.user_id, updates);
}

export function listUsageLogs(input: UsageLogQuery = {}) {
  pruneUsageLogsIfDue();

  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.min(Math.max(1, Math.floor(input.pageSize || 20)), 100);
  const range = input.range || '24h';
  const status = input.status || 'all';
  const params: Record<string, string | number> = {};
  const filters: string[] = [];
  if (range !== '30d' || !input.ignoreRange) {
    const rangeMs = logRangeMs[range] ?? logRangeMs['24h'];
    params.since = new Date(Date.now() - rangeMs).toISOString();
    filters.push('usage_logs.created_at >= @since');
  }
  filters.push('usage_logs.api_key_id IN (SELECT id FROM api_keys WHERE user_id IS NOT NULL)');

  if (status === 'success') {
    filters.push('status_code BETWEEN 200 AND 299');
  } else if (status === 'failed') {
    filters.push('(status_code < 200 OR status_code >= 300)');
  }

  if (input.apiKeyId) {
    filters.push('usage_logs.api_key_id = @apiKeyId');
    params.apiKeyId = input.apiKeyId;
  }

  if (input.userId) {
    filters.push('usage_logs.api_key_id IN (SELECT id FROM api_keys WHERE user_id = @userId)');
    params.userId = input.userId;
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
      SELECT usage_logs.*, log_keys.name AS api_key_name
      FROM usage_logs
      LEFT JOIN api_keys log_keys ON log_keys.id = usage_logs.api_key_id
      ${where}
      ORDER BY usage_logs.created_at DESC
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

export function usageSummaryForUser(userId: string) {
  if (usageSummaryCacheTtlMs > 0) {
    const now = Date.now();
    const cached = usageSummaryCache.get(userId);
    if (cached && cached.expiresAt > now && !hasExpiredQuotaReset(cached.summary, now)) {
      return refreshUnusedQuotaResetTimes(userId, cached.summary, now);
    }

    const summary = buildUsageSummaryForUser(userId);
    usageSummaryCache.set(userId, {
      expiresAt: now + usageSummaryCacheTtlMs,
      summary
    });
    return refreshUnusedQuotaResetTimes(userId, summary, now);
  }

  return buildUsageSummaryForUser(userId);
}

function hasExpiredQuotaReset(summary: any, now: number) {
  return (
    quotaResetHasPassed(summary.fiveHourResetAt, summary.fiveHourCostCents, now) ||
    quotaResetHasPassed(summary.weeklyResetAt, summary.weeklyCostCents, now)
  );
}

function quotaResetHasPassed(resetAt: unknown, used: unknown, now: number) {
  if (Number(used) <= 0 || typeof resetAt !== 'string' || !resetAt) return false;
  const timestamp = Date.parse(resetAt);
  return Number.isFinite(timestamp) && timestamp <= now;
}

function refreshUnusedQuotaResetTimes(userId: string, summary: any, now = Date.now()) {
  const account = ensureAccountState(userId);
  const accountPlan = account.currentPlanId
    ? (db
        .prepare('SELECT five_hour_token_limit, weekly_token_limit FROM plans WHERE id = ?')
        .get(account.currentPlanId) as { five_hour_token_limit: number; weekly_token_limit: number } | undefined)
    : undefined;

  return {
    ...summary,
    fiveHourResetAt:
      Number(summary.fiveHourCostCents) <= 0
        ? quotaResetAt(Number(accountPlan?.five_hour_token_limit ?? 0), 0, null, fiveHoursMs, now)
        : summary.fiveHourResetAt,
    weeklyResetAt:
      Number(summary.weeklyCostCents) <= 0
        ? quotaResetAt(Number(accountPlan?.weekly_token_limit ?? 0), 0, null, sevenDaysMs, now)
        : summary.weeklyResetAt
  };
}

function buildUsageSummaryForUser(userId: string) {
  pruneUsageLogsIfDue();
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySince = today.toISOString();
  const userParams = { userId };
  const userClause = ' AND api_key_id IN (SELECT id FROM api_keys WHERE user_id = @userId)';
  const todayParams = { todaySince, userId };
  const seriesParams = { seriesSince: new Date(now - 24 * 60 * 60 * 1000).toISOString(), userId };

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
      WHERE status_code BETWEEN 200 AND 299${userClause}
    `
    )
    .get(userParams) as any;

  const errors = db
    .prepare(
      `
      SELECT COALESCE(SUM(CASE WHEN status_code >= 400${userClause} THEN 1 ELSE 0 END), 0) as count
      FROM usage_logs
    `
    )
    .get(userParams) as { count: number };

  const activeKeys = db
    .prepare("SELECT COUNT(*) as count FROM api_keys WHERE status = 'active' AND user_id = @userId")
    .get(userParams) as { count: number };

  const todayUsage = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(SUM(total_cost_cents), 0) as cost_cents,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(cache_creation_input_tokens), 0) as cache_creation_input_tokens,
        COALESCE(SUM(cache_read_input_tokens), 0) as cache_read_input_tokens,
        COUNT(*) as requests
      FROM usage_logs
      WHERE created_at >= @todaySince AND status_code BETWEEN 200 AND 299
        AND api_key_id IN (SELECT id FROM api_keys WHERE user_id = @userId)
    `
    )
    .get(todayParams) as {
    tokens: number;
    cost_cents: number;
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    requests: number;
  };

  const series = db
    .prepare(
      `
      SELECT substr(created_at, 1, 13) as bucket, COALESCE(SUM(total_tokens), 0) as tokens, COUNT(*) as requests
      FROM usage_logs
      WHERE created_at >= @seriesSince
        AND api_key_id IN (SELECT id FROM api_keys WHERE user_id = @userId)
      GROUP BY bucket
      ORDER BY bucket ASC
    `
    )
    .all(seriesParams);

  const account = ensureAccountState(userId);
  const accountPlan = account.currentPlanId
    ? (db
        .prepare('SELECT five_hour_token_limit, weekly_token_limit FROM plans WHERE id = ?')
        .get(account.currentPlanId) as { five_hour_token_limit: number; weekly_token_limit: number } | undefined)
    : undefined;
  const accountFiveHourLimit = Number(accountPlan?.five_hour_token_limit ?? 0);
  const accountWeeklyLimit = Number(accountPlan?.weekly_token_limit ?? 0);
  const cycles = getAccountQuotaCycles(userId, now, account);
  const quotaWhereSql = 'api_key_id IN (SELECT id FROM api_keys WHERE user_id = @userId)';
  const fiveHourUsage = getPlanQuotaCycleUsage({
    whereSql: quotaWhereSql,
    params: userParams,
    cycleStartAt: cycles.fiveHourCycleStartAt,
    windowMs: fiveHoursMs,
    limit: accountFiveHourLimit,
    now
  });
  const weeklyUsage = getPlanQuotaCycleUsage({
    whereSql: quotaWhereSql,
    params: userParams,
    cycleStartAt: cycles.weeklyCycleStartAt,
    windowMs: sevenDaysMs,
    limit: accountWeeklyLimit,
    now
  });

  return {
    totalTokens: Number(totals.total_tokens),
    inputTokens: Number(totals.input_tokens),
    outputTokens: Number(totals.output_tokens),
    cacheCreationInputTokens: Number(totals.cache_creation_input_tokens),
    cacheReadInputTokens: Number(totals.cache_read_input_tokens),
    totalCostCents: Number(totals.total_cost_cents),
    requests: Number(totals.requests),
    fiveHourTokens: fiveHourUsage.tokens,
    weeklyTokens: weeklyUsage.tokens,
    fiveHourCostCents: fiveHourUsage.costCents,
    weeklyCostCents: weeklyUsage.costCents,
    fiveHourResetAt: fiveHourUsage.resetAt,
    weeklyResetAt: weeklyUsage.resetAt,
    todayTokens: Number(todayUsage.tokens),
    todayCostCents: Number(todayUsage.cost_cents),
    todayRequests: Number(todayUsage.requests),
    todayInputTokens: Number(todayUsage.input_tokens),
    todayCacheCreationInputTokens: Number(todayUsage.cache_creation_input_tokens),
    todayCacheReadInputTokens: Number(todayUsage.cache_read_input_tokens),
    accountBalanceCents: account.freeCreditCents,
    errors: Number(errors.count),
    activeKeys: activeKeys.count,
    series
  };
}

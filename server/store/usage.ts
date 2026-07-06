import { customAlphabet } from 'nanoid';
import { db, mapLog, nowIso } from '../db.js';
import type { KeyWithPlan, QuotaSnapshot, UsageLog } from '../types.js';
import { ensureAccountState } from './accounts.js';

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

export function pruneUsageLogs() {
  const cutoff = new Date(Date.now() - thirtyDaysMs).toISOString();
  lastUsageLogPrunedAt = Date.now();
  return db.prepare('DELETE FROM usage_logs WHERE created_at < ?').run(cutoff).changes;
}

function pruneUsageLogsIfDue() {
  if (Date.now() - lastUsageLogPrunedAt < usageLogPruneIntervalMs) return 0;
  return pruneUsageLogs();
}

export function getQuotaSnapshot(apiKeyId: string): QuotaSnapshot {
  const key = db
    .prepare(
      `
      SELECT api_keys.id, api_keys.user_id, plans.five_hour_token_limit, plans.weekly_token_limit
      FROM api_keys
      JOIN plans ON plans.id = api_keys.plan_id
      WHERE api_keys.id = ?
    `
    )
    .get(apiKeyId) as
    | { id: string; user_id: string | null; five_hour_token_limit: number; weekly_token_limit: number }
    | undefined;

  let balanceCents = 0;
  if (key?.user_id) {
    balanceCents = ensureAccountState(key.user_id).freeCreditCents;
  }

  if (!key) {
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
  const fiveHourSince = new Date(now - fiveHoursMs).toISOString();
  const weeklySince = new Date(now - sevenDaysMs).toISOString();

  const usage = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= @fiveHourSince THEN total_cost_cents ELSE 0 END), 0) as five_hour_used,
        COALESCE(SUM(total_cost_cents), 0) as weekly_used,
        MIN(CASE WHEN created_at >= @fiveHourSince THEN created_at END) as oldest_five_hour,
        MIN(created_at) as oldest_weekly
      FROM usage_logs
      WHERE api_key_id = @apiKeyId
        AND created_at >= @weeklySince
        AND status_code BETWEEN 200 AND 299
        AND usage_source = 'plan'
    `
    )
    .get({ apiKeyId, fiveHourSince, weeklySince }) as {
    five_hour_used: number;
    weekly_used: number;
    oldest_five_hour: string | null;
    oldest_weekly: string | null;
  };

  const fiveHourUsed = Number(usage.five_hour_used ?? 0);
  const weeklyUsed = Number(usage.weekly_used ?? 0);
  const fiveHourResetAt = usage.oldest_five_hour
    ? new Date(new Date(usage.oldest_five_hour).getTime() + fiveHoursMs).toISOString()
    : '';
  const weeklyResetAt = usage.oldest_weekly
    ? new Date(new Date(usage.oldest_weekly).getTime() + sevenDaysMs).toISOString()
    : '';

  const remainingFiveHour = Math.max(0, key.five_hour_token_limit - fiveHourUsed);
  const remainingWeekly = Math.max(0, key.weekly_token_limit - weeklyUsed);
  const hasPlanQuota = remainingFiveHour > 0 && remainingWeekly > 0;
  const quotaSource = hasPlanQuota ? 'plan' : balanceCents > 0 ? 'balance' : 'none';

  return {
    fiveHourUsed,
    fiveHourLimit: key.five_hour_token_limit,
    weeklyUsed,
    weeklyLimit: key.weekly_token_limit,
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
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function combinedQuotaResetAt(quota: QuotaSnapshot) {
  const fiveHourTime = Date.parse(quota.fiveHourResetAt);
  const weeklyTime = Date.parse(quota.weeklyResetAt);
  const resetAt = Math.max(
    Number.isFinite(fiveHourTime) ? fiveHourTime : 0,
    Number.isFinite(weeklyTime) ? weeklyTime : 0
  );
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

  if (
    log.apiKeyId &&
    log.usageSource === 'balance' &&
    log.statusCode >= 200 &&
    log.statusCode <= 299 &&
    log.totalCostCents > 0
  ) {
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
      SELECT * FROM usage_logs
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
    if (cached && cached.expiresAt > now) return cached.summary;

    const summary = buildUsageSummaryForUser(userId);
    usageSummaryCache.set(userId, {
      expiresAt: now + usageSummaryCacheTtlMs,
      summary
    });
    return summary;
  }

  return buildUsageSummaryForUser(userId);
}

function buildUsageSummaryForUser(userId: string) {
  pruneUsageLogsIfDue();
  const now = Date.now();
  const fiveHourSince = new Date(now - fiveHoursMs).toISOString();
  const weeklySince = new Date(now - sevenDaysMs).toISOString();
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

  const rolling = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= @fiveHourSince AND status_code BETWEEN 200 AND 299 AND COALESCE(usage_source, 'plan') = 'plan'${userClause} THEN total_tokens ELSE 0 END), 0) as five_hour_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @weeklySince AND status_code BETWEEN 200 AND 299 AND COALESCE(usage_source, 'plan') = 'plan'${userClause} THEN total_tokens ELSE 0 END), 0) as weekly_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @fiveHourSince AND status_code BETWEEN 200 AND 299 AND COALESCE(usage_source, 'plan') = 'plan'${userClause} THEN total_cost_cents ELSE 0 END), 0) as five_hour_cost_cents,
        COALESCE(SUM(CASE WHEN created_at >= @weeklySince AND status_code BETWEEN 200 AND 299 AND COALESCE(usage_source, 'plan') = 'plan'${userClause} THEN total_cost_cents ELSE 0 END), 0) as weekly_cost_cents,
        COALESCE(SUM(CASE WHEN status_code >= 400${userClause} THEN 1 ELSE 0 END), 0) as errors
      FROM usage_logs
    `
    )
    .get({ fiveHourSince, weeklySince, ...userParams }) as any;

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
    todayInputTokens: Number(todayUsage.input_tokens),
    todayCacheCreationInputTokens: Number(todayUsage.cache_creation_input_tokens),
    todayCacheReadInputTokens: Number(todayUsage.cache_read_input_tokens),
    accountBalanceCents: account.freeCreditCents,
    errors: Number(rolling.errors),
    activeKeys: activeKeys.count,
    series
  };
}

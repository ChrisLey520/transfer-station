import { db, nowIso } from '../../db.js';
import type { AgentType, UpstreamChannelGroup, UpstreamChannelGroupListItem } from '../../types.js';
import { listUpstreamSelectionCandidates } from './selection.js';
import {
  buildUpstreamGroupListItem,
  clearExpiredUpstreamDegradations,
  invalidateUpstreamSelectionCache,
  makeId,
  normalizeChannelPriority,
  normalizeOptionalUpstreamUrl,
  normalizeUpstreamKeyStatus,
  normalizeUpstreamStatus,
  normalizeUpstreamUrl,
  recoveryMinutes,
  upstreamRate,
  usageMultiplier,
  type UpstreamChannelInput
} from './shared.js';

export function listUpstreamChannels(): UpstreamChannelGroupListItem[] {
  clearExpiredUpstreamDegradations();
  return (db
    .prepare(
      `
      SELECT *
      FROM upstream_channel_groups
      ORDER BY
        CASE WHEN degraded_until IS NOT NULL THEN 1 ELSE 0 END ASC,
        sort_order ASC,
        created_at ASC
    `
    )
    .all() as any[]).map(buildUpstreamGroupListItem);
}

export function getUpstreamChannel(id: string): UpstreamChannelGroupListItem | null {
  clearExpiredUpstreamDegradations();
  const row = db.prepare('SELECT * FROM upstream_channel_groups WHERE id = ?').get(id);
  return row ? buildUpstreamGroupListItem(row) : null;
}

export function hasAvailableUpstreamChannels(agent: AgentType = 'claude-code') {
  return listUpstreamSelectionCandidates(agent).length > 0;
}

export function upsertUpstreamChannel(input: UpstreamChannelInput) {
  const timestamp = nowIso();
  const id = input.id?.trim() || makeId();
  const current = db.prepare('SELECT * FROM upstream_channel_groups WHERE id = ?').get(id) as any;
  const next = {
    id,
    channelNumber: Number(current?.channel_number ?? 0) || nextChannelNumber(),
    name: input.name.trim(),
    websiteUrl: normalizeOptionalUpstreamUrl(input.websiteUrl ?? current?.website_url ?? ''),
    status: normalizeUpstreamStatus(input.status ?? current?.status),
    claudeApiUrl: normalizeUpstreamUrl(input.claudeApiUrl),
    codexApiUrl: normalizeUpstreamUrl(input.codexApiUrl),
    useIndependentAgentKeys: Boolean(input.useIndependentAgentKeys),
    inputRatePerMillion: upstreamRate(input.inputRatePerMillion, current?.input_rate_per_million ?? 3),
    outputRatePerMillion: upstreamRate(input.outputRatePerMillion, current?.output_rate_per_million ?? 15),
    cacheCreationRatePerMillion: upstreamRate(
      input.cacheCreationRatePerMillion,
      current?.cache_creation_rate_per_million ?? 3.75
    ),
    cacheReadRatePerMillion: upstreamRate(input.cacheReadRatePerMillion, current?.cache_read_rate_per_million ?? 0.3),
    serverErrorRecoveryMinutes: recoveryMinutes(
      input.serverErrorRecoveryMinutes,
      recoveryMinutes(current?.server_error_recovery_minutes, 10)
    ),
    displayUsageMultiplier: usageMultiplier(
      input.displayUsageMultiplier,
      usageMultiplier(current?.display_usage_multiplier, 2)
    ),
    sortOrder: normalizeChannelPriority(input.sortOrder, Number(current?.sort_order ?? 100)),
    createdAt: current?.created_at ?? timestamp,
    updatedAt: timestamp
  };

  if (!next.name) {
    throw new Error('渠道名称不能为空。');
  }

  if (!next.claudeApiUrl || !next.codexApiUrl) {
    throw new Error('Claude Code 与 Codex 的 API URL 均不能为空。');
  }

  db.prepare(
    `
    INSERT INTO upstream_channel_groups (
      id,
      channel_number,
      name,
      website_url,
      status,
      claude_api_url,
      codex_api_url,
      use_independent_agent_keys,
      input_rate_per_million,
      output_rate_per_million,
      cache_creation_rate_per_million,
      cache_read_rate_per_million,
      server_error_recovery_minutes,
      display_usage_multiplier,
      sort_order,
      degraded_until,
      degraded_reason,
      degraded_status_code,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @channelNumber,
      @name,
      @websiteUrl,
      @status,
      @claudeApiUrl,
      @codexApiUrl,
      @useIndependentAgentKeys,
      @inputRatePerMillion,
      @outputRatePerMillion,
      @cacheCreationRatePerMillion,
      @cacheReadRatePerMillion,
      @serverErrorRecoveryMinutes,
      @displayUsageMultiplier,
      @sortOrder,
      NULL,
      NULL,
      NULL,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      channel_number = excluded.channel_number,
      website_url = excluded.website_url,
      status = excluded.status,
      claude_api_url = excluded.claude_api_url,
      codex_api_url = excluded.codex_api_url,
      use_independent_agent_keys = excluded.use_independent_agent_keys,
      input_rate_per_million = excluded.input_rate_per_million,
      output_rate_per_million = excluded.output_rate_per_million,
      cache_creation_rate_per_million = excluded.cache_creation_rate_per_million,
      cache_read_rate_per_million = excluded.cache_read_rate_per_million,
      server_error_recovery_minutes = excluded.server_error_recovery_minutes,
      display_usage_multiplier = excluded.display_usage_multiplier,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `
  ).run({
    ...next,
    useIndependentAgentKeys: next.useIndependentAgentKeys ? 1 : 0
  });

  invalidateUpstreamSelectionCache();
  return getUpstreamChannel(id)!;
}

export function updateUpstreamChannelStatus(id: string, statusInput: UpstreamChannelGroup['status']) {
  const existing = db.prepare('SELECT id FROM upstream_channel_groups WHERE id = ?').get(id);
  if (!existing) return null;

  const status = normalizeUpstreamStatus(statusInput);
  const timestamp = nowIso();
  db.prepare(
    `
    UPDATE upstream_channel_groups
    SET status = @status,
        degraded_until = CASE WHEN @status = 'active' THEN NULL ELSE degraded_until END,
        degraded_reason = CASE WHEN @status = 'active' THEN NULL ELSE degraded_reason END,
        degraded_status_code = CASE WHEN @status = 'active' THEN NULL ELSE degraded_status_code END,
        updated_at = @updatedAt
    WHERE id = @id
  `
  ).run({ id, status, updatedAt: timestamp });

  invalidateUpstreamSelectionCache();
  return getUpstreamChannel(id)!;
}

function nextChannelNumber() {
  const row = db.prepare('SELECT COALESCE(MAX(channel_number), 0) AS max_number FROM upstream_channel_groups').get() as { max_number: number };
  return Number(row?.max_number ?? 0) + 1;
}

export function deleteUpstreamChannel(id: string) {
  const existing = getUpstreamChannel(id);
  if (!existing) return null;
  db.prepare('DELETE FROM upstream_channel_groups WHERE id = ?').run(id);
  invalidateUpstreamSelectionCache();
  return existing;
}

export function cloneUpstreamChannel(id: string, options: { includeKeys?: boolean } = {}) {
  const source = db.prepare('SELECT * FROM upstream_channel_groups WHERE id = ?').get(id) as any;
  if (!source) return null;

  const newId = makeId();
  const timestamp = nowIso();
  const includeKeys = Boolean(options.includeKeys);

  const clone = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO upstream_channel_groups (
        id,
        channel_number,
        name,
        website_url,
        status,
        claude_api_url,
        codex_api_url,
        use_independent_agent_keys,
        input_rate_per_million,
        output_rate_per_million,
        cache_creation_rate_per_million,
        cache_read_rate_per_million,
        server_error_recovery_minutes,
        display_usage_multiplier,
        sort_order,
        degraded_until,
        degraded_reason,
        degraded_status_code,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @channelNumber,
        @name,
        @websiteUrl,
        @status,
        @claudeApiUrl,
        @codexApiUrl,
        @useIndependentAgentKeys,
        @inputRatePerMillion,
        @outputRatePerMillion,
        @cacheCreationRatePerMillion,
        @cacheReadRatePerMillion,
        @serverErrorRecoveryMinutes,
        @displayUsageMultiplier,
        @sortOrder,
        NULL,
        NULL,
        NULL,
        @createdAt,
        @updatedAt
      )
    `
    ).run({
      id: newId,
      channelNumber: nextChannelNumber(),
      name: `${source.name} 副本`,
      websiteUrl: source.website_url ?? '',
      status: normalizeUpstreamStatus(source.status),
      claudeApiUrl: source.claude_api_url,
      codexApiUrl: source.codex_api_url,
      useIndependentAgentKeys: Number(source.use_independent_agent_keys ?? 0),
      inputRatePerMillion: Number(source.input_rate_per_million ?? 3),
      outputRatePerMillion: Number(source.output_rate_per_million ?? 15),
      cacheCreationRatePerMillion: Number(source.cache_creation_rate_per_million ?? 3.75),
      cacheReadRatePerMillion: Number(source.cache_read_rate_per_million ?? 0.3),
      serverErrorRecoveryMinutes: recoveryMinutes(source.server_error_recovery_minutes, 10),
      displayUsageMultiplier: usageMultiplier(source.display_usage_multiplier, 2),
      sortOrder: normalizeChannelPriority(source.sort_order, 100),
      createdAt: timestamp,
      updatedAt: timestamp
    });

    const modelRates = db.prepare('SELECT * FROM upstream_model_rates WHERE channel_group_id = ? ORDER BY sort_order ASC, created_at ASC').all(id) as any[];
    const insertRate = db.prepare(
      `
      INSERT INTO upstream_model_rates (
        id,
        channel_group_id,
        agent_type,
        model,
        input_rate_per_million,
        output_rate_per_million,
        cache_creation_rate_per_million,
        cache_read_rate_per_million,
        is_default,
        sort_order,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @channelGroupId,
        @agentType,
        @model,
        @inputRatePerMillion,
        @outputRatePerMillion,
        @cacheCreationRatePerMillion,
        @cacheReadRatePerMillion,
        @isDefault,
        @sortOrder,
        @createdAt,
        @updatedAt
      )
    `
    );

    for (const rate of modelRates) {
      insertRate.run({
        id: makeId(),
        channelGroupId: newId,
        agentType: rate.agent_type,
        model: rate.model,
        inputRatePerMillion: Number(rate.input_rate_per_million ?? 0),
        outputRatePerMillion: Number(rate.output_rate_per_million ?? 0),
        cacheCreationRatePerMillion: Number(rate.cache_creation_rate_per_million ?? 0),
        cacheReadRatePerMillion: Number(rate.cache_read_rate_per_million ?? 0),
        isDefault: Number(rate.is_default ?? 0),
        sortOrder: Number(rate.sort_order ?? 100),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    if (includeKeys) {
      const keys = db.prepare('SELECT * FROM upstream_channel_keys WHERE channel_group_id = ? ORDER BY sort_order ASC, created_at ASC').all(id) as any[];
      const insertKey = db.prepare(
        `
        INSERT INTO upstream_channel_keys (
          id,
          channel_group_id,
          name,
          agent_type,
          key_hash,
          key_preview,
          key_ciphertext,
          status,
          sort_order,
          expires_at,
          exhausted_until,
          failure_reason,
          failure_status_code,
          last_used_at,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @channelGroupId,
          @name,
          @agentType,
          @keyHash,
          @keyPreview,
          @keyCiphertext,
          @status,
          @sortOrder,
          @expiresAt,
          NULL,
          NULL,
          NULL,
          NULL,
          @createdAt,
          @updatedAt
        )
      `
      );

      for (const key of keys) {
        insertKey.run({
          id: makeId(),
          channelGroupId: newId,
          name: key.name ?? '',
          agentType: key.agent_type,
          keyHash: key.key_hash,
          keyPreview: key.key_preview,
          keyCiphertext: key.key_ciphertext,
          status: normalizeUpstreamKeyStatus(key.status),
          sortOrder: Number(key.sort_order ?? 100),
          expiresAt: key.expires_at ?? null,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
    }

    return getUpstreamChannel(newId)!;
  });

  const channel = clone();
  invalidateUpstreamSelectionCache();
  return channel;
}

import { db, mapUpstreamChannel, mapUpstreamChannelKey, nowIso } from '../../db.js';
import { decryptKey } from '../../crypto.js';
import type { AgentType, UpstreamChannelGroup, UpstreamChannelKey, UpstreamSelection, UpstreamSelectionCandidate } from '../../types.js';
import {
  invalidateUpstreamSelectionCache,
  recoveryMinutes,
  upstreamKeyDegradeMs,
  upstreamRawKeyCache,
  upstreamRawKeyCacheTtlMs,
  upstreamSelectionCache,
  upstreamSelectionCacheTtlMs
} from './shared.js';

function mapUpstreamSelectionCandidate(row: any, agent: AgentType): UpstreamSelectionCandidate {
  return {
    group: mapUpstreamChannel({
      id: row.group_id,
      channel_number: row.group_channel_number,
      name: row.group_name,
      website_url: row.group_website_url,
      status: row.group_status,
      claude_api_url: row.group_claude_api_url,
      codex_api_url: row.group_codex_api_url,
      use_independent_agent_keys: row.group_use_independent_agent_keys,
      input_rate_per_million: row.group_input_rate_per_million,
      output_rate_per_million: row.group_output_rate_per_million,
      cache_creation_rate_per_million: row.group_cache_creation_rate_per_million,
      cache_read_rate_per_million: row.group_cache_read_rate_per_million,
      server_error_recovery_minutes: row.group_server_error_recovery_minutes,
      display_usage_multiplier: row.group_display_usage_multiplier,
      sort_order: row.group_sort_order,
      degraded_until: row.group_degraded_until,
      degraded_reason: row.group_degraded_reason,
      degraded_status_code: row.group_degraded_status_code,
      created_at: row.group_created_at,
      updated_at: row.group_updated_at
    }) as UpstreamChannelGroup,
    key: mapUpstreamChannelKey({
      id: row.key_id,
      channel_group_id: row.key_channel_group_id,
      name: row.key_name,
      agent_type: row.key_agent_type,
      key_hash: row.key_hash,
      key_preview: row.key_preview,
      key_ciphertext: row.key_ciphertext,
      status: row.key_status,
      sort_order: row.key_sort_order,
      expires_at: row.key_expires_at,
      exhausted_until: row.key_exhausted_until,
      failure_reason: row.key_failure_reason,
      failure_status_code: row.key_failure_status_code,
      last_used_at: row.key_last_used_at,
      created_at: row.key_created_at,
      updated_at: row.key_updated_at
    }) as UpstreamChannelKey,
    agent,
    apiUrl: row.api_url
  };
}

export function listUpstreamSelectionCandidates(agent: AgentType): UpstreamSelectionCandidate[] {
  const now = Date.now();
  const cached = upstreamSelectionCache.get(agent);
  if (cached && cached.expiresAt > now) {
    return cached.selections;
  }

  const timestamp = nowIso();
  const selections = (db
    .prepare(
      `
      SELECT
        g.id AS group_id,
        g.channel_number AS group_channel_number,
        g.name AS group_name,
        g.website_url AS group_website_url,
        g.status AS group_status,
        g.claude_api_url AS group_claude_api_url,
        g.codex_api_url AS group_codex_api_url,
        g.use_independent_agent_keys AS group_use_independent_agent_keys,
        g.input_rate_per_million AS group_input_rate_per_million,
        g.output_rate_per_million AS group_output_rate_per_million,
        g.cache_creation_rate_per_million AS group_cache_creation_rate_per_million,
        g.cache_read_rate_per_million AS group_cache_read_rate_per_million,
        g.server_error_recovery_minutes AS group_server_error_recovery_minutes,
        g.display_usage_multiplier AS group_display_usage_multiplier,
        g.sort_order AS group_sort_order,
        g.degraded_until AS group_degraded_until,
        g.degraded_reason AS group_degraded_reason,
        g.degraded_status_code AS group_degraded_status_code,
        g.created_at AS group_created_at,
        g.updated_at AS group_updated_at,
        k.id AS key_id,
        k.channel_group_id AS key_channel_group_id,
        k.name AS key_name,
        k.agent_type AS key_agent_type,
        k.key_hash AS key_hash,
        k.key_preview AS key_preview,
        k.key_ciphertext AS key_ciphertext,
        k.status AS key_status,
        k.sort_order AS key_sort_order,
        k.expires_at AS key_expires_at,
        k.exhausted_until AS key_exhausted_until,
        k.failure_reason AS key_failure_reason,
        k.failure_status_code AS key_failure_status_code,
        k.last_used_at AS key_last_used_at,
        k.created_at AS key_created_at,
        k.updated_at AS key_updated_at,
        CASE WHEN @agent = 'codex' THEN g.codex_api_url ELSE g.claude_api_url END AS api_url
      FROM upstream_channel_groups g
      JOIN upstream_channel_keys k
        ON k.channel_group_id = g.id
       AND k.agent_type = CASE WHEN g.use_independent_agent_keys = 1 THEN @agent ELSE 'shared' END
      WHERE g.status = 'active'
        AND k.status = 'active'
        AND (k.expires_at IS NULL OR k.expires_at > @now)
        AND (CASE WHEN @agent = 'codex' THEN g.codex_api_url ELSE g.claude_api_url END) != ''
      ORDER BY
        CASE WHEN g.degraded_until IS NOT NULL AND g.degraded_until > @now THEN 1 ELSE 0 END ASC,
        g.sort_order ASC,
        g.created_at ASC,
        CASE WHEN k.exhausted_until IS NOT NULL AND k.exhausted_until > @now THEN 1 ELSE 0 END ASC,
        k.sort_order ASC,
        k.created_at ASC
    `
    )
    .all({ agent, now: timestamp }) as any[]).map((row) => mapUpstreamSelectionCandidate(row, agent));

  upstreamSelectionCache.set(agent, {
    expiresAt: now + upstreamSelectionCacheTtlMs,
    selections
  });
  return selections;
}

export function materializeUpstreamSelection(candidate: UpstreamSelectionCandidate): UpstreamSelection | null {
  const now = Date.now();
  const cached = upstreamRawKeyCache.get(candidate.key.id);
  if (
    cached &&
    cached.ciphertext === candidate.key.keyCiphertext &&
    cached.updatedAt === candidate.key.updatedAt &&
    cached.expiresAt > now
  ) {
    return { ...candidate, rawKey: cached.rawKey };
  }

  const rawKey = decryptKey(candidate.key.keyCiphertext);
  if (!rawKey) return null;

  upstreamRawKeyCache.set(candidate.key.id, {
    ciphertext: candidate.key.keyCiphertext,
    updatedAt: candidate.key.updatedAt,
    rawKey,
    expiresAt: now + upstreamRawKeyCacheTtlMs
  });
  return { ...candidate, rawKey };
}

export function listUpstreamSelections(agent: AgentType): UpstreamSelection[] {
  return listUpstreamSelectionCandidates(agent).flatMap((candidate) => {
    const selection = materializeUpstreamSelection(candidate);
    return selection ? [selection] : [];
  });
}

export function markUpstreamKeyFailure(input: {
  keyId: string;
  statusCode: number;
  reason: string;
  until?: string | null;
}) {
  const allowFallbackUntil = input.statusCode === 402;
  const fallbackUntil = new Date(Date.now() + upstreamKeyDegradeMs).toISOString();
  const until = input.until && Number.isFinite(Date.parse(input.until)) ? input.until : allowFallbackUntil ? fallbackUntil : null;
  db.prepare(
    `
    UPDATE upstream_channel_keys
    SET exhausted_until = @until,
        failure_reason = @reason,
        failure_status_code = @statusCode,
        updated_at = @updatedAt
    WHERE id = @keyId
  `
  ).run({
    keyId: input.keyId,
    until,
    reason: input.reason.slice(0, 500),
    statusCode: input.statusCode,
    updatedAt: nowIso()
  });
  invalidateUpstreamSelectionCache();
}

export function markUpstreamGroupFailure(input: {
  groupId: string;
  statusCode: number;
  reason: string;
  until?: string | null;
}) {
  const row = db.prepare('SELECT server_error_recovery_minutes FROM upstream_channel_groups WHERE id = ?').get(input.groupId) as
    | { server_error_recovery_minutes: number }
    | undefined;
  const minutes = recoveryMinutes(row?.server_error_recovery_minutes, 10);
  const fallbackUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const until = input.until && Number.isFinite(Date.parse(input.until)) ? input.until : fallbackUntil;
  db.prepare(
    `
    UPDATE upstream_channel_groups
    SET degraded_until = @until,
        degraded_reason = @reason,
        degraded_status_code = @statusCode,
        updated_at = @updatedAt
    WHERE id = @groupId
  `
  ).run({
    groupId: input.groupId,
    until,
    reason: input.reason.slice(0, 500),
    statusCode: input.statusCode,
    updatedAt: nowIso()
  });
  invalidateUpstreamSelectionCache();
}

export function resetUpstreamKeyFailureState(keyId: string) {
  db.prepare(
    `
    UPDATE upstream_channel_keys
    SET exhausted_until = NULL,
        failure_reason = NULL,
        failure_status_code = NULL,
        updated_at = @updatedAt
    WHERE id = @keyId
  `
  ).run({ keyId, updatedAt: nowIso() });
  invalidateUpstreamSelectionCache();
}


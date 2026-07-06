import { db, mapUpstreamModelRate, nowIso } from '../../db.js';
import type { UsageRates } from '../../pricing.js';
import type { AgentType, UpstreamModelRate } from '../../types.js';
import { getUpstreamChannel } from './channels.js';
import { makeId, modelRatesForGroup, normalizeModelRateInput, type UpstreamModelRateInput } from './shared.js';

export function upsertUpstreamModelRate(groupId: string, input: UpstreamModelRateInput) {
  const group = getUpstreamChannel(groupId);
  if (!group) return null;

  const model = input.model.trim();
  if (!model) {
    throw new Error('模型名称不能为空。');
  }

  const agentType: AgentType = input.agentType === 'codex' ? 'codex' : 'claude-code';
  const timestamp = nowIso();
  const existing = input.id
    ? (db.prepare('SELECT * FROM upstream_model_rates WHERE id = ? AND channel_group_id = ?').get(input.id, groupId) as any)
    : (db
        .prepare('SELECT * FROM upstream_model_rates WHERE channel_group_id = @groupId AND agent_type = @agentType AND model = @model')
        .get({ groupId, agentType, model }) as any);
  const current = existing ? (mapUpstreamModelRate(existing) as UpstreamModelRate) : null;
  const id = current?.id || input.id?.trim() || makeId();
  const next = {
    id,
    groupId,
    agentType,
    model,
    inputRatePerMillion: normalizeModelRateInput(input.inputRatePerMillion, current?.inputRatePerMillion ?? 0),
    outputRatePerMillion: normalizeModelRateInput(input.outputRatePerMillion, current?.outputRatePerMillion ?? 0),
    cacheCreationRatePerMillion: normalizeModelRateInput(
      input.cacheCreationRatePerMillion,
      current?.cacheCreationRatePerMillion ?? 0
    ),
    cacheReadRatePerMillion: normalizeModelRateInput(input.cacheReadRatePerMillion, current?.cacheReadRatePerMillion ?? 0),
    isDefault: Boolean(input.isDefault),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : current?.sortOrder ?? 100,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp
  };

  db.prepare(
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
      @groupId,
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
    ON CONFLICT(channel_group_id, agent_type, model) DO UPDATE SET
      input_rate_per_million = excluded.input_rate_per_million,
      output_rate_per_million = excluded.output_rate_per_million,
      cache_creation_rate_per_million = excluded.cache_creation_rate_per_million,
      cache_read_rate_per_million = excluded.cache_read_rate_per_million,
      is_default = excluded.is_default,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `
  ).run({
    ...next,
    isDefault: next.isDefault ? 1 : 0
  });

  return getUpstreamChannel(groupId)!;
}

export function deleteUpstreamModelRate(groupId: string, rateId: string) {
  const row = db.prepare('SELECT * FROM upstream_model_rates WHERE id = ? AND channel_group_id = ?').get(rateId, groupId) as any;
  if (!row) return null;
  const rate = mapUpstreamModelRate(row) as UpstreamModelRate;
  db.prepare('DELETE FROM upstream_model_rates WHERE id = ? AND channel_group_id = ?').run(rateId, groupId);
  return rate;
}

function modelMatches(pattern: string, model: string) {
  if (pattern === '*') return true;
  const normalizedPattern = pattern.toLowerCase();
  const normalizedModel = model.toLowerCase();
  if (normalizedPattern.endsWith('*')) {
    return normalizedModel.startsWith(normalizedPattern.slice(0, -1));
  }
  return normalizedPattern === normalizedModel;
}

export function resolveUpstreamRates(input: { groupId: string; agent: AgentType; model?: string | null }): UsageRates {
  const model = (input.model || '').trim();
  const rates = modelRatesForGroup(input.groupId).filter((rate) => rate.agentType === input.agent);
  const exact = model ? rates.find((rate) => !rate.model.endsWith('*') && modelMatches(rate.model, model)) : undefined;
  const wildcard = model
    ? rates
        .filter((rate) => rate.model.endsWith('*') && rate.model !== '*')
        .sort((a, b) => b.model.length - a.model.length || a.sortOrder - b.sortOrder)
        .find((rate) => modelMatches(rate.model, model))
    : undefined;
  const defaultRate = rates.find((rate) => rate.isDefault) || rates.find((rate) => rate.model === '*');
  const matched = exact || wildcard || defaultRate;
  if (matched) {
    return {
      inputPerMillion: matched.inputRatePerMillion,
      outputPerMillion: matched.outputRatePerMillion,
      cacheCreationPerMillion: matched.cacheCreationRatePerMillion,
      cacheReadPerMillion: matched.cacheReadRatePerMillion
    };
  }

  const group = getUpstreamChannel(input.groupId);
  return {
    inputPerMillion: group?.inputRatePerMillion ?? 3,
    outputPerMillion: group?.outputRatePerMillion ?? 15,
    cacheCreationPerMillion: group?.cacheCreationRatePerMillion ?? 3.75,
    cacheReadPerMillion: group?.cacheReadRatePerMillion ?? 0.3
  };
}


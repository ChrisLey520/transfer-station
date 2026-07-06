import { customAlphabet } from 'nanoid';
import { encryptKey, hashKey, previewKey } from '../crypto.js';
import { db, nowIso } from '../db.js';
import { usageCostCents } from '../pricing.js';
import type { AgentType } from '../types.js';
import { seedDemoGiftCards } from './gift-cards/seed.js';
import { createKey } from './keys.js';
import { ensureFreePlan, normalizeLegacyPlanLimits, seedDefaultProductLinks, syncUpgradePlanCatalog } from './plans.js';
import { ensureDefaultUser } from './users.js';

const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

type DefaultUpstreamModelRate = {
  agentType: AgentType;
  model: string;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  cacheCreationRatePerMillion: number;
  cacheReadRatePerMillion: number;
  isDefault: boolean;
  sortOrder?: number;
};

const defaultUpstreamKeys = [
  'fe_oa_3b85736670b37e72e50837f3c3194ab9592805d75cc0f996',
  'fe_oa_2b63e8f95a102f694b53eb11e027c47beaf7fc755b62df2e',
  'fe_oa_eec158e9745f608c3c2197ba25b234048bfb7112071d9527',
  'fe_oa_009d1a43ecc501c3a407e79fe43700105fc0c71ae864da7c',
  'fe_oa_00d49638493d1db1d6a14c35be2bf5e4f0fb8ea55e6a5f76',
  'fe_oa_349de2b4184e7b84e435301566f86d8c7ce738a4dd31c9c0',
  'fe_oa_fbcee54a3826f6794a0a0147f704b84f58bf76957579f574'
];

const defaultUpstreamModelRates: Array<DefaultUpstreamModelRate & { sortOrder: number }> = [
  { agentType: 'claude-code', model: '*', inputRatePerMillion: 3, outputRatePerMillion: 15, cacheCreationRatePerMillion: 3.75, cacheReadRatePerMillion: 0.3, isDefault: true, sortOrder: 10 },
  { agentType: 'claude-code', model: 'claude-sonnet-5*', inputRatePerMillion: 3, outputRatePerMillion: 15, cacheCreationRatePerMillion: 3.75, cacheReadRatePerMillion: 0.3, isDefault: false, sortOrder: 20 },
  { agentType: 'claude-code', model: 'claude-sonnet-4*', inputRatePerMillion: 3, outputRatePerMillion: 15, cacheCreationRatePerMillion: 3.75, cacheReadRatePerMillion: 0.3, isDefault: false, sortOrder: 30 },
  { agentType: 'claude-code', model: 'claude-3-5-sonnet*', inputRatePerMillion: 3, outputRatePerMillion: 15, cacheCreationRatePerMillion: 3.75, cacheReadRatePerMillion: 0.3, isDefault: false, sortOrder: 40 },
  { agentType: 'claude-code', model: 'claude-opus-4*', inputRatePerMillion: 15, outputRatePerMillion: 75, cacheCreationRatePerMillion: 18.75, cacheReadRatePerMillion: 1.5, isDefault: false, sortOrder: 50 },
  { agentType: 'claude-code', model: 'claude-fable-5*', inputRatePerMillion: 15, outputRatePerMillion: 75, cacheCreationRatePerMillion: 18.75, cacheReadRatePerMillion: 1.5, isDefault: false, sortOrder: 60 },
  { agentType: 'claude-code', model: 'claude-mythos-5*', inputRatePerMillion: 15, outputRatePerMillion: 75, cacheCreationRatePerMillion: 18.75, cacheReadRatePerMillion: 1.5, isDefault: false, sortOrder: 70 },
  { agentType: 'claude-code', model: 'claude-haiku-4-5*', inputRatePerMillion: 1, outputRatePerMillion: 5, cacheCreationRatePerMillion: 1.25, cacheReadRatePerMillion: 0.1, isDefault: false, sortOrder: 80 },
  { agentType: 'claude-code', model: 'claude-3-5-haiku*', inputRatePerMillion: 0.8, outputRatePerMillion: 4, cacheCreationRatePerMillion: 1, cacheReadRatePerMillion: 0.08, isDefault: false, sortOrder: 90 },
  { agentType: 'codex', model: '*', inputRatePerMillion: 1.75, outputRatePerMillion: 14, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.175, isDefault: true, sortOrder: 110 },
  { agentType: 'codex', model: 'gpt-5.3-codex', inputRatePerMillion: 1.75, outputRatePerMillion: 14, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.175, isDefault: false, sortOrder: 120 },
  { agentType: 'codex', model: 'gpt-5.2-codex', inputRatePerMillion: 1.75, outputRatePerMillion: 14, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.175, isDefault: false, sortOrder: 130 },
  { agentType: 'codex', model: 'gpt-5.1-codex-max', inputRatePerMillion: 1.25, outputRatePerMillion: 10, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.125, isDefault: false, sortOrder: 140 },
  { agentType: 'codex', model: 'gpt-5.1-codex', inputRatePerMillion: 1.25, outputRatePerMillion: 10, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.125, isDefault: false, sortOrder: 150 },
  { agentType: 'codex', model: 'gpt-5-codex', inputRatePerMillion: 1.25, outputRatePerMillion: 10, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.125, isDefault: false, sortOrder: 160 },
  { agentType: 'codex', model: 'gpt-5.1-codex-mini', inputRatePerMillion: 0.25, outputRatePerMillion: 2, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.025, isDefault: false, sortOrder: 170 },
  { agentType: 'codex', model: 'codex-mini-latest', inputRatePerMillion: 1.5, outputRatePerMillion: 6, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.375, isDefault: false, sortOrder: 180 },
  { agentType: 'codex', model: 'gpt-5.4*', inputRatePerMillion: 1.5, outputRatePerMillion: 9, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.15, isDefault: false, sortOrder: 190 },
  { agentType: 'codex', model: 'gpt-5*', inputRatePerMillion: 1.25, outputRatePerMillion: 10, cacheCreationRatePerMillion: 0, cacheReadRatePerMillion: 0.125, isDefault: false, sortOrder: 200 }
];

export function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number };
  if (count.count > 0) {
    ensureFreePlan();
    syncUpgradePlanCatalog();
    normalizeLegacyPlanLimits();
    backfillUsageLogCosts();
    ensureDefaultUser();
    seedDemoGiftCards();
    seedDefaultUpstreamChannels();
    seedDefaultProductLinks();
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
  ensureFreePlan();
  syncUpgradePlanCatalog();

  const defaultUser = ensureDefaultUser();
  createKey({
    name: 'Demo Claude Code Key',
    ownerEmail: 'ops@example.com',
    planId: 'team',
    userId: defaultUser.id
  });

  seedSampleLogs();
  backfillUsageLogCosts();
  seedDemoGiftCards();
  seedDefaultUpstreamChannels();
  seedDefaultProductLinks();
}

function seedDefaultUpstreamChannels() {
  const timestamp = nowIso();
  const existing = db.prepare('SELECT * FROM upstream_channel_groups WHERE id = ?').get('freemodel') as any;
  if (existing) {
    db.prepare(
      `
      UPDATE upstream_channel_groups
      SET name = @name,
          claude_api_url = @claudeApiUrl,
          codex_api_url = @codexApiUrl,
          use_independent_agent_keys = 0,
          server_error_recovery_minutes = 10,
          display_usage_multiplier = 2,
          updated_at = @updatedAt
      WHERE id = @id
    `
    ).run({
      id: 'freemodel',
      name: 'FreeModel',
      claudeApiUrl: 'https://api-cc.freemodel.dev',
      codexApiUrl: 'https://vip-sg.freemodel.dev',
      updatedAt: timestamp
    });
  } else {
    db.prepare(
      `
      INSERT INTO upstream_channel_groups (
        id,
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
        @name,
        @websiteUrl,
        'active',
        @claudeApiUrl,
        @codexApiUrl,
        0,
        3,
        15,
        3.75,
        0.3,
        10,
        2,
        10,
        NULL,
        NULL,
        NULL,
        @createdAt,
        @updatedAt
      )
    `
    ).run({
      id: 'freemodel',
      name: 'FreeModel',
      websiteUrl: 'https://freemodel.dev',
      claudeApiUrl: 'https://api-cc.freemodel.dev',
      codexApiUrl: 'https://vip-sg.freemodel.dev',
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  defaultUpstreamKeys.forEach((key, index) => {
    const keyHash = hashKey(key);
    const defaultName = `FreeModel #${index + 1}`;
    const existingKey = db.prepare('SELECT id, name FROM upstream_channel_keys WHERE channel_group_id = ? AND key_hash = ?').get('freemodel', keyHash) as
      | { id: string; name: string | null }
      | undefined;
    if (existingKey) {
      if (!existingKey.name) {
        db.prepare('UPDATE upstream_channel_keys SET name = ?, updated_at = ? WHERE id = ?').run(defaultName, timestamp, existingKey.id);
      }
      return;
    }

    db.prepare(
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
        'shared',
        @keyHash,
        @keyPreview,
        @keyCiphertext,
        'active',
        @sortOrder,
        NULL,
        NULL,
        NULL,
        NULL,
        @createdAt,
        @updatedAt
      )
    `
    ).run({
      id: makeId(),
      channelGroupId: 'freemodel',
      name: defaultName,
      keyHash,
      keyPreview: previewKey(key),
      keyCiphertext: encryptKey(key),
      sortOrder: (index + 1) * 10,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  });

  seedDefaultModelRatesForChannel('freemodel');
}

function seedDefaultModelRatesForChannel(groupId: string) {
  const timestamp = nowIso();
  defaultUpstreamModelRates.forEach((rate) => {
    const existing = db
      .prepare('SELECT id FROM upstream_model_rates WHERE channel_group_id = @groupId AND agent_type = @agentType AND model = @model')
      .get({ groupId, agentType: rate.agentType, model: rate.model });
    if (existing) return;

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
    `
    ).run({
      id: makeId(),
      groupId,
      agentType: rate.agentType,
      model: rate.model,
      inputRatePerMillion: rate.inputRatePerMillion,
      outputRatePerMillion: rate.outputRatePerMillion,
      cacheCreationRatePerMillion: rate.cacheCreationRatePerMillion,
      cacheReadRatePerMillion: rate.cacheReadRatePerMillion,
      isDefault: rate.isDefault ? 1 : 0,
      sortOrder: rate.sortOrder,
      createdAt: timestamp,
      updatedAt: timestamp
    } as any);
  });
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
      usageSource: 'plan',
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

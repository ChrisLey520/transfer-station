import crypto from 'node:crypto';
import { customAlphabet } from 'nanoid';
import {
  db,
  mapKey,
  mapLog,
  mapPlan,
  mapPlatformOrder,
  mapProductLink,
  mapTaobaoProductMapping,
  mapTaobaoShop,
  mapUpstreamChannel,
  mapUpstreamChannelKey,
  mapUpstreamModelRate,
  nowIso
} from './db.js';
import { createApiKey, decryptKey, encryptKey, hashKey, previewKey } from './crypto.js';
import { usageCostCents, type UsageRates } from './pricing.js';
import type {
  Announcement,
  AgentType,
  ApiKeyRecord,
  GiftCard,
  GiftCardConsequence,
  KeyListItem,
  KeyWithPlan,
  Plan,
  PlatformOrder,
  ProductItemType,
  ProductLink,
  PurchaseChannelId,
  QuotaSnapshot,
  TaobaoProductMapping,
  TaobaoShop,
  UpstreamChannelGroup,
  UpstreamChannelGroupListItem,
  UpstreamChannelKey,
  UpstreamModelRate,
  UpstreamKeyAgentType,
  UpstreamSelection,
  User,
  UserRole,
  UsageLog
} from './types.js';

const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);
const makeGiftCodeSegment = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const fiveHoursMs = 5 * 60 * 60 * 1000;
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
const upstreamKeyDegradeMs = 30 * 60 * 1000;
const usageLogPruneIntervalMs = 60 * 60 * 1000;
const lastUsedTouchIntervalMs = 60 * 1000;

let lastUsageLogPrunedAt = 0;
const apiKeyTouchedAt = new Map<string, number>();
const upstreamKeyTouchedAt = new Map<string, number>();

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

type AccountState = {
  freeCreditCents: number;
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentPlanRank: number;
  planExpiresAt: string | null;
};

type GiftCardPreview = {
  card: GiftCard;
  currentPlan: Pick<AccountState, 'currentPlanId' | 'currentPlanName' | 'currentPlanRank' | 'planExpiresAt'>;
  consequence: GiftCardConsequence;
  canUse: boolean;
  message: string;
};

type CreateGiftCardsInput =
  | {
      type: 'credit';
      amountCents: number;
      quantity?: number;
      prefix?: string;
      createdByUserId?: string | null;
    }
  | {
      type: 'plan';
      planId: string;
      durationMonths?: number;
      quantity?: number;
      prefix?: string;
      createdByUserId?: string | null;
    };

type GiftCardListInput = {
  type?: GiftCard['type'];
  page?: number;
  pageSize?: number;
};

type UserSession = {
  user: User;
  token: string;
  expiresAt: string;
};

type AnnouncementDismissAction = 'close' | 'closeToday';

type AnnouncementWithVisibility = Announcement & {
  shouldShow: boolean;
  dismissedForToday: boolean;
  dismissedPermanently: boolean;
};

type UpstreamChannelInput = {
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

type UpstreamChannelKeyInput = {
  key: string;
  name?: string;
  agentType?: UpstreamKeyAgentType;
  sortOrder?: number;
  expiresAt?: string | null;
};

type UpstreamModelRateInput = {
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

type ProductLinkInput = {
  itemType: ProductItemType;
  itemId: string;
  channel: PurchaseChannelId;
  url: string;
};

type TaobaoProductMappingInput = {
  id?: string;
  numIid: string;
  skuId?: string | null;
  title?: string;
  giftType: 'credit' | 'plan';
  amountCents?: number;
  planId?: string | null;
  durationMonths?: number;
  quantity?: number;
  isActive?: boolean;
};

type TaobaoOrderLineInput = {
  shopId?: string | null;
  orderId: string;
  subOrderId?: string;
  buyerNick?: string;
  itemId: string;
  skuId?: string | null;
  title?: string;
  status: string;
  rawPayload?: unknown;
  lastEventAt?: string | null;
};

const logRangeMs: Record<LogRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': sevenDaysMs,
  '30d': thirtyDaysMs
};

const upgradePlanCatalog = [
  {
    id: 'pro',
    name: 'Pro',
    description: '入门版',
    fiveHourTokenLimit: 2000,
    weeklyTokenLimit: 14000,
    priceCents: 6000,
    currency: 'CNY',
    rank: 1
  },
  {
    id: 'max',
    name: 'Max',
    description: '专业版',
    fiveHourTokenLimit: 4000,
    weeklyTokenLimit: 26400,
    priceCents: 11900,
    currency: 'CNY',
    rank: 2
  },
  {
    id: 'ultra',
    name: 'Ultra',
    description: '高级版',
    fiveHourTokenLimit: 20000,
    weeklyTokenLimit: 132000,
    priceCents: 58000,
    currency: 'CNY',
    rank: 3
  },
  {
    id: 'power',
    name: 'Power',
    description: '旗舰版 · 团队与高强度工作量',
    fiveHourTokenLimit: 40000,
    weeklyTokenLimit: 264000,
    priceCents: 115000,
    currency: 'CNY',
    rank: 4
  }
];

export const creditProductCatalog = [
  { id: '20', amountUsd: 20, priceCents: 599, currency: 'CNY' },
  { id: '50', amountUsd: 50, priceCents: 1199, currency: 'CNY' },
  { id: '100', amountUsd: 100, priceCents: 2199, currency: 'CNY' },
  { id: '200', amountUsd: 200, priceCents: 4699, currency: 'CNY' }
];

const defaultProductUrls: Record<PurchaseChannelId, string> = {
  taobao: 'https://www.taobao.com/',
  xianyu: 'https://www.goofish.com/'
};

const defaultFreePlan = {
  id: 'free',
  name: 'Free',
  description: '免费版',
  fiveHourTokenLimit: 0,
  weeklyTokenLimit: 0,
  priceCents: 0,
  currency: 'CNY',
  rank: 0
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

const defaultUpstreamModelRates: Array<Omit<UpstreamModelRateInput, 'id'> & { sortOrder: number }> = [
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

function defaultProductItems() {
  return [
    ...upgradePlanCatalog.map((plan) => ({ itemType: 'plan' as const, itemId: plan.id })),
    ...creditProductCatalog.map((credit) => ({ itemType: 'credit' as const, itemId: credit.id }))
  ];
}

function seedDefaultProductLinks() {
  const timestamp = nowIso();
  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO product_links (
      item_type,
      item_id,
      channel,
      url,
      created_at,
      updated_at
    )
    VALUES (
      @itemType,
      @itemId,
      @channel,
      @url,
      @createdAt,
      @updatedAt
    )
  `
  );

  const tx = db.transaction(() => {
    for (const item of defaultProductItems()) {
      (Object.keys(defaultProductUrls) as PurchaseChannelId[]).forEach((channel) => {
        insert.run({
          itemType: item.itemType,
          itemId: item.itemId,
          channel,
          url: defaultProductUrls[channel],
          createdAt: timestamp,
          updatedAt: timestamp
        });
      });
    }
  });
  tx();
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

function ensureFreePlan() {
  const existing = db.prepare('SELECT id FROM plans WHERE id = ?').get(defaultFreePlan.id);
  const timestamp = nowIso();
  if (existing) {
    db.prepare(
      `
      UPDATE plans
      SET name = @name,
          description = @description,
          five_hour_token_limit = @fiveHourTokenLimit,
          weekly_token_limit = @weeklyTokenLimit,
          price_cents = @priceCents,
          currency = @currency,
          is_active = 1,
          updated_at = @updatedAt
      WHERE id = @id
    `
    ).run({
      ...defaultFreePlan,
      updatedAt: timestamp
    });
    return;
  }

  db.prepare(
    `
    INSERT INTO plans (
      id,
      name,
      description,
      five_hour_token_limit,
      weekly_token_limit,
      price_cents,
      currency,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @name,
      @description,
      @fiveHourTokenLimit,
      @weeklyTokenLimit,
      @priceCents,
      @currency,
      1,
      @createdAt,
      @updatedAt
    )
  `
  ).run({
    ...defaultFreePlan,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

function syncUpgradePlanCatalog() {
  const timestamp = nowIso();
  const tx = db.transaction(() => {
    for (const plan of upgradePlanCatalog) {
      upsertPlan({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        fiveHourTokenLimit: plan.fiveHourTokenLimit,
        weeklyTokenLimit: plan.weeklyTokenLimit,
        priceCents: plan.priceCents,
        currency: plan.currency,
        isActive: true
      });
    }

    const proPlan = upgradePlanCatalog.find((plan) => plan.id === 'pro')!;
    db.prepare(`
      UPDATE account_state
      SET current_plan_id = @planId,
          current_plan_name = @planName,
          current_plan_rank = @planRank,
          updated_at = @updatedAt
      WHERE current_plan_id = 'pro-plus'
    `).run({
      planId: proPlan.id,
      planName: proPlan.name,
      planRank: proPlan.rank,
      updatedAt: timestamp
    });

    db.prepare("UPDATE api_keys SET plan_id = @planId WHERE plan_id = 'pro-plus'").run({ planId: proPlan.id });

    db.prepare(`
      UPDATE gift_cards
      SET plan_id = @planId,
          plan_name = @planName,
          five_hour_token_limit = @fiveHourTokenLimit,
          weekly_token_limit = @weeklyTokenLimit,
          plan_rank = @planRank
      WHERE plan_id = 'pro-plus'
    `).run({
      planId: proPlan.id,
      planName: proPlan.name,
      fiveHourTokenLimit: proPlan.fiveHourTokenLimit,
      weeklyTokenLimit: proPlan.weeklyTokenLimit,
      planRank: proPlan.rank
    });

    db.prepare("UPDATE plans SET is_active = 0, updated_at = @updatedAt WHERE id = 'pro-plus'").run({ updatedAt: timestamp });
  });

  tx();
}

function mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    role: normalizeUserRole(row.role),
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeUserRole(role: unknown): UserRole {
  return role === 'admin' ? 'admin' : 'member';
}

function configuredAdminEmails() {
  const emails = new Set(['demo@example.com']);
  for (const email of (process.env.ADMIN_EMAILS || '').split(',')) {
    const normalized = email.trim().toLowerCase();
    if (normalized) emails.add(normalized);
  }
  return emails;
}

function syncConfiguredAdminRoles() {
  const emails = Array.from(configuredAdminEmails());
  if (!emails.length) return;

  const update = db.prepare("UPDATE users SET role = 'admin', updated_at = @updatedAt WHERE lower(email) = @email");
  const updatedAt = nowIso();
  const tx = db.transaction(() => {
    emails.forEach((email) => update.run({ email, updatedAt }));
  });
  tx();
}

function passwordDigest(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function tokenDigest(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toPublicUser(row: any): User {
  return mapUser(row);
}

function normalizeAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    content: row.content,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getLatestAnnouncement(): Announcement | null {
  const row = db.prepare('SELECT * FROM announcements ORDER BY updated_at DESC LIMIT 1').get() as any;
  return row ? normalizeAnnouncement(row) : null;
}

function getUserAnnouncementState(userId: string, announcementId: string) {
  const row = db
    .prepare('SELECT * FROM user_announcement_states WHERE user_id = ? AND announcement_id = ?')
    .get(userId, announcementId) as
    | {
        closed_at: string | null;
        closed_for_date: string | null;
      }
    | undefined;
  return row || null;
}

function upsertUserAnnouncementState(input: {
  userId: string;
  announcementId: string;
  closedAt?: string | null;
  closedForDate?: string | null;
}) {
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO user_announcement_states (
      user_id,
      announcement_id,
      closed_at,
      closed_for_date,
      created_at,
      updated_at
    )
    VALUES (
      @userId,
      @announcementId,
      @closedAt,
      @closedForDate,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(user_id, announcement_id) DO UPDATE SET
      closed_at = excluded.closed_at,
      closed_for_date = excluded.closed_for_date,
      updated_at = excluded.updated_at
  `
  ).run({
    userId: input.userId,
    announcementId: input.announcementId,
    closedAt: input.closedAt ?? null,
    closedForDate: input.closedForDate ?? null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function getAnnouncementForUser(userId: string): AnnouncementWithVisibility | null {
  const announcement = getLatestAnnouncement();
  if (!announcement) return null;

  const state = getUserAnnouncementState(userId, announcement.id);
  const dismissedPermanently = Boolean(state?.closed_at);
  const dismissedForToday = state?.closed_for_date === todayDateString();

  return {
    ...announcement,
    shouldShow: !dismissedPermanently && !dismissedForToday,
    dismissedForToday,
    dismissedPermanently
  };
}

export function saveAnnouncement(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('公告内容不能为空。');
  }

  const timestamp = nowIso();

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_announcement_states').run();
    db.prepare('DELETE FROM announcements').run();
    db.prepare(
      `
      INSERT INTO announcements (id, content, published_at, created_at, updated_at)
      VALUES (@id, @content, @publishedAt, @createdAt, @updatedAt)
    `
    ).run({
      id: makeId(),
      content: trimmed,
      publishedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  });

  tx();
  return getLatestAnnouncement()!;
}

export function dismissAnnouncementForUser(userId: string, action: AnnouncementDismissAction) {
  const announcement = getLatestAnnouncement();
  if (!announcement) {
    throw new Error('当前没有可关闭的公告。');
  }

  if (action === 'closeToday') {
    upsertUserAnnouncementState({
      userId,
      announcementId: announcement.id,
      closedAt: null,
      closedForDate: todayDateString()
    });
  } else {
    upsertUserAnnouncementState({
      userId,
      announcementId: announcement.id,
      closedAt: nowIso(),
      closedForDate: null
    });
  }

  return getAnnouncementForUser(userId);
}

export function clearAnnouncement() {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_announcement_states').run();
    db.prepare('DELETE FROM announcements').run();
  });
  tx();
}

function createUserRecord(input: { email: string; password: string; displayName?: string | null; role?: UserRole }) {
  const email = input.email.trim().toLowerCase();
  const timestamp = nowIso();
  const salt = crypto.randomBytes(16).toString('hex');
  const userId = makeId();
  const role = normalizeUserRole(input.role);
  db.prepare(
    `
    INSERT INTO users (
      id,
      email,
      role,
      password_hash,
      password_salt,
      display_name,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @email,
      @role,
      @passwordHash,
      @passwordSalt,
      @displayName,
      @createdAt,
      @updatedAt
    )
  `
  ).run({
    id: userId,
    email,
    role,
    passwordHash: passwordDigest(input.password, salt),
    passwordSalt: salt,
    displayName: input.displayName || email.split('@')[0],
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return getUserById(userId)!;
}

function createSession(user: User): UserSession {
  const token = makeToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `
    INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at)
    VALUES (@id, @userId, @tokenHash, @expiresAt, @createdAt)
  `
  ).run({
    id: makeId(),
    userId: user.id,
    tokenHash: tokenDigest(token),
    expiresAt,
    createdAt: nowIso()
  });

  return { user, token, expiresAt };
}

function ensureDefaultUser() {
  const existing = db.prepare('SELECT * FROM users ORDER BY created_at ASC LIMIT 1').get() as any;
  const user = existing
    ? toPublicUser(existing)
    : createUserRecord({
        email: 'demo@example.com',
        password: 'demo123456',
        displayName: 'Demo',
        role: 'admin'
      });

  syncConfiguredAdminRoles();
  const refreshedUser = getUserById(user.id)!;
  db.prepare('UPDATE api_keys SET user_id = ? WHERE user_id IS NULL').run(refreshedUser.id);
  ensureAccountState(refreshedUser.id);
  return refreshedUser;
}

export function registerUser(input: { email: string; password: string; displayName?: string | null }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.trim().toLowerCase());
  if (existing) {
    throw new Error('邮箱已注册。');
  }

  const user = createUserRecord(input);
  ensureAccountState(user.id);
  return createSession(user);
}

export function loginUser(input: { email: string; password: string }) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(input.email.trim().toLowerCase()) as any;
  if (!row) {
    throw new Error('邮箱或密码不正确。');
  }

  const digest = passwordDigest(input.password, row.password_salt);
  const expected = Buffer.from(row.password_hash, 'hex');
  const actual = Buffer.from(digest, 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('邮箱或密码不正确。');
  }

  const user = toPublicUser(row);
  ensureAccountState(user.id);
  return createSession(user);
}

export function getUserById(userId: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return row ? toPublicUser(row) : null;
}

type UserListSortField = 'freeCreditCents' | 'createdAt';
type SortOrder = 'asc' | 'desc';

type UserListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortField?: UserListSortField;
  sortOrder?: SortOrder;
};

type UserListItem = User & {
  currentPlanId: string | null;
  currentPlanName: string | null;
  freeCreditCents: number;
  planExpiresAt: string | null;
};

function mapUserListItem(row: any): UserListItem {
  return {
    ...mapUser(row),
    currentPlanId: row.current_plan_id ?? null,
    currentPlanName: row.current_plan_name ?? null,
    freeCreditCents: Number(row.free_credit_cents ?? 0),
    planExpiresAt: row.plan_expires_at ?? null
  };
}

export function listUsers(input: UserListQuery = {}) {
  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.min(Math.max(1, Math.floor(input.pageSize || 20)), 100);
  const params: Record<string, string | number> = {
    limit: pageSize,
    offset: (page - 1) * pageSize
  };
  const filters: string[] = [];

  if (input.search?.trim()) {
    const keyword = `%${input.search.trim().toLowerCase()}%`;
    filters.push(`(
      lower(users.id) LIKE @search OR
      lower(users.email) LIKE @search OR
      lower(COALESCE(users.display_name, '')) LIKE @search
    )`);
    params.search = keyword;
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = (
    db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM users
        LEFT JOIN account_state ON account_state.id = users.id
        ${where}
      `
      )
      .get(params) as { count: number }
  ).count;

  const sortFieldMap: Record<UserListSortField, string> = {
    freeCreditCents: 'COALESCE(account_state.free_credit_cents, 0)',
    createdAt: 'users.created_at'
  };
  const sortField = input.sortField && input.sortField in sortFieldMap ? input.sortField : 'createdAt';
  const sortOrder = input.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const users = db
    .prepare(
      `
      SELECT
        users.*, 
        account_state.free_credit_cents,
        account_state.current_plan_id,
        account_state.current_plan_name,
        account_state.plan_expires_at
      FROM users
      LEFT JOIN account_state ON account_state.id = users.id
      ${where}
      ORDER BY ${sortFieldMap[sortField]} ${sortOrder}, users.created_at DESC, users.id DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params)
    .map(mapUserListItem);

  return { users, total, page, pageSize, sortField, sortOrder };
}

export function getUserDetail(userId: string): UserListItem | null {
  const row = db
    .prepare(
      `
      SELECT
        users.*, 
        account_state.free_credit_cents,
        account_state.current_plan_id,
        account_state.current_plan_name,
        account_state.plan_expires_at
      FROM users
      LEFT JOIN account_state ON account_state.id = users.id
      WHERE users.id = ?
      LIMIT 1
    `
    )
    .get(userId);

  return row ? mapUserListItem(row) : null;
}

export function getFirstAdminUser(): User | null {
  const row = db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1").get();
  return row ? toPublicUser(row) : null;
}

export function getUserBySessionToken(token: string): User | null {
  const row = db
    .prepare(
      `
      SELECT users.*
      FROM user_sessions
      JOIN users ON users.id = user_sessions.user_id
      WHERE user_sessions.token_hash = ?
        AND user_sessions.expires_at > ?
      LIMIT 1
    `
    )
    .get(tokenDigest(token), nowIso()) as any;

  return row ? toPublicUser(row) : null;
}

function mapGiftCard(row: any): GiftCard {
  return {
    code: row.code,
    type: row.type,
    amountCents: row.amount_cents,
    planId: row.plan_id,
    planName: row.plan_name,
    fiveHourTokenLimit: row.five_hour_token_limit,
    weeklyTokenLimit: row.weekly_token_limit,
    planRank: row.plan_rank,
    durationMonths: row.duration_months,
    redeemedAt: row.redeemed_at,
    revokedAt: row.revoked_at ?? null,
    createdByUserId: row.created_by_user_id ?? null,
    createdByEmail: row.created_by_email ?? null,
    redeemedByUserId: row.redeemed_by_user_id ?? null,
    redeemedByEmail: row.redeemed_by_email ?? null,
    revokedByUserId: row.revoked_by_user_id ?? null,
    revokedByEmail: row.revoked_by_email ?? null,
    createdAt: row.created_at
  };
}

function planRank(planId: string | null | undefined) {
  if (!planId) return 0;
  const catalogRank = upgradePlanCatalog.find((plan) => plan.id === planId)?.rank;
  if (catalogRank !== undefined) return catalogRank;
  if (planId === defaultFreePlan.id) return 0;

  const row = db.prepare('SELECT price_cents FROM plans WHERE id = ?').get(planId) as { price_cents: number } | undefined;
  if (!row) return 1;
  const cheaperPlans = db
    .prepare("SELECT COUNT(*) as count FROM plans WHERE id != 'free' AND price_cents < ?")
    .get(row.price_cents) as { count: number };
  return Math.max(1, cheaperPlans.count + 1);
}

function ensureAccountState(userId: string): AccountState {
  const existing = db.prepare('SELECT * FROM account_state WHERE id = ?').get(userId) as any;
  if (existing) {
    const state = {
      freeCreditCents: existing.free_credit_cents,
      currentPlanId: existing.current_plan_id,
      currentPlanName: existing.current_plan_name,
      currentPlanRank: existing.current_plan_rank,
      planExpiresAt: existing.plan_expires_at
    };
    return normalizeAccountState(userId, state);
  }

  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO account_state (
      id,
      free_credit_cents,
      current_plan_id,
      current_plan_name,
      current_plan_rank,
      plan_expires_at,
      updated_at
    )
    VALUES (@id, 0, 'free', 'Free', 0, NULL, @updatedAt)
  `
  ).run({
    id: userId,
    updatedAt: timestamp
  });

  db.prepare("UPDATE api_keys SET plan_id = 'free' WHERE user_id = ? AND status != 'revoked'").run(userId);

  return {
    freeCreditCents: 0,
    currentPlanId: 'free',
    currentPlanName: 'Free',
    currentPlanRank: 0,
    planExpiresAt: null
  };
}

function normalizeAccountState(userId: string, state: AccountState): AccountState {
  const isExpired = !state.planExpiresAt || new Date(state.planExpiresAt).getTime() <= Date.now();
  if (state.currentPlanRank > 0 && isExpired) {
    db.prepare(
      `
      UPDATE account_state
      SET current_plan_id = 'free',
          current_plan_name = 'Free',
          current_plan_rank = 0,
          plan_expires_at = NULL,
          updated_at = @updatedAt
      WHERE id = @id
    `
    ).run({ id: userId, updatedAt: nowIso() });

    db.prepare("UPDATE api_keys SET plan_id = 'free' WHERE user_id = ? AND status != 'revoked'").run(userId);

    return {
      ...state,
      currentPlanId: 'free',
      currentPlanName: 'Free',
      currentPlanRank: 0,
      planExpiresAt: null
    };
  }

  return state;
}

function seedDemoGiftCards() {
  const createdAt = nowIso();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO gift_cards (
      code,
      type,
      amount_cents,
      plan_id,
      plan_name,
      five_hour_token_limit,
      weekly_token_limit,
      plan_rank,
      duration_months,
      redeemed_at,
      created_at
    )
    VALUES (
      @code,
      @type,
      @amountCents,
      @planId,
      @planName,
      @fiveHourTokenLimit,
      @weeklyTokenLimit,
      @planRank,
      @durationMonths,
      NULL,
      @createdAt
    )
  `);

  const maxPlan = upgradePlanCatalog.find((plan) => plan.id === 'max')!;
  const ultraPlan = upgradePlanCatalog.find((plan) => plan.id === 'ultra')!;
  const cards = [
    {
      code: 'CREDIT-100-DEMO',
      type: 'credit',
      amountCents: 10000,
      planId: null,
      planName: null,
      fiveHourTokenLimit: 0,
      weeklyTokenLimit: 0,
      planRank: 0,
      durationMonths: 0,
      createdAt
    },
    {
      code: 'MAX-PLAN-DEMO',
      type: 'plan',
      amountCents: 0,
      planId: maxPlan.id,
      planName: maxPlan.name,
      fiveHourTokenLimit: maxPlan.fiveHourTokenLimit,
      weeklyTokenLimit: maxPlan.weeklyTokenLimit,
      planRank: maxPlan.rank,
      durationMonths: 1,
      createdAt
    },
    {
      code: 'ULTRA-PLAN-DEMO',
      type: 'plan',
      amountCents: 0,
      planId: ultraPlan.id,
      planName: ultraPlan.name,
      fiveHourTokenLimit: ultraPlan.fiveHourTokenLimit,
      weeklyTokenLimit: ultraPlan.weeklyTokenLimit,
      planRank: ultraPlan.rank,
      durationMonths: 1,
      createdAt
    }
  ];

  const tx = db.transaction(() => cards.forEach((card) => insert.run(card)));
  tx();
}

export function pruneUsageLogs() {
  const cutoff = new Date(Date.now() - thirtyDaysMs).toISOString();
  lastUsageLogPrunedAt = Date.now();
  return db.prepare('DELETE FROM usage_logs WHERE created_at < ?').run(cutoff).changes;
}

function pruneUsageLogsIfDue() {
  if (Date.now() - lastUsageLogPrunedAt < usageLogPruneIntervalMs) return 0;
  return pruneUsageLogs();
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

export function listPlans(): Plan[] {
  return db.prepare('SELECT * FROM plans ORDER BY price_cents ASC').all().map(mapPlan);
}

function productItemSortKey(itemType: ProductItemType, itemId: string) {
  if (itemType === 'plan') {
    const planIndex = upgradePlanCatalog.findIndex((plan) => plan.id === itemId);
    return planIndex >= 0 ? planIndex : 100;
  }

  const creditIndex = creditProductCatalog.findIndex((credit) => credit.id === itemId);
  return creditIndex >= 0 ? 10 + creditIndex : 110;
}

function productChannelSortKey(channel: PurchaseChannelId) {
  return channel === 'taobao' ? 0 : 1;
}

function isKnownProductItem(itemType: ProductItemType, itemId: string) {
  const catalog = itemType === 'plan' ? upgradePlanCatalog : creditProductCatalog;
  return catalog.some((item) => item.id === itemId);
}

export function listProductLinks(): ProductLink[] {
  seedDefaultProductLinks();
  const links = (db.prepare('SELECT * FROM product_links').all() as any[]).map((row) => mapProductLink(row) as ProductLink);
  return links.sort((left, right) => {
    const itemDelta = productItemSortKey(left.itemType, left.itemId) - productItemSortKey(right.itemType, right.itemId);
    if (itemDelta !== 0) return itemDelta;
    return productChannelSortKey(left.channel) - productChannelSortKey(right.channel);
  });
}

export function updateProductLinks(input: ProductLinkInput[]) {
  const timestamp = nowIso();
  const upsert = db.prepare(
    `
    INSERT INTO product_links (
      item_type,
      item_id,
      channel,
      url,
      created_at,
      updated_at
    )
    VALUES (
      @itemType,
      @itemId,
      @channel,
      @url,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(item_type, item_id, channel) DO UPDATE SET
      url = excluded.url,
      updated_at = excluded.updated_at
  `
  );

  const tx = db.transaction(() => {
    for (const link of input) {
      if (!isKnownProductItem(link.itemType, link.itemId)) {
        throw new Error('商品项不存在。');
      }

      upsert.run({
        itemType: link.itemType,
        itemId: link.itemId,
        channel: link.channel,
        url: link.url.trim(),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  });
  tx();
  return listProductLinks();
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

export function listGiftCards(input: GiftCardListInput = {}) {
  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.min(Math.max(1, Math.floor(input.pageSize || 20)), 100);
  const filters: string[] = [];
  const params: Record<string, string | number> = {
    limit: pageSize,
    offset: (page - 1) * pageSize
  };

  if (input.type === 'plan' || input.type === 'credit') {
    filters.push('gift_cards.type = @type');
    params.type = input.type;
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) as count FROM gift_cards ${where}`).get(params) as { count: number }).count;
  const typeRows = db
    .prepare('SELECT type, COUNT(*) as count FROM gift_cards GROUP BY type')
    .all() as Array<{ type: GiftCard['type']; count: number }>;
  const typeCounts = {
    plan: 0,
    credit: 0
  };
  typeRows.forEach((row) => {
    if (row.type === 'plan' || row.type === 'credit') {
      typeCounts[row.type] = row.count;
    }
  });
  const giftCards = db
    .prepare(
      `
      SELECT
        gift_cards.*,
        creators.email as created_by_email,
        redeemers.email as redeemed_by_email,
        revokers.email as revoked_by_email
      FROM gift_cards
      LEFT JOIN users creators ON creators.id = gift_cards.created_by_user_id
      LEFT JOIN users redeemers ON redeemers.id = gift_cards.redeemed_by_user_id
      LEFT JOIN users revokers ON revokers.id = gift_cards.revoked_by_user_id
      ${where}
      ORDER BY
        CASE
          WHEN gift_cards.redeemed_at IS NOT NULL THEN 2
          WHEN gift_cards.revoked_at IS NOT NULL THEN 1
          ELSE 0
        END,
        gift_cards.created_at DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params)
    .map(mapGiftCard);

  return {
    giftCards,
    total,
    typeCounts,
    page,
    pageSize
  };
}

function normalizeGiftCardPrefix(prefix: string | undefined, fallback: string) {
  const normalized = (prefix || fallback)
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 10);
  return normalized || fallback.toUpperCase();
}

function makeGiftCardCode(prefix: string) {
  return [prefix, makeGiftCodeSegment(), makeGiftCodeSegment(), makeGiftCodeSegment()].join('-');
}

function buildGiftCardPayload(input: CreateGiftCardsInput) {
  return (
    input.type === 'credit'
      ? {
          type: 'credit' as const,
          amountCents: Math.max(1, Math.round(input.amountCents)),
          planId: null,
          planName: null,
          fiveHourTokenLimit: 0,
          weeklyTokenLimit: 0,
          planRank: 0,
          durationMonths: 0,
          createdByUserId: input.createdByUserId || null,
          prefix: normalizeGiftCardPrefix(input.prefix, 'RH')
        }
      : (() => {
          const plan = getPlan(input.planId);
          if (!plan || !plan.isActive) {
            throw new GiftCardError('请选择有效套餐。', 400);
          }
          if (plan.id === defaultFreePlan.id) {
            throw new GiftCardError('免费套餐无需生成礼品卡。', 400);
          }
          return {
            type: 'plan' as const,
            amountCents: 0,
            planId: plan.id,
            planName: plan.name,
            fiveHourTokenLimit: plan.fiveHourTokenLimit,
            weeklyTokenLimit: plan.weeklyTokenLimit,
            planRank: planRank(plan.id),
            durationMonths: Math.max(1, Math.min(36, Number(input.durationMonths || 1))),
            createdByUserId: input.createdByUserId || null,
            prefix: normalizeGiftCardPrefix(input.prefix, 'RH')
          };
        })()
  );
}

function insertGiftCardsFromPayload(payload: ReturnType<typeof buildGiftCardPayload>, quantity: number, timestamp = nowIso()) {
  const insert = db.prepare(
    `
    INSERT INTO gift_cards (
      code,
      type,
      amount_cents,
      plan_id,
      plan_name,
      five_hour_token_limit,
      weekly_token_limit,
      plan_rank,
      duration_months,
      redeemed_at,
      revoked_at,
      created_by_user_id,
      redeemed_by_user_id,
      revoked_by_user_id,
      created_at
    )
    VALUES (
      @code,
      @type,
      @amountCents,
      @planId,
      @planName,
      @fiveHourTokenLimit,
      @weeklyTokenLimit,
      @planRank,
      @durationMonths,
      NULL,
      NULL,
      @createdByUserId,
      NULL,
      NULL,
      @createdAt
    )
  `
  );

  const created: GiftCard[] = [];
  for (let index = 0; index < quantity; index += 1) {
    let code = makeGiftCardCode(payload.prefix);
    let attempts = 0;
    while (db.prepare('SELECT code FROM gift_cards WHERE code = ?').get(code)) {
      attempts += 1;
      if (attempts > 10) {
        throw new GiftCardError('礼品码生成冲突，请重试。', 500);
      }
      code = makeGiftCardCode(payload.prefix);
    }

    insert.run({
      code,
      type: payload.type,
      amountCents: payload.amountCents,
      planId: payload.planId,
      planName: payload.planName,
      fiveHourTokenLimit: payload.fiveHourTokenLimit,
      weeklyTokenLimit: payload.weeklyTokenLimit,
      planRank: payload.planRank,
      durationMonths: payload.durationMonths,
      createdByUserId: payload.createdByUserId,
      createdAt: timestamp
    });
    created.push({
      code,
      type: payload.type,
      amountCents: payload.amountCents,
      planId: payload.planId,
      planName: payload.planName,
      fiveHourTokenLimit: payload.fiveHourTokenLimit,
      weeklyTokenLimit: payload.weeklyTokenLimit,
      planRank: payload.planRank,
      durationMonths: payload.durationMonths,
      redeemedAt: null,
      revokedAt: null,
      createdByUserId: payload.createdByUserId,
      createdByEmail: null,
      redeemedByUserId: null,
      redeemedByEmail: null,
      revokedByUserId: null,
      revokedByEmail: null,
      createdAt: timestamp
    });
  }

  return created;
}

export function createGiftCards(input: CreateGiftCardsInput): GiftCard[] {
  const quantity = Math.max(1, Math.min(200, Number(input.quantity || 1)));
  const payload = buildGiftCardPayload(input);
  const tx = db.transaction(() => insertGiftCardsFromPayload(payload, quantity));

  return tx();
}

function normalizeTaobaoId(value: string | number | null | undefined) {
  return value === null || value === undefined ? '' : String(value).trim();
}

export function listTaobaoShops(): TaobaoShop[] {
  return db.prepare('SELECT * FROM taobao_shops ORDER BY updated_at DESC').all().map((row) => mapTaobaoShop(row) as TaobaoShop);
}

export function saveTaobaoShop(input: {
  id: string;
  nick?: string;
  sessionCiphertext: string;
  sessionExpiresAt?: string | null;
  messagePermittedAt?: string | null;
}) {
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO taobao_shops (
      id,
      nick,
      session_ciphertext,
      session_expires_at,
      message_permitted_at,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @nick,
      @sessionCiphertext,
      @sessionExpiresAt,
      @messagePermittedAt,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      nick = excluded.nick,
      session_ciphertext = excluded.session_ciphertext,
      session_expires_at = excluded.session_expires_at,
      message_permitted_at = COALESCE(excluded.message_permitted_at, taobao_shops.message_permitted_at),
      updated_at = excluded.updated_at
  `
  ).run({
    id: normalizeTaobaoId(input.id),
    nick: input.nick || '',
    sessionCiphertext: input.sessionCiphertext,
    sessionExpiresAt: input.sessionExpiresAt || null,
    messagePermittedAt: input.messagePermittedAt || null,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return getTaobaoShop(input.id);
}

export function markTaobaoShopMessagePermitted(shopId: string) {
  const timestamp = nowIso();
  db.prepare('UPDATE taobao_shops SET message_permitted_at = ?, updated_at = ? WHERE id = ?').run(
    timestamp,
    timestamp,
    normalizeTaobaoId(shopId)
  );
  return getTaobaoShop(shopId);
}

export function getTaobaoShop(shopId: string): TaobaoShop | null {
  const row = db.prepare('SELECT * FROM taobao_shops WHERE id = ?').get(normalizeTaobaoId(shopId));
  return row ? (mapTaobaoShop(row) as TaobaoShop) : null;
}

export function listTaobaoProductMappings(): TaobaoProductMapping[] {
  return db
    .prepare(
      `
      SELECT *
      FROM taobao_product_mappings
      ORDER BY is_active DESC, updated_at DESC
    `
    )
    .all()
    .map((row) => mapTaobaoProductMapping(row) as TaobaoProductMapping);
}

export function upsertTaobaoProductMapping(input: TaobaoProductMappingInput) {
  const timestamp = nowIso();
  const numIid = normalizeTaobaoId(input.numIid);
  const skuId = input.skuId ? normalizeTaobaoId(input.skuId) : null;
  if (!numIid) throw new Error('淘宝商品 ID 不能为空。');

  if (input.giftType === 'plan') {
    if (!input.planId || !getPlan(input.planId)) throw new Error('请选择有效套餐。');
  } else if (!input.amountCents || input.amountCents <= 0) {
    throw new Error('余额金额必须大于 0。');
  }

  const existing = input.id
    ? db.prepare('SELECT id FROM taobao_product_mappings WHERE id = ?').get(input.id)
    : skuId
      ? db.prepare('SELECT id FROM taobao_product_mappings WHERE num_iid = ? AND sku_id = ?').get(numIid, skuId)
      : db.prepare('SELECT id FROM taobao_product_mappings WHERE num_iid = ? AND sku_id IS NULL').get(numIid);
  const id = (existing as { id: string } | undefined)?.id || input.id || makeId();
  const values = {
    id,
    numIid,
    skuId,
    title: input.title || '',
    giftType: input.giftType,
    amountCents: input.giftType === 'credit' ? Math.max(1, Math.round(input.amountCents || 0)) : 0,
    planId: input.giftType === 'plan' ? input.planId || null : null,
    durationMonths: Math.max(1, Math.min(36, Number(input.durationMonths || 1))),
    quantity: Math.max(1, Math.min(20, Number(input.quantity || 1))),
    isActive: input.isActive === false ? 0 : 1,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (existing) {
    db.prepare(
      `
      UPDATE taobao_product_mappings
      SET
        num_iid = @numIid,
        sku_id = @skuId,
        title = @title,
        gift_type = @giftType,
        amount_cents = @amountCents,
        plan_id = @planId,
        duration_months = @durationMonths,
        quantity = @quantity,
        is_active = @isActive,
        updated_at = @updatedAt
      WHERE id = @id
    `
    ).run(values);
    return listTaobaoProductMappings();
  }

  db.prepare(
    `
    INSERT INTO taobao_product_mappings (
      id,
      num_iid,
      sku_id,
      title,
      gift_type,
      amount_cents,
      plan_id,
      duration_months,
      quantity,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @numIid,
      @skuId,
      @title,
      @giftType,
      @amountCents,
      @planId,
      @durationMonths,
      @quantity,
      @isActive,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(num_iid, sku_id) DO UPDATE SET
      title = excluded.title,
      gift_type = excluded.gift_type,
      amount_cents = excluded.amount_cents,
      plan_id = excluded.plan_id,
      duration_months = excluded.duration_months,
      quantity = excluded.quantity,
      is_active = excluded.is_active,
      updated_at = excluded.updated_at
  `
  ).run(values);

  return listTaobaoProductMappings();
}

export function deleteTaobaoProductMapping(id: string) {
  const row = db.prepare('SELECT * FROM taobao_product_mappings WHERE id = ?').get(id);
  if (!row) return null;
  db.prepare('DELETE FROM taobao_product_mappings WHERE id = ?').run(id);
  return mapTaobaoProductMapping(row) as TaobaoProductMapping;
}

function findTaobaoProductMapping(itemId: string, skuId?: string | null): TaobaoProductMapping | null {
  const normalizedItemId = normalizeTaobaoId(itemId);
  const normalizedSkuId = skuId ? normalizeTaobaoId(skuId) : null;
  if (!normalizedItemId) return null;

  if (normalizedSkuId) {
    const skuRow = db
      .prepare('SELECT * FROM taobao_product_mappings WHERE num_iid = ? AND sku_id = ? AND is_active = 1 LIMIT 1')
      .get(normalizedItemId, normalizedSkuId);
    if (skuRow) return mapTaobaoProductMapping(skuRow) as TaobaoProductMapping;
  }

  const itemRow = db
    .prepare('SELECT * FROM taobao_product_mappings WHERE num_iid = ? AND sku_id IS NULL AND is_active = 1 LIMIT 1')
    .get(normalizedItemId);
  return itemRow ? (mapTaobaoProductMapping(itemRow) as TaobaoProductMapping) : null;
}

function giftCardInputFromTaobaoMapping(mapping: TaobaoProductMapping): CreateGiftCardsInput {
  if (mapping.giftType === 'credit') {
    return {
      type: 'credit',
      amountCents: mapping.amountCents,
      quantity: mapping.quantity
    };
  }

  if (!mapping.planId) throw new GiftCardError('淘宝商品映射缺少套餐。', 409);
  return {
    type: 'plan',
    planId: mapping.planId,
    durationMonths: mapping.durationMonths,
    quantity: mapping.quantity
  };
}

export function listPlatformOrders(input: {
  page?: number;
  pageSize?: number;
  claimedByUserId?: string | null;
  days?: number;
  giftCardType?: 'all' | 'credit' | 'plan';
  giftCardCode?: string;
} = {}) {
  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.min(Math.max(1, Math.floor(input.pageSize || 20)), 100);
  const filters: string[] = [];
  const params: Record<string, string | number> = {
    limit: pageSize,
    offset: (page - 1) * pageSize
  };

  if (input.claimedByUserId) {
    filters.push('claimed_by_user_id = @claimedByUserId');
    filters.push('claimed_at IS NOT NULL');
    params.claimedByUserId = input.claimedByUserId;

    if (input.days) {
      params.claimedSince = new Date(
        Date.now() - Math.max(1, Math.min(365, input.days)) * 24 * 60 * 60 * 1000
      ).toISOString();
      filters.push('claimed_at >= @claimedSince');
    }
  }

  if (input.giftCardType === 'credit' || input.giftCardType === 'plan') {
    filters.push('gift_cards.type = @giftCardType');
    params.giftCardType = input.giftCardType;
  }

  if (input.giftCardCode?.trim()) {
    filters.push('platform_orders.gift_card_code LIKE @giftCardCode');
    params.giftCardCode = `%${input.giftCardCode.trim()}%`;
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = (
    db
      .prepare(`SELECT COUNT(*) as count FROM platform_orders LEFT JOIN gift_cards ON gift_cards.code = platform_orders.gift_card_code ${where}`)
      .get(params) as { count: number }
  ).count;
  const orders = db
    .prepare(
      `
      SELECT platform_orders.*, gift_cards.type as gift_card_type
      FROM platform_orders
      LEFT JOIN gift_cards ON gift_cards.code = platform_orders.gift_card_code
      ${where}
      ORDER BY COALESCE(claimed_at, updated_at) DESC, updated_at DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params)
    .map((row) => mapPlatformOrder(row) as PlatformOrder);

  return { orders, total, page, pageSize };
}

export function getPlatformOrder(platform: PurchaseChannelId, orderId: string, subOrderId = ''): PlatformOrder | null {
  const row = db
    .prepare('SELECT * FROM platform_orders WHERE platform = ? AND order_id = ? AND sub_order_id = ?')
    .get(platform, normalizeTaobaoId(orderId), normalizeTaobaoId(subOrderId));
  return row ? (mapPlatformOrder(row) as PlatformOrder) : null;
}

export function getPlatformOrdersByOrderId(platform: PurchaseChannelId, orderId: string): PlatformOrder[] {
  return db
    .prepare('SELECT * FROM platform_orders WHERE platform = ? AND order_id = ? ORDER BY created_at ASC')
    .all(platform, normalizeTaobaoId(orderId))
    .map((row) => mapPlatformOrder(row) as PlatformOrder);
}

export function listClaimedPlatformOrdersForUser(
  userId: string,
  days = 30,
  page = 1,
  pageSize = 20,
  giftCardType: 'all' | 'credit' | 'plan' = 'all',
  giftCardCode = ''
) {
  return listPlatformOrders({
    claimedByUserId: userId,
    days: Math.max(1, Math.min(30, days)),
    page,
    pageSize,
    giftCardType,
    giftCardCode
  });
}

export function listRedeemedGiftCards(input: {
  userId?: string;
  days?: number;
  page?: number;
  pageSize?: number;
  type?: 'all' | 'credit' | 'plan';
  code?: string;
} = {}) {
  const page = Math.max(1, Math.floor(input.page || 1));
  const pageSize = Math.min(Math.max(1, Math.floor(input.pageSize || 20)), 100);
  const days = Math.max(1, Math.min(365, input.days || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const params: Record<string, string | number> = {
    since,
    limit: pageSize,
    offset: (page - 1) * pageSize
  };
  const filters = ['gift_cards.redeemed_at IS NOT NULL', 'gift_cards.redeemed_at >= @since'];

  if (input.userId) {
    filters.push('gift_cards.redeemed_by_user_id = @userId');
    params.userId = input.userId;
  }

  if (input.type === 'credit' || input.type === 'plan') {
    filters.push('gift_cards.type = @type');
    params.type = input.type;
  }

  if (input.code?.trim()) {
    filters.push('gift_cards.code LIKE @code');
    params.code = `%${input.code.trim()}%`;
  }

  const where = `WHERE ${filters.join(' AND ')}`;
  const total = (db.prepare(`SELECT COUNT(*) as count FROM gift_cards ${where}`).get(params) as { count: number }).count;
  const giftCards = db
    .prepare(
      `
      SELECT
        gift_cards.*,
        creators.email as created_by_email,
        redeemers.email as redeemed_by_email,
        revokers.email as revoked_by_email
      FROM gift_cards
      LEFT JOIN users creators ON creators.id = gift_cards.created_by_user_id
      LEFT JOIN users redeemers ON redeemers.id = gift_cards.redeemed_by_user_id
      LEFT JOIN users revokers ON revokers.id = gift_cards.revoked_by_user_id
      ${where}
      ORDER BY gift_cards.redeemed_at DESC, gift_cards.created_at DESC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params)
    .map(mapGiftCard);

  return { giftCards, total, page, pageSize, days };
}

export function processTaobaoPaidOrderLine(input: TaobaoOrderLineInput) {
  const orderId = normalizeTaobaoId(input.orderId);
  const subOrderId = normalizeTaobaoId(input.subOrderId) || orderId;
  const itemId = normalizeTaobaoId(input.itemId);
  const skuId = input.skuId ? normalizeTaobaoId(input.skuId) : null;
  const timestamp = nowIso();
  const existing = getPlatformOrder('taobao', orderId, subOrderId);

  if (existing?.giftCardCode) {
    return { order: existing, giftCards: [], created: false, skipped: false };
  }

  const mapping = findTaobaoProductMapping(itemId, skuId);
  const rawPayload = input.rawPayload === undefined ? null : JSON.stringify(input.rawPayload);

  const tx = db.transaction(() => {
    if (!mapping) {
      db.prepare(
        `
        INSERT INTO platform_orders (
          id,
          platform,
          shop_id,
          order_id,
          sub_order_id,
          buyer_nick,
          item_id,
          sku_id,
          title,
          status,
          delivery_status,
          delivery_message,
          last_event_at,
          raw_payload,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          'taobao',
          @shopId,
          @orderId,
          @subOrderId,
          @buyerNick,
          @itemId,
          @skuId,
          @title,
          @status,
          'skipped',
          @deliveryMessage,
          @lastEventAt,
          @rawPayload,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(platform, order_id, sub_order_id) DO UPDATE SET
          shop_id = excluded.shop_id,
          buyer_nick = excluded.buyer_nick,
          item_id = excluded.item_id,
          sku_id = excluded.sku_id,
          title = excluded.title,
          status = excluded.status,
          delivery_status = CASE WHEN platform_orders.gift_card_code IS NULL THEN 'skipped' ELSE platform_orders.delivery_status END,
          delivery_message = excluded.delivery_message,
          last_event_at = excluded.last_event_at,
          raw_payload = excluded.raw_payload,
          updated_at = excluded.updated_at
      `
      ).run({
        id: existing?.id || makeId(),
        shopId: input.shopId || null,
        orderId,
        subOrderId,
        buyerNick: input.buyerNick || '',
        itemId,
        skuId,
        title: input.title || '',
        status: input.status,
        deliveryMessage: '未配置淘宝商品映射，未生成兑换码。',
        lastEventAt: input.lastEventAt || timestamp,
        rawPayload,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      return { giftCards: [] as GiftCard[], status: 'skipped' as const, message: '未配置淘宝商品映射，未生成兑换码。' };
    }

    const giftCards = insertGiftCardsFromPayload(
      buildGiftCardPayload(giftCardInputFromTaobaoMapping(mapping)),
      Math.max(1, Math.min(20, mapping.quantity)),
      timestamp
    );
    const giftCardCodes = giftCards.map((card) => card.code).join('\n');
    db.prepare(
      `
      INSERT INTO platform_orders (
        id,
        platform,
        shop_id,
        order_id,
        sub_order_id,
        buyer_nick,
        item_id,
        sku_id,
        title,
        status,
        gift_card_code,
        delivery_status,
        delivery_message,
        last_event_at,
        raw_payload,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        'taobao',
        @shopId,
        @orderId,
        @subOrderId,
        @buyerNick,
        @itemId,
        @skuId,
        @title,
        @status,
        @giftCardCode,
        'ready',
        @deliveryMessage,
        @lastEventAt,
        @rawPayload,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(platform, order_id, sub_order_id) DO UPDATE SET
        shop_id = excluded.shop_id,
        buyer_nick = excluded.buyer_nick,
        item_id = excluded.item_id,
        sku_id = excluded.sku_id,
        title = excluded.title,
        status = excluded.status,
        gift_card_code = COALESCE(platform_orders.gift_card_code, excluded.gift_card_code),
        delivery_status = CASE WHEN platform_orders.gift_card_code IS NULL THEN 'ready' ELSE platform_orders.delivery_status END,
        delivery_message = excluded.delivery_message,
        last_event_at = excluded.last_event_at,
        raw_payload = excluded.raw_payload,
        updated_at = excluded.updated_at
    `
    ).run({
      id: existing?.id || makeId(),
      shopId: input.shopId || null,
      orderId,
      subOrderId,
      buyerNick: input.buyerNick || '',
      itemId,
      skuId,
      title: input.title || mapping.title || '',
      status: input.status,
      giftCardCode: giftCardCodes,
      deliveryMessage: '兑换码已生成，等待买家领取。',
      lastEventAt: input.lastEventAt || timestamp,
      rawPayload,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    return { giftCards, status: 'ready' as const, message: '兑换码已生成，等待买家领取。' };
  });

  const result = tx();
  return {
    order: getPlatformOrder('taobao', orderId, subOrderId)!,
    giftCards: result.giftCards,
    created: result.status === 'ready',
    skipped: result.status === 'skipped'
  };
}

export function claimTaobaoOrderGiftCards(orderId: string, userId: string) {
  const orders = getPlatformOrdersByOrderId('taobao', orderId).filter((order) => order.giftCardCode);
  if (!orders.length) return [];
  const claimedByOtherUser = orders.find((order) => order.claimedByUserId && order.claimedByUserId !== userId);
  if (claimedByOtherUser) {
    throw new GiftCardError('该订单兑换码已被其他账号领取。', 409);
  }
  const timestamp = nowIso();
  const update = db.prepare(
    `
    UPDATE platform_orders
    SET delivery_status = 'claimed',
        claimed_at = COALESCE(claimed_at, @claimedAt),
        claimed_by_user_id = COALESCE(claimed_by_user_id, @userId),
        updated_at = @updatedAt
    WHERE id = @id
      AND gift_card_code IS NOT NULL
      AND (claimed_by_user_id IS NULL OR claimed_by_user_id = @userId)
  `
  );
  const tx = db.transaction(() =>
    orders.forEach((order) => update.run({ id: order.id, userId, claimedAt: timestamp, updatedAt: timestamp }))
  );
  tx();
  return getPlatformOrdersByOrderId('taobao', orderId).filter((order) => order.giftCardCode);
}

export function recordTaobaoTmcMessage(input: { id: string; topic?: string; content?: string; status?: string; errorMessage?: string | null }) {
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO taobao_tmc_messages (
      id,
      topic,
      content,
      status,
      error_message,
      received_at,
      processed_at
    )
    VALUES (
      @id,
      @topic,
      @content,
      @status,
      @errorMessage,
      @receivedAt,
      @processedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      error_message = excluded.error_message,
      processed_at = excluded.processed_at
  `
  ).run({
    id: input.id,
    topic: input.topic || '',
    content: input.content || '',
    status: input.status || 'received',
    errorMessage: input.errorMessage || null,
    receivedAt: timestamp,
    processedAt: input.status && input.status !== 'received' ? timestamp : null
  });
}

export class GiftCardError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
  }
}

function normalizeGiftCardCode(code: string) {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

function getGiftCard(code: string): GiftCard | null {
  const row = db.prepare('SELECT * FROM gift_cards WHERE code = ?').get(normalizeGiftCardCode(code));
  return row ? mapGiftCard(row) : null;
}

function requireUsableGiftCard(code: string) {
  const card = getGiftCard(code);
  if (!card) {
    throw new GiftCardError('礼品卡不存在或卡密有误。', 404);
  }

  if (card.redeemedAt) {
    throw new GiftCardError('这张礼品卡已经使用，无法重复兑换。', 409);
  }

  if (card.revokedAt) {
    throw new GiftCardError('这张礼品卡已被撤销，无法兑换。', 409);
  }

  return card;
}

export function revokeGiftCard(code: string, revokedByUserId?: string | null) {
  return db.transaction(() => {
    const card = getGiftCard(code);
    if (!card) {
      throw new GiftCardError('礼品卡不存在或卡密有误。', 404);
    }

    if (card.redeemedAt) {
      throw new GiftCardError('已兑换的礼品卡无法撤销。', 409);
    }

    if (card.revokedAt) {
      throw new GiftCardError('这张礼品卡已经撤销。', 409);
    }

    const timestamp = nowIso();
    db.prepare('UPDATE gift_cards SET revoked_at = ?, revoked_by_user_id = ? WHERE code = ?').run(
      timestamp,
      revokedByUserId || null,
      card.code
    );

    const updated = getGiftCard(card.code);
    if (!updated) {
      throw new GiftCardError('礼品卡不存在或卡密有误。', 404);
    }
    return updated;
  })();
}

function buildGiftCardPreview(userId: string, card: GiftCard): GiftCardPreview {
  const account = ensureAccountState(userId);
  const currentPlan = {
    currentPlanId: account.currentPlanId,
    currentPlanName: account.currentPlanName,
    currentPlanRank: account.currentPlanRank,
    planExpiresAt: account.planExpiresAt
  };

  if (card.type === 'credit') {
    return {
      card,
      currentPlan,
      consequence: 'credit',
      canUse: true,
      message: `有效礼品卡，将增加 ${formatCny(card.amountCents)} 自由额度。`
    };
  }

  if (!card.planId || !card.planName) {
    throw new GiftCardError('礼品卡套餐信息不完整。', 409);
  }

  if (account.currentPlanRank > card.planRank) {
    return {
      card,
      currentPlan,
      consequence: 'upgrade',
      canUse: false,
      message: '当前套餐高于这张礼品卡对应的套餐，暂时无法使用。'
    };
  }

  const consequence: GiftCardConsequence = account.currentPlanRank === card.planRank ? 'extend' : 'upgrade';
  return {
    card,
    currentPlan,
    consequence,
    canUse: true,
    message:
      consequence === 'extend'
        ? '这张礼品卡与当前套餐同级，确认后将延长一个月。'
        : '确认使用后，当前更低级套餐会被覆盖且无法恢复。'
  };
}

function formatCny(cents: number) {
  return `¥${Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;
}

function addMonths(baseIso: string | null, months: number, extendFromExisting: boolean) {
  const now = new Date();
  const existing = baseIso ? new Date(baseIso) : null;
  const base = extendFromExisting && existing && existing.getTime() > now.getTime() ? existing : now;
  const next = new Date(base);
  next.setMonth(next.getMonth() + Math.max(1, months));
  return next.toISOString();
}

function upsertPlanFromGiftCard(card: GiftCard) {
  if (!card.planId || !card.planName) {
    throw new GiftCardError('礼品卡套餐信息不完整。', 409);
  }

  const catalogPlan = upgradePlanCatalog.find((plan) => plan.id === card.planId);
  const timestamp = nowIso();
  const payload = {
    id: card.planId,
    name: card.planName,
    description: catalogPlan?.description ?? '礼品卡套餐',
    fiveHourTokenLimit: card.fiveHourTokenLimit,
    weeklyTokenLimit: card.weeklyTokenLimit,
    priceCents: catalogPlan?.priceCents ?? 0,
    currency: catalogPlan?.currency ?? 'CNY',
    updatedAt: timestamp,
    createdAt: timestamp
  };
  const existing = db.prepare('SELECT id FROM plans WHERE id = ?').get(card.planId);

  if (existing) {
    db.prepare(
      `
      UPDATE plans
      SET name = @name,
          description = @description,
          five_hour_token_limit = @fiveHourTokenLimit,
          weekly_token_limit = @weeklyTokenLimit,
          price_cents = @priceCents,
          currency = @currency,
          is_active = 1,
          updated_at = @updatedAt
      WHERE id = @id
    `
    ).run(payload);
    return;
  }

  db.prepare(
    `
    INSERT INTO plans (
      id,
      name,
      description,
      five_hour_token_limit,
      weekly_token_limit,
      price_cents,
      currency,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @name,
      @description,
      @fiveHourTokenLimit,
      @weeklyTokenLimit,
      @priceCents,
      @currency,
      1,
      @createdAt,
      @updatedAt
    )
  `
  ).run(payload);
}

export function previewGiftCard(userId: string, code: string) {
  const preview = buildGiftCardPreview(userId, requireUsableGiftCard(code));
  return {
    ...preview,
    requiresConfirmation: preview.card.type === 'plan' && preview.canUse,
    redeemed: false
  };
}

export function redeemGiftCard(userId: string, input: { code: string; confirm?: boolean }) {
  return db.transaction(() => {
    const card = requireUsableGiftCard(input.code);
    const preview = buildGiftCardPreview(userId, card);

    if (!preview.canUse) {
      throw new GiftCardError(preview.message, 409);
    }

    if (card.type === 'plan' && !input.confirm) {
      return {
        ...preview,
        requiresConfirmation: true,
        redeemed: false
      };
    }

    const timestamp = nowIso();
    if (card.type === 'credit') {
      db.prepare(
        `
        UPDATE account_state
        SET free_credit_cents = free_credit_cents + @amountCents,
            updated_at = @updatedAt
        WHERE id = @userId
      `
      ).run({
        userId,
        amountCents: card.amountCents,
        updatedAt: timestamp
      });
      db.prepare('UPDATE gift_cards SET redeemed_at = ?, redeemed_by_user_id = ? WHERE code = ?').run(
        timestamp,
        userId,
        card.code
      );

      return {
        ...preview,
        message: `已增加 ${formatCny(card.amountCents)} 自由额度。`,
        requiresConfirmation: false,
        redeemed: true
      };
    }

    upsertPlanFromGiftCard(card);
    const nextExpiry = addMonths(preview.currentPlan.planExpiresAt, card.durationMonths, preview.consequence === 'extend');
    if (preview.consequence === 'upgrade') {
      db.prepare("UPDATE api_keys SET plan_id = ? WHERE user_id = ? AND status != 'revoked'").run(card.planId, userId);
    }
    db.prepare(
      `
      UPDATE account_state
      SET current_plan_id = @planId,
          current_plan_name = @planName,
          current_plan_rank = @planRank,
          plan_expires_at = @planExpiresAt,
          updated_at = @updatedAt
      WHERE id = @userId
    `
    ).run({
      userId,
      planId: card.planId,
      planName: card.planName,
      planRank: card.planRank,
      planExpiresAt: nextExpiry,
      updatedAt: timestamp
    });
    db.prepare('UPDATE gift_cards SET redeemed_at = ?, redeemed_by_user_id = ? WHERE code = ?').run(
      timestamp,
      userId,
      card.code
    );

    return {
      ...preview,
      currentPlan: {
        currentPlanId: card.planId,
        currentPlanName: card.planName,
        currentPlanRank: card.planRank,
        planExpiresAt: nextExpiry
      },
      message: preview.consequence === 'extend' ? '套餐已延长一个月。' : '套餐已立即生效。',
      requiresConfirmation: false,
      redeemed: true
    };
  })();
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

function normalizeUpstreamUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function normalizeOptionalUpstreamUrl(value: string) {
  return normalizeUpstreamUrl(value);
}

function normalizeUpstreamStatus(value: unknown): UpstreamChannelGroup['status'] {
  if (value === 'banned') return 'banned';
  return value === 'paused' ? 'paused' : 'active';
}

function normalizeUpstreamKeyStatus(value: unknown): UpstreamChannelKey['status'] {
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

function extractResetTime(payload: unknown): string | null {
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

function normalizeUpstreamKeyAgent(value: unknown): UpstreamKeyAgentType {
  if (value === 'claude-code' || value === 'codex') return value;
  return 'shared';
}

function upstreamRate(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function normalizeModelRateInput(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 10000) / 10000 : fallback;
}

function recoveryMinutes(value: unknown, fallback = 10) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(300, Math.max(5, numeric));
}

function usageMultiplier(value: unknown, fallback = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.round(numeric * 100) / 100);
}

function normalizeUpstreamKeyExpiry(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) {
    throw new Error('到期时间格式无效。');
  }
  return new Date(timestamp).toISOString();
}

function clearExpiredUpstreamDegradations() {
  const timestamp = nowIso();
  db.prepare(
    `
    UPDATE upstream_channel_groups
    SET degraded_until = NULL,
        degraded_reason = NULL,
        degraded_status_code = NULL,
        updated_at = @updatedAt
    WHERE degraded_until IS NOT NULL AND degraded_until <= @now
  `
  ).run({ now: timestamp, updatedAt: timestamp });

  db.prepare(
    `
    UPDATE upstream_channel_keys
    SET exhausted_until = NULL,
        failure_reason = NULL,
        failure_status_code = NULL,
        updated_at = @updatedAt
    WHERE exhausted_until IS NOT NULL AND exhausted_until <= @now
  `
  ).run({ now: timestamp, updatedAt: timestamp });
}

function publicUpstreamKey(key: UpstreamChannelKey) {
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

function keysForGroup(groupId: string) {
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

function modelRatesForGroup(groupId: string) {
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

function buildUpstreamGroupListItem(row: any): UpstreamChannelGroupListItem {
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

function normalizeChannelPriority(value: unknown, fallback = 100) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    if (Number.isInteger(fallback) && Number(fallback) > 0) return Number(fallback);
    throw new Error('渠道优先级必须是大于 0 的正整数。');
  }
  return numeric;
}

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
  return listUpstreamSelections(agent).length > 0;
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

  if (!next.websiteUrl) {
    throw new Error('官网地址不能为空。');
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

  return clone();
}

export function addUpstreamChannelKey(groupId: string, input: UpstreamChannelKeyInput) {
  const group = getUpstreamChannel(groupId);
  if (!group) return null;

  const rawKey = input.key.trim();
  if (!rawKey) {
    throw new Error('API Key 不能为空。');
  }

  const timestamp = nowIso();
  const keyHash = hashKey(rawKey);
  const existing = db.prepare('SELECT id FROM upstream_channel_keys WHERE channel_group_id = ? AND key_hash = ?').get(groupId, keyHash);
  if (existing) {
    throw new Error('该渠道内已存在这个上游 API Key。');
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
      'active',
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
  ).run({
    id: makeId(),
    channelGroupId: groupId,
    name: input.name?.trim() || '',
    agentType: normalizeUpstreamKeyAgent(input.agentType),
    keyHash,
    keyPreview: previewKey(rawKey),
    keyCiphertext: encryptKey(rawKey),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 100,
    expiresAt: normalizeUpstreamKeyExpiry(input.expiresAt),
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return getUpstreamChannel(groupId)!;
}

export function updateUpstreamChannelKey(
  groupId: string,
  keyId: string,
  input: Partial<{
    key: string;
    name: string;
    agentType: UpstreamKeyAgentType;
    status: UpstreamChannelKey['status'];
    sortOrder: number;
    expiresAt: string | null;
  }>
) {
  const row = db
    .prepare('SELECT * FROM upstream_channel_keys WHERE id = ? AND channel_group_id = ?')
    .get(keyId, groupId) as any;
  if (!row) return null;

  const current = mapUpstreamChannelKey(row) as UpstreamChannelKey;
  const keyUpdate = input.key?.trim();
  const next = {
    ...current,
    name: input.name === undefined ? current.name : input.name.trim(),
    agentType: input.agentType ? normalizeUpstreamKeyAgent(input.agentType) : current.agentType,
    status: input.status ? normalizeUpstreamKeyStatus(input.status) : current.status,
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : current.sortOrder,
    expiresAt: 'expiresAt' in input ? normalizeUpstreamKeyExpiry(input.expiresAt) : current.expiresAt,
    keyHash: current.keyHash,
    keyPreview: current.keyPreview,
    keyCiphertext: current.keyCiphertext,
    updatedAt: nowIso()
  };

  if (keyUpdate) {
    const nextHash = hashKey(keyUpdate);
    const existing = db
      .prepare('SELECT id FROM upstream_channel_keys WHERE channel_group_id = ? AND key_hash = ? AND id != ?')
      .get(groupId, nextHash, keyId);
    if (existing) {
      throw new Error('该渠道内已存在这个上游 API Key。');
    }
    next.keyHash = nextHash;
    next.keyPreview = previewKey(keyUpdate);
    next.keyCiphertext = encryptKey(keyUpdate);
  }

  db.prepare(
    `
    UPDATE upstream_channel_keys
    SET name = @name,
        agent_type = @agentType,
        key_hash = @keyHash,
        key_preview = @keyPreview,
        key_ciphertext = @keyCiphertext,
        status = @status,
        sort_order = @sortOrder,
        expires_at = @expiresAt,
        exhausted_until = CASE WHEN @status = 'active' THEN NULL ELSE exhausted_until END,
        failure_reason = CASE WHEN @status = 'active' THEN NULL ELSE failure_reason END,
        failure_status_code = CASE WHEN @status = 'active' THEN NULL ELSE failure_status_code END,
        updated_at = @updatedAt
    WHERE id = @id AND channel_group_id = @channelGroupId
  `
  ).run({
    id: keyId,
    channelGroupId: groupId,
    name: next.name,
    agentType: next.agentType,
    keyHash: next.keyHash,
    keyPreview: next.keyPreview,
    keyCiphertext: next.keyCiphertext,
    status: next.status,
    sortOrder: next.sortOrder,
    expiresAt: next.expiresAt,
    updatedAt: next.updatedAt
  });

  return getUpstreamChannel(groupId)!;
}

export function deleteUpstreamChannelKey(groupId: string, keyId: string) {
  const row = db
    .prepare('SELECT * FROM upstream_channel_keys WHERE id = ? AND channel_group_id = ?')
    .get(keyId, groupId) as any;
  if (!row) return null;
  const key = publicUpstreamKey(mapUpstreamChannelKey(row) as UpstreamChannelKey);
  db.prepare('DELETE FROM upstream_channel_keys WHERE id = ? AND channel_group_id = ?').run(keyId, groupId);
  return key;
}

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

function keyPoolAgent(group: UpstreamChannelGroup, agent: AgentType): UpstreamKeyAgentType {
  return group.useIndependentAgentKeys ? agent : 'shared';
}

export function listUpstreamSelections(agent: AgentType): UpstreamSelection[] {
  clearExpiredUpstreamDegradations();
  const groups = (db
    .prepare(
      `
      SELECT *
      FROM upstream_channel_groups
      WHERE status = 'active'
      ORDER BY
        CASE WHEN degraded_until IS NOT NULL THEN 1 ELSE 0 END ASC,
        sort_order ASC,
        created_at ASC
    `
    )
    .all() as any[]).map((row) => mapUpstreamChannel(row) as UpstreamChannelGroup);

  const selections: UpstreamSelection[] = [];
  for (const group of groups) {
    const apiUrl = agent === 'codex' ? group.codexApiUrl : group.claudeApiUrl;
    if (!apiUrl) continue;

    const keyAgent = keyPoolAgent(group, agent);
    const keys = (db
      .prepare(
        `
        SELECT *
        FROM upstream_channel_keys
        WHERE channel_group_id = @groupId
          AND agent_type = @agentType
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > @now)
        ORDER BY
          CASE WHEN exhausted_until IS NOT NULL THEN 1 ELSE 0 END ASC,
          sort_order ASC,
          created_at ASC
      `
      )
      .all({ groupId: group.id, agentType: keyAgent, now: nowIso() }) as any[]).map((row) => mapUpstreamChannelKey(row) as UpstreamChannelKey);

    for (const key of keys) {
      const rawKey = decryptKey(key.keyCiphertext);
      if (!rawKey) continue;
      selections.push({
        group,
        key,
        rawKey,
        agent,
        apiUrl
      });
    }
  }

  return selections;
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
}

export { extractResetTime };

export function touchUpstreamKey(id: string) {
  const now = Date.now();
  const lastTouchedAt = upstreamKeyTouchedAt.get(id) || 0;
  if (now - lastTouchedAt < lastUsedTouchIntervalMs) return;
  upstreamKeyTouchedAt.set(id, now);
  db.prepare('UPDATE upstream_channel_keys SET last_used_at = ?, updated_at = ? WHERE id = ?').run(nowIso(), nowIso(), id);
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

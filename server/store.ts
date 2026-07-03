import crypto from 'node:crypto';
import { customAlphabet } from 'nanoid';
import { db, mapKey, mapLog, mapPlan, nowIso } from './db.js';
import { createApiKey, decryptKey, encryptKey, hashKey, previewKey } from './crypto.js';
import { usageCostCents } from './pricing.js';
import type {
  ApiKeyRecord,
  GiftCard,
  GiftCardConsequence,
  KeyListItem,
  KeyWithPlan,
  Plan,
  QuotaSnapshot,
  User,
  UserRole,
  UsageLog
} from './types.js';

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
  userId?: string;
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

type UserSession = {
  user: User;
  token: string;
  expiresAt: string;
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
    fiveHourTokenLimit: 1000,
    weeklyTokenLimit: 6700,
    priceCents: 500,
    currency: 'CNY',
    rank: 1
  },
  {
    id: 'pro-plus',
    name: 'Pro+',
    description: '标准版',
    fiveHourTokenLimit: 2000,
    weeklyTokenLimit: 13200,
    priceCents: 1000,
    currency: 'CNY',
    rank: 2
  },
  {
    id: 'max',
    name: 'Max',
    description: '专业版',
    fiveHourTokenLimit: 4000,
    weeklyTokenLimit: 26400,
    priceCents: 2000,
    currency: 'CNY',
    rank: 3
  },
  {
    id: 'ultra',
    name: 'Ultra',
    description: '高级版',
    fiveHourTokenLimit: 20000,
    weeklyTokenLimit: 132000,
    priceCents: 10000,
    currency: 'CNY',
    rank: 4
  },
  {
    id: 'power',
    name: 'Power',
    description: '旗舰版 · 团队与高强度工作量',
    fiveHourTokenLimit: 40000,
    weeklyTokenLimit: 264000,
    priceCents: 20000,
    currency: 'CNY',
    rank: 5
  }
];

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

export function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number };
  if (count.count > 0) {
    ensureFreePlan();
    normalizeLegacyPlanLimits();
    backfillUsageLogCosts();
    ensureDefaultUser();
    seedDemoGiftCards();
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
    redeemedByUserId: row.redeemed_by_user_id ?? null,
    createdAt: row.created_at
  };
}

function planRank(planId: string | null | undefined) {
  if (!planId) return 0;
  return upgradePlanCatalog.find((plan) => plan.id === planId)?.rank ?? 0;
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

  return card;
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
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(nowIso(), id);
}

export function getQuotaSnapshot(apiKeyId: string): QuotaSnapshot {
  const keyOwner = db.prepare('SELECT user_id FROM api_keys WHERE id = ?').get(apiKeyId) as { user_id: string | null } | undefined;
  if (keyOwner?.user_id) {
    ensureAccountState(keyOwner.user_id);
  }

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

export function getAccountState(userId: string) {
  return ensureAccountState(userId);
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
  const filters = ['usage_logs.created_at >= @since'];
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
  pruneUsageLogs();
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
        COALESCE(SUM(CASE WHEN created_at >= @fiveHourSince AND status_code BETWEEN 200 AND 299${userClause} THEN total_tokens ELSE 0 END), 0) as five_hour_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @weeklySince AND status_code BETWEEN 200 AND 299${userClause} THEN total_tokens ELSE 0 END), 0) as weekly_tokens,
        COALESCE(SUM(CASE WHEN created_at >= @fiveHourSince AND status_code BETWEEN 200 AND 299${userClause} THEN total_cost_cents ELSE 0 END), 0) as five_hour_cost_cents,
        COALESCE(SUM(CASE WHEN created_at >= @weeklySince AND status_code BETWEEN 200 AND 299${userClause} THEN total_cost_cents ELSE 0 END), 0) as weekly_cost_cents,
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

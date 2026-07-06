import { db, nowIso } from '../../db.js';
import { ensureAccountState, type AccountState } from '../accounts.js';
import { upgradePlanCatalog } from '../catalog.js';
import type { GiftCard, GiftCardConsequence } from '../../types.js';
import { GiftCardError, getGiftCard, requireUsableGiftCard } from './shared.js';

type GiftCardPreview = {
  card: GiftCard;
  currentPlan: Pick<AccountState, 'currentPlanId' | 'currentPlanName' | 'currentPlanRank' | 'planExpiresAt'>;
  consequence: GiftCardConsequence;
  canUse: boolean;
  message: string;
};

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

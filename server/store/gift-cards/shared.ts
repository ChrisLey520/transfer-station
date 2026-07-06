import { db } from '../../db.js';
import type { GiftCard } from '../../types.js';

export function mapGiftCard(row: any): GiftCard {
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

export class GiftCardError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
  }
}

export function normalizeGiftCardCode(code: string) {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

export function getGiftCard(code: string): GiftCard | null {
  const row = db.prepare('SELECT * FROM gift_cards WHERE code = ?').get(normalizeGiftCardCode(code));
  return row ? mapGiftCard(row) : null;
}

export function requireUsableGiftCard(code: string) {
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

import { db } from '../../db.js';
import type { GiftCard } from '../../types.js';
import { mapGiftCard } from './shared.js';

type GiftCardListInput = {
  type?: GiftCard['type'];
  page?: number;
  pageSize?: number;
};

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

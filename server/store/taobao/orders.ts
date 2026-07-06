import { db, mapPlatformOrder, nowIso } from '../../db.js';
import { buildGiftCardPayload, GiftCardError, insertGiftCardsFromPayload } from '../gift-cards.js';
import type { GiftCard, PlatformOrder, PurchaseChannelId } from '../../types.js';
import { giftCardInputFromTaobaoMapping, findTaobaoProductMapping } from './mappings.js';
import { makeId, normalizeTaobaoId, type TaobaoOrderLineInput } from './shared.js';

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

import { db, mapTaobaoProductMapping, nowIso } from '../../db.js';
import { getPlan } from '../plans.js';
import { GiftCardError, type CreateGiftCardsInput } from '../gift-cards.js';
import type { TaobaoProductMapping } from '../../types.js';
import { makeId, normalizeTaobaoId, type TaobaoProductMappingInput } from './shared.js';

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

export function findTaobaoProductMapping(itemId: string, skuId?: string | null): TaobaoProductMapping | null {
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

export function giftCardInputFromTaobaoMapping(mapping: TaobaoProductMapping): CreateGiftCardsInput {
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

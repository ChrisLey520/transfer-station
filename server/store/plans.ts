import { customAlphabet } from 'nanoid';
import { db, mapPlan, mapProductLink, nowIso } from '../db.js';
import type { Plan, ProductItemType, ProductLink, PurchaseChannelId } from '../types.js';
import { creditProductCatalog, defaultFreePlan, defaultProductUrls, upgradePlanCatalog } from './catalog.js';

const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

type ProductLinkInput = {
  itemType: ProductItemType;
  itemId: string;
  channel: PurchaseChannelId;
  url: string;
};

function defaultProductItems() {
  return [
    ...upgradePlanCatalog.map((plan) => ({ itemType: 'plan' as const, itemId: plan.id })),
    ...creditProductCatalog.map((credit) => ({ itemType: 'credit' as const, itemId: credit.id }))
  ];
}

export function seedDefaultProductLinks() {
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

export function ensureFreePlan() {
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

export function syncUpgradePlanCatalog() {
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

export function normalizeLegacyPlanLimits() {
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

export function planRank(planId: string | null | undefined) {
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

import { db, nowIso } from '../../db.js';
import { upgradePlanCatalog } from '../catalog.js';

export function seedDemoGiftCards() {
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

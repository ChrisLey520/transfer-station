import { customAlphabet } from 'nanoid';
import { db, nowIso } from '../../db.js';
import { defaultFreePlan } from '../catalog.js';
import { getPlan, planRank } from '../plans.js';
import type { GiftCard } from '../../types.js';
import { GiftCardError } from './shared.js';

const makeGiftCodeSegment = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export type CreateGiftCardsInput =
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

export function buildGiftCardPayload(input: CreateGiftCardsInput) {
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

export function insertGiftCardsFromPayload(payload: ReturnType<typeof buildGiftCardPayload>, quantity: number, timestamp = nowIso()) {
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

import { db, nowIso } from '../db.js';

export type AccountState = {
  freeCreditCents: number;
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentPlanRank: number;
  planExpiresAt: string | null;
  fiveHourCycleStartAt: string | null;
  weeklyCycleStartAt: string | null;
};

export function ensureAccountState(userId: string): AccountState {
  const existing = db.prepare('SELECT * FROM account_state WHERE id = ?').get(userId) as any;
  if (existing) {
    const state = {
      freeCreditCents: existing.free_credit_cents,
      currentPlanId: existing.current_plan_id,
      currentPlanName: existing.current_plan_name,
      currentPlanRank: existing.current_plan_rank,
      planExpiresAt: existing.plan_expires_at,
      fiveHourCycleStartAt: existing.five_hour_cycle_start_at ?? null,
      weeklyCycleStartAt: existing.weekly_cycle_start_at ?? null
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
    planExpiresAt: null,
    fiveHourCycleStartAt: null,
    weeklyCycleStartAt: null
  };
}

export function setAccountQuotaCycleStart(
  userId: string,
  input: Partial<{ fiveHourCycleStartAt: string | null; weeklyCycleStartAt: string | null }>
) {
  const assignments: string[] = [];
  const params: Record<string, string | null> = { id: userId, updatedAt: nowIso() };
  if ('fiveHourCycleStartAt' in input) {
    assignments.push('five_hour_cycle_start_at = @fiveHourCycleStartAt');
    params.fiveHourCycleStartAt = input.fiveHourCycleStartAt ?? null;
  }
  if ('weeklyCycleStartAt' in input) {
    assignments.push('weekly_cycle_start_at = @weeklyCycleStartAt');
    params.weeklyCycleStartAt = input.weeklyCycleStartAt ?? null;
  }
  if (!assignments.length) return;

  db.prepare(
    `
    UPDATE account_state
    SET ${assignments.join(', ')},
        updated_at = @updatedAt
    WHERE id = @id
  `
  ).run(params);
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

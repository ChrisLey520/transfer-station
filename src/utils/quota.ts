import { Bootstrap, Plan, QuotaSnapshot } from '../types.js';

export function buildAccountQuota(data: Bootstrap, plan?: Plan, fallback?: QuotaSnapshot): QuotaSnapshot | null {
  if (!plan) return fallback || null;
  const fiveHourUsed = Math.max(0, Number(data.summary.fiveHourCostCents ?? fallback?.fiveHourUsed ?? 0));
  const weeklyUsed = Math.max(0, Number(data.summary.weeklyCostCents ?? fallback?.weeklyUsed ?? 0));
  const fiveHourLimit = Math.max(0, Number(plan.fiveHourTokenLimit ?? fallback?.fiveHourLimit ?? 0));
  const weeklyLimit = Math.max(0, Number(plan.weeklyTokenLimit ?? fallback?.weeklyLimit ?? 0));
  const balanceCents = Math.max(0, Number(data.summary.accountBalanceCents ?? fallback?.balanceCents ?? 0));
  const remainingFiveHour = Math.max(0, fiveHourLimit - fiveHourUsed);
  const remainingWeekly = Math.max(0, weeklyLimit - weeklyUsed);
  const quotaSource = remainingFiveHour > 0 && remainingWeekly > 0 ? 'plan' : balanceCents > 0 ? 'balance' : 'none';

  return {
    fiveHourUsed,
    fiveHourLimit,
    weeklyUsed,
    weeklyLimit,
    remainingFiveHour,
    remainingWeekly,
    balanceCents,
    quotaSource,
    fiveHourResetAt: data.summary.fiveHourResetAt || fallback?.fiveHourResetAt || '',
    weeklyResetAt: data.summary.weeklyResetAt || fallback?.weeklyResetAt || ''
  };
}

export function emptyQuota(): QuotaSnapshot {
  return {
    fiveHourUsed: 0,
    fiveHourLimit: 0,
    weeklyUsed: 0,
    weeklyLimit: 0,
    remainingFiveHour: 0,
    remainingWeekly: 0,
    balanceCents: 0,
    quotaSource: 'none',
    fiveHourResetAt: '',
    weeklyResetAt: ''
  };
}

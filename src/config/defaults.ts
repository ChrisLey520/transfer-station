import { AccountState, Bootstrap, Summary, UserProfile } from '../types.js';

export const defaultSummary: Summary = {
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
  totalCostCents: 0,
  requests: 0,
  fiveHourTokens: 0,
  weeklyTokens: 0,
  fiveHourCostCents: 0,
  weeklyCostCents: 0,
  fiveHourResetAt: '',
  weeklyResetAt: '',
  todayTokens: 0,
  todayCostCents: 0,
  todayRequests: 0,
  todayInputTokens: 0,
  todayCacheCreationInputTokens: 0,
  todayCacheReadInputTokens: 0,
  accountBalanceCents: 0,
  errors: 0,
  activeKeys: 0,
  series: []
};

export const defaultAccount: AccountState = {
  freeCreditCents: 0,
  currentPlanId: 'free',
  currentPlanName: 'Free',
  currentPlanRank: 0,
  planExpiresAt: null
};

export const defaultUser: UserProfile = {
  id: '',
  email: '',
  role: 'member',
  status: 'active',
  remark: null,
  displayName: null,
  createdAt: '',
  updatedAt: ''
};

export const defaultBootstrap: Bootstrap = {
  user: defaultUser,
  account: defaultAccount,
  summary: defaultSummary,
  plans: [],
  productLinks: [],
  keys: [],
  announcement: null
};

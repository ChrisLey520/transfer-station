import type { AuthMode, ProductItemType, PurchaseChannelId } from './core.js';
import type { GiftCardCard, GiftCardFormType } from './giftCards.js';

export type Plan = {
  id: string;
  name: string;
  description: string;
  fiveHourTokenLimit: number;
  weeklyTokenLimit: number;
  priceCents: number;
  currency: string;
  isActive: number;
};

export type ProductLink = {
  itemType: ProductItemType;
  itemId: string;
  channel: PurchaseChannelId;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  id: string;
  email: string;
  role: 'admin' | 'member';
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountState = {
  freeCreditCents: number;
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentPlanRank: number;
  planExpiresAt: string | null;
};

export type QuotaSnapshot = {
  fiveHourUsed: number;
  fiveHourLimit: number;
  weeklyUsed: number;
  weeklyLimit: number;
  remainingFiveHour: number;
  remainingWeekly: number;
  balanceCents: number;
  quotaSource: 'plan' | 'balance' | 'none';
  fiveHourResetAt: string;
  weeklyResetAt: string;
};

export type ApiKey = {
  id: string;
  name: string;
  keyPreview: string;
  userId: string | null;
  planId: string;
  planName: string;
  status: 'active' | 'paused' | 'revoked';
  ownerEmail: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  usage: QuotaSnapshot;
  todayUsageCents: number;
};

export type KeySecret = {
  key: string;
  keyPreview: string;
  ccSwitch: {
    codex: string;
    claude: string;
  };
};

export type UsageLog = {
  id: string;
  apiKeyId: string | null;
  channelGroupId: string | null;
  channelNumber: number | null;
  usageSource: 'plan' | 'balance' | 'none';
  model: string;
  path: string;
  method: string;
  statusCode: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  totalTokens: number;
  inputCostCents: number;
  outputCostCents: number;
  cacheCreationCostCents: number;
  cacheReadCostCents: number;
  totalCostCents: number;
  latencyMs: number;
  errorMessage: string | null;
  requestId: string;
  createdAt: string;
};

export type Announcement = {
  id: string;
  content: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  shouldShow: boolean;
  dismissedForToday: boolean;
  dismissedPermanently: boolean;
};

export type LogRange = '24h' | '3d' | '7d' | '30d';

export type LogStatus = 'all' | 'success' | 'failed';

export type Summary = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  totalCostCents: number;
  requests: number;
  fiveHourTokens: number;
  weeklyTokens: number;
  fiveHourCostCents: number;
  weeklyCostCents: number;
  todayTokens: number;
  todayCostCents: number;
  todayRequests: number;
  todayInputTokens: number;
  todayCacheCreationInputTokens: number;
  todayCacheReadInputTokens: number;
  accountBalanceCents: number;
  errors: number;
  activeKeys: number;
  series: Array<{ bucket: string; tokens: number; requests: number }>;
};

export type Bootstrap = {
  user: UserProfile;
  account: AccountState;
  summary: Summary;
  plans: Plan[];
  productLinks: ProductLink[];
  keys: ApiKey[];
  announcement: Announcement | null;
};

export type AuthSession = {
  user: UserProfile;
  token: string;
  expiresAt: string;
};

export type SliderChallenge = {
  challengeId: string;
  purpose: AuthMode;
  backgroundImage: string;
  pieceImage: string;
  imageWidth: number;
  imageHeight: number;
  pieceTopPct: number;
  pieceWidthPct: number;
  pieceHeightPct: number;
  expiresAt: string;
};

export type LogPage = {
  logs: UsageLog[];
  total: number;
  page: number;
  pageSize: number;
};

export type ClaimedOrder = {
  id?: string;
  orderId: string;
  subOrderId: string;
  platform: PurchaseChannelId;
  title: string;
  giftCardType?: 'credit' | 'plan' | null;
  giftCardCode: string | null;
  deliveryStatus: 'pending' | 'ready' | 'claimed' | 'skipped' | 'failed';
  claimedAt: string | null;
  updatedAt: string;
};

export type Paginated<T> = {
  total: number;
  page: number;
  pageSize: number;
} & T;

export type UserListItem = UserProfile & {
  currentPlanId: string | null;
  currentPlanName: string | null;
  freeCreditCents: number;
  planExpiresAt: string | null;
};

export type UserListPage = Paginated<{ users: UserListItem[] }> & {
  sortField: 'freeCreditCents' | 'createdAt';
  sortOrder: 'asc' | 'desc';
};

export type GiftCardRedemptionPage = Paginated<{ giftCards: GiftCardCard[] }> & {
  days: number;
};

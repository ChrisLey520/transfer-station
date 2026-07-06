import { currency } from './utils/format.js';
import React from 'react';

export type Language = 'zh-CN' | 'zh-TW' | 'en';

export type AuthMode = 'login' | 'register';

export type Tab = 'dashboard' | 'keys' | 'usage' | 'plans' | 'orders' | 'logs' | 'gift-cards' | 'products' | 'channels' | 'announcements' | 'users' | 'user-detail' | 'guide';

export type PlanView = 'billing' | 'change';

export type PurchaseChannelId = 'taobao' | 'xianyu';

export type ProductItemType = 'plan' | 'credit';

export type GuideAgentId = 'claude-code' | 'codex';

export type UpstreamKeyAgentType = 'shared' | GuideAgentId;

export type GuideOsId = 'windows' | 'macos' | 'linux' | 'macos-linux';

export type ThemeMode = 'system' | 'light' | 'dark';

export type AccentTheme = 'sun-gold' | 'rose-pink' | 'pine-green' | 'violet' | 'bay-blue';

export type NavMenuItem = {
  id: Tab;
  label: string;
  icon: React.ElementType<{ size?: number }>;
};

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

export type UpstreamChannelKey = {
  id: string;
  channelGroupId: string;
  name: string;
  agentType: UpstreamKeyAgentType;
  keyPreview: string;
  status: 'active' | 'paused' | 'revoked' | 'banned';
  sortOrder: number;
  expiresAt: string | null;
  exhaustedUntil: string | null;
  failureReason: string | null;
  failureStatusCode: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpstreamModelRate = {
  id: string;
  channelGroupId: string;
  agentType: GuideAgentId;
  model: string;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  cacheCreationRatePerMillion: number;
  cacheReadRatePerMillion: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type UpstreamChannel = {
  id: string;
  channelNumber: number;
  name: string;
  websiteUrl: string;
  status: 'active' | 'paused' | 'banned';
  claudeApiUrl: string;
  codexApiUrl: string;
  useIndependentAgentKeys: boolean;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  cacheCreationRatePerMillion: number;
  cacheReadRatePerMillion: number;
  serverErrorRecoveryMinutes: number;
  displayUsageMultiplier: number;
  sortOrder: number;
  degradedUntil: string | null;
  degradedReason: string | null;
  degradedStatusCode: number | null;
  keys: UpstreamChannelKey[];
  modelRates: UpstreamModelRate[];
  keyCounts: Record<UpstreamKeyAgentType, number>;
  createdAt: string;
  updatedAt: string;
};

export type UpstreamChannelAgentTab = GuideAgentId;

export type MarkdownHeadingLevel = 1 | 2 | 3 | 4;

export type MarkdownBlock =
  | { type: 'heading'; level: MarkdownHeadingLevel; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'quote'; text: string }
  | { type: 'divider' };

export type MarkdownTocItem = {
  id: string;
  level: MarkdownHeadingLevel;
  text: string;
};

export type UpgradePlan = {
  id: string;
  name: string;
  subtitle: string;
  monthlyPriceYuan: number;
  fiveHourCreditUsd: number;
  weeklyCreditUsd: number;
  features: string[];
  recommended?: boolean;
};

export type PurchaseChannel = {
  id: PurchaseChannelId;
  iconSrc: string;
  labelKey: 'taobao' | 'xianyu';
};

export type CreditProduct = {
  id: string;
  amountUsd: number;
  priceCents: number;
};

export type PurchaseProductOption = {
  itemType: ProductItemType;
  itemId: string;
  name: string;
  priceLabel: string;
  description?: string;
};

export type PlanProductOption = PurchaseProductOption & {
  itemType: 'plan';
  plan: UpgradePlan;
};

export type PurchaseMode = ProductItemType;

export type GiftCardCard = {
  code: string;
  type: 'credit' | 'plan';
  amountCents: number;
  planId: string | null;
  planName: string | null;
  fiveHourTokenLimit: number;
  weeklyTokenLimit: number;
  planRank: number;
  durationMonths: number;
  redeemedAt: string | null;
  revokedAt: string | null;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  redeemedByUserId?: string | null;
  redeemedByEmail?: string | null;
  revokedByUserId?: string | null;
  revokedByEmail?: string | null;
  createdAt?: string;
};

export type AdminGiftCard = Required<Pick<GiftCardCard, 'code' | 'type' | 'amountCents' | 'planId' | 'planName' | 'fiveHourTokenLimit' | 'weeklyTokenLimit' | 'planRank' | 'durationMonths' | 'redeemedAt' | 'revokedAt'>> & {
  createdByUserId: string | null;
  createdByEmail: string | null;
  redeemedByUserId: string | null;
  redeemedByEmail: string | null;
  revokedByUserId: string | null;
  revokedByEmail: string | null;
  createdAt: string;
};

export type GiftCardPage = {
  giftCards: AdminGiftCard[];
  total: number;
  typeCounts: Record<GiftCardFormType, number>;
  page: number;
  pageSize: number;
};

export type TaobaoProductMapping = {
  id: string;
  numIid: string;
  skuId: string | null;
  title: string;
  giftType: 'credit' | 'plan';
  amountCents: number;
  planId: string | null;
  durationMonths: number;
  quantity: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

export type TaobaoShop = {
  id: string;
  nick: string;
  sessionExpiresAt: string | null;
  messagePermittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformOrder = {
  id: string;
  platform: PurchaseChannelId;
  shopId: string | null;
  orderId: string;
  subOrderId: string;
  buyerNick: string;
  itemId: string;
  skuId: string | null;
  title: string;
  status: string;
  giftCardCode: string | null;
  deliveryStatus: 'pending' | 'ready' | 'claimed' | 'skipped' | 'failed';
  deliveryMessage: string | null;
  claimedAt: string | null;
  claimedByUserId: string | null;
  lastEventAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GiftCardCurrentPlan = {
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentPlanRank: number;
  planExpiresAt: string | null;
};

export type GiftCardPreview = {
  card: GiftCardCard;
  currentPlan: GiftCardCurrentPlan;
  consequence: 'credit' | 'upgrade' | 'extend';
  canUse: boolean;
  message: string;
  requiresConfirmation: boolean;
  redeemed: boolean;
};

export type ToastVariant = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

export type ToastListener = (toast: ToastItem) => void;

export type GiftCardFormType = 'plan' | 'credit';

export type UpstreamKeyDeleteTarget = {
  channel: UpstreamChannel;
  key: UpstreamChannelKey;
};

export type UpstreamKeyEditTarget = {
  channel: UpstreamChannel;
  key: UpstreamChannelKey;
};

export type UpstreamModelRateTarget = {
  channel: UpstreamChannel;
  rate?: UpstreamModelRate;
};

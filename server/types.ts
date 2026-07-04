export type Language = 'zh-CN' | 'zh-TW' | 'en';

export type UserRole = 'admin' | 'member';
export type AgentType = 'claude-code' | 'codex';
export type UpstreamKeyAgentType = 'shared' | AgentType;
export type PurchaseChannelId = 'taobao' | 'xianyu';
export type ProductItemType = 'plan' | 'credit';

export type User = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
};

export type ProductLink = {
  itemType: ProductItemType;
  itemId: string;
  channel: PurchaseChannelId;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiKeyRecord = {
  id: string;
  name: string;
  keyHash: string;
  keyPreview: string;
  keyCiphertext: string | null;
  userId: string | null;
  planId: string;
  status: 'active' | 'paused' | 'revoked';
  ownerEmail: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type UsageLog = {
  id: string;
  apiKeyId: string | null;
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

export type UpstreamChannelGroup = {
  id: string;
  name: string;
  status: 'active' | 'paused';
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
  createdAt: string;
  updatedAt: string;
};

export type UpstreamChannelKey = {
  id: string;
  channelGroupId: string;
  name: string;
  agentType: UpstreamKeyAgentType;
  keyHash: string;
  keyPreview: string;
  keyCiphertext: string;
  status: 'active' | 'paused' | 'revoked';
  sortOrder: number;
  expiresAt: string | null;
  exhaustedUntil: string | null;
  failureReason: string | null;
  failureStatusCode: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpstreamChannelKeyListItem = Omit<UpstreamChannelKey, 'keyHash' | 'keyCiphertext'>;

export type UpstreamModelRate = {
  id: string;
  channelGroupId: string;
  agentType: AgentType;
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

export type UpstreamChannelGroupListItem = UpstreamChannelGroup & {
  keys: UpstreamChannelKeyListItem[];
  modelRates: UpstreamModelRate[];
  keyCounts: Record<UpstreamKeyAgentType, number>;
};

export type UpstreamSelection = {
  group: UpstreamChannelGroup;
  key: UpstreamChannelKey;
  rawKey: string;
  agent: AgentType;
  apiUrl: string;
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

export type KeyWithPlan = ApiKeyRecord & {
  planName: string;
  fiveHourTokenLimit: number;
  weeklyTokenLimit: number;
};

export type KeyListItem = Omit<ApiKeyRecord, 'keyHash' | 'keyCiphertext'> & {
  planName: string;
  usage: QuotaSnapshot;
  todayUsageCents: number;
};

export type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export type GiftCardType = 'credit' | 'plan';

export type GiftCard = {
  code: string;
  type: GiftCardType;
  amountCents: number;
  planId: string | null;
  planName: string | null;
  fiveHourTokenLimit: number;
  weeklyTokenLimit: number;
  planRank: number;
  durationMonths: number;
  redeemedAt: string | null;
  revokedAt: string | null;
  createdByUserId: string | null;
  createdByEmail?: string | null;
  redeemedByUserId: string | null;
  redeemedByEmail?: string | null;
  revokedByUserId: string | null;
  revokedByEmail?: string | null;
  createdAt: string;
};

export type GiftCardConsequence = 'credit' | 'upgrade' | 'extend';

export type TaobaoShop = {
  id: string;
  nick: string;
  sessionCiphertext: string;
  sessionExpiresAt: string | null;
  messagePermittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaobaoProductMapping = {
  id: string;
  numIid: string;
  skuId: string | null;
  title: string;
  giftType: GiftCardType;
  amountCents: number;
  planId: string | null;
  durationMonths: number;
  quantity: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformOrderDeliveryStatus = 'pending' | 'ready' | 'claimed' | 'skipped' | 'failed';

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
  deliveryStatus: PlatformOrderDeliveryStatus;
  deliveryMessage: string | null;
  claimedAt: string | null;
  claimedByUserId: string | null;
  lastEventAt: string | null;
  rawPayload: string | null;
  createdAt: string;
  updatedAt: string;
};

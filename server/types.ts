export type Language = 'zh-CN' | 'zh-TW' | 'en';

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

export type ApiKeyRecord = {
  id: string;
  name: string;
  keyHash: string;
  keyPreview: string;
  keyCiphertext: string | null;
  planId: string;
  status: 'active' | 'paused' | 'revoked';
  ownerEmail: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type UsageLog = {
  id: string;
  apiKeyId: string | null;
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

export type QuotaSnapshot = {
  fiveHourUsed: number;
  fiveHourLimit: number;
  weeklyUsed: number;
  weeklyLimit: number;
  remainingFiveHour: number;
  remainingWeekly: number;
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

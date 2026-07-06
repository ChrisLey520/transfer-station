import { createUsageLog } from '../store.js';
import type { AnthropicUsage, KeyWithPlan } from '../types.js';
import type { UsageRates } from '../pricing.js';
import { normalizeUsage, withoutUsageCost } from '../usage.js';

export function writeProxyLog(input: {
  key: KeyWithPlan | null;
  channelGroupId?: string | null;
  channelNumber?: number | null;
  model: string;
  path: string;
  method: string;
  statusCode: number;
  startedAt: number;
  usage?: AnthropicUsage;
  usageSource?: 'plan' | 'balance' | 'none';
  rates?: UsageRates;
  usageMultiplier?: number;
  billable?: boolean;
  errorMessage?: string | null;
  requestId: string;
}) {
  const normalizedUsage = normalizeUsage(input.usage, input.rates, input.usageMultiplier);
  const billable =
    input.billable ?? (input.statusCode >= 200 && input.statusCode <= 299 && !input.errorMessage);
  const usage = billable ? normalizedUsage : withoutUsageCost(normalizedUsage);
  createUsageLog({
    apiKeyId: input.key?.id ?? null,
    channelGroupId: input.channelGroupId ?? null,
    channelNumber: input.channelNumber ?? null,
    usageSource: input.usageSource || 'plan',
    model: input.model || 'unknown',
    path: input.path,
    method: input.method,
    statusCode: input.statusCode,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
    totalTokens: usage.totalTokens,
    inputCostCents: usage.inputCostCents,
    outputCostCents: usage.outputCostCents,
    cacheCreationCostCents: usage.cacheCreationCostCents,
    cacheReadCostCents: usage.cacheReadCostCents,
    totalCostCents: usage.totalCostCents,
    latencyMs: Date.now() - input.startedAt,
    errorMessage: input.errorMessage ?? null,
    requestId: input.requestId
  });
}

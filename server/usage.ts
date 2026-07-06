import type { AnthropicUsage } from './types.js';
import { usageCostCents, type UsageRates } from './pricing.js';

export function parseJsonText(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export function getTokenUsage(payload: unknown, rates: UsageRates = {}, usageMultiplier = 1) {
  const usage = payload && typeof payload === 'object' && 'usage' in payload ? (payload as any).usage : undefined;
  return normalizeUsage(usage, rates, usageMultiplier);
}

export function usageFromStreamingEvent(event: unknown): AnthropicUsage | undefined {
  if (!event || typeof event !== 'object') return undefined;
  const record = event as Record<string, any>;
  return record.usage || record.message?.usage || record.response?.usage;
}

export function mergeStreamingUsage(current: AnthropicUsage, event: unknown) {
  const usage = usageFromStreamingEvent(event);
  if (!usage) return current;
  return { ...current, ...usage };
}

function scaleTokenCount(value: number, multiplier = 1) {
  return Math.max(0, Math.round(value * Math.max(1, multiplier || 1)));
}

export function normalizeUsage(usage: AnthropicUsage | undefined, rates: UsageRates = {}, usageMultiplier = 1) {
  const inputTokenDetails = (usage as any)?.input_tokens_details || (usage as any)?.prompt_tokens_details;
  const totalTokenValue = (usage as any)?.total_tokens ?? (usage as any)?.totalTokens;
  const inputTokens = scaleTokenCount(Number((usage as any)?.input_tokens ?? (usage as any)?.prompt_tokens ?? 0), usageMultiplier);
  const outputTokens = scaleTokenCount(Number((usage as any)?.output_tokens ?? (usage as any)?.completion_tokens ?? 0), usageMultiplier);
  const cacheCreationInputTokens = scaleTokenCount(
    Number((usage as any)?.cache_creation_input_tokens ?? inputTokenDetails?.cache_creation_input_tokens ?? 0),
    usageMultiplier
  );
  const cacheReadInputTokens = scaleTokenCount(
    Number((usage as any)?.cache_read_input_tokens ?? inputTokenDetails?.cache_read_input_tokens ?? inputTokenDetails?.cached_tokens ?? 0),
    usageMultiplier
  );
  const totalTokens =
    typeof totalTokenValue === 'number' && Number.isFinite(totalTokenValue)
      ? scaleTokenCount(totalTokenValue, usageMultiplier)
      : inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens;
  const costs = usageCostCents({
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens
  }, rates);

  return {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    totalTokens,
    ...costs
  };
}

type NormalizedUsage = ReturnType<typeof normalizeUsage>;

export function withoutUsageCost(usage: NormalizedUsage): NormalizedUsage {
  return {
    ...usage,
    inputCostCents: 0,
    outputCostCents: 0,
    cacheCreationCostCents: 0,
    cacheReadCostCents: 0,
    totalCostCents: 0
  };
}

function scaledTokenValue(value: unknown, multiplier: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  return Math.max(0, Math.round(value * multiplier));
}

function isUsageObjectKey(key: string) {
  return key === 'usage' || key.endsWith('_usage') || key.endsWith('Usage');
}

function scaleUsageObject(usage: unknown, multiplier: number) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return;
  const seen = new WeakSet<object>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    if (seen.has(value)) return;
    seen.add(value);

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (child && typeof child === 'object') {
        visit(child);
        continue;
      }
      if (/tokens?/i.test(key)) record[key] = scaledTokenValue(child, multiplier);
    }
  };
  visit(usage);
}

function scaleUsageInPayload(payload: unknown, multiplier: number) {
  if (multiplier === 1 || !payload || typeof payload !== 'object') return payload;
  const cloned = structuredClone(payload);
  const scaledUsageObjects = new WeakSet<object>();
  const scaleUsageOnce = (usage: unknown) => {
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return;
    if (scaledUsageObjects.has(usage)) return;
    scaledUsageObjects.add(usage);
    scaleUsageObject(usage, multiplier);
  };
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (isUsageObjectKey(key)) scaleUsageOnce(child);
    }
    for (const [key, child] of Object.entries(record)) {
      if (!isUsageObjectKey(key)) visit(child);
    }
  };
  visit(cloned);
  return cloned;
}

export function rewriteJsonUsageText(text: string, multiplier: number) {
  if (!text) return { text, payload: {} };
  if (multiplier === 1) return { text, payload: parseJsonText(text) };
  const payload = parseJsonText(text);
  const scaledPayload = scaleUsageInPayload(payload, multiplier);
  return {
    text: JSON.stringify(scaledPayload),
    payload: scaledPayload
  };
}

export function scaleSseEvent(eventText: string, multiplier: number) {
  if (multiplier === 1) return eventText;
  if (!eventText.includes('"usage"')) return eventText;
  return eventText
    .split('\n')
    .map((line) => {
      if (!line.startsWith('data:')) return line;
      const prefix = line.match(/^data:\s?/)?.[0] || 'data: ';
      const data = line.slice(prefix.length);
      if (!data || data === '[DONE]') return line;
      try {
        return `${prefix}${JSON.stringify(scaleUsageInPayload(JSON.parse(data), multiplier))}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

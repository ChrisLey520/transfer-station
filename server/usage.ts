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

export function hasUsageTokens(usage: AnthropicUsage | undefined) {
  if (!usage) return false;
  return [
    (usage as any).input_tokens,
    (usage as any).prompt_tokens,
    (usage as any).output_tokens,
    (usage as any).completion_tokens,
    (usage as any).cache_creation_input_tokens,
    (usage as any).cache_read_input_tokens,
    (usage as any).input_tokens_details?.cache_creation_input_tokens,
    (usage as any).input_tokens_details?.cache_read_input_tokens,
    (usage as any).input_tokens_details?.cached_tokens,
    (usage as any).prompt_tokens_details?.cache_creation_input_tokens,
    (usage as any).prompt_tokens_details?.cache_read_input_tokens,
    (usage as any).prompt_tokens_details?.cached_tokens,
    (usage as any).total_tokens,
    (usage as any).totalTokens
  ].some((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function isCjkLikeCharacter(char: string) {
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af\uff00-\uffef]/u.test(char);
}

export function estimateTextTokens(text: string) {
  const estimator = createTextTokenEstimator();
  estimator.add(text);
  return estimator.finish();
}

export function createTextTokenEstimator() {
  let tokens = 0;
  let segmentLength = 0;

  const flushSegment = () => {
    if (!segmentLength) return;
    tokens += Math.ceil(segmentLength / 4);
    segmentLength = 0;
  };

  return {
    add(text: string) {
      if (!text) return;
      for (const char of text) {
        if (/\s/u.test(char)) {
          flushSegment();
          continue;
        }
        if (isCjkLikeCharacter(char)) {
          flushSegment();
          tokens += 1;
          continue;
        }
        segmentLength += char.length;
      }
    },
    finish() {
      flushSegment();
      return tokens;
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringifyInputPart(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function collectStructuredText(value: unknown, parts: string[]) {
  if (typeof value === 'string') {
    parts.push(value);
    return;
  }
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredText(item, parts));
    return;
  }
  if (!isRecord(value)) return;

  const text = value.text;
  if (typeof text === 'string') parts.push(text);

  const content = value.content;
  if (typeof content === 'string') {
    parts.push(content);
  } else {
    collectStructuredText(content, parts);
  }

  for (const key of ['input', 'messages', 'prompt', 'instructions']) {
    if (key in value) collectStructuredText(value[key], parts);
  }
}

export function extractCodexInputText(requestBody: unknown) {
  if (!isRecord(requestBody)) return stringifyInputPart(requestBody);

  const parts: string[] = [];
  for (const key of ['instructions', 'input', 'messages', 'prompt']) {
    if (key in requestBody) collectStructuredText(requestBody[key], parts);
  }
  for (const key of ['tools', 'tool_choice', 'response_format', 'text']) {
    if (key in requestBody) parts.push(stringifyInputPart(requestBody[key]));
  }

  if (parts.length) return parts.filter(Boolean).join('\n');
  return stringifyInputPart(requestBody);
}

export function extractCodexOutputDelta(event: unknown) {
  if (!isRecord(event)) return '';
  const type = typeof event.type === 'string' ? event.type : '';
  if (!type.includes('delta')) return '';
  for (const key of ['delta', 'text', 'content', 'output_text']) {
    const value = event[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

export function estimateCodexInterruptedUsage(input: {
  requestBody: unknown;
  outputText?: string;
  outputTokens?: number;
}): AnthropicUsage {
  return {
    input_tokens: estimateTextTokens(extractCodexInputText(input.requestBody)),
    output_tokens:
      typeof input.outputTokens === 'number' && Number.isFinite(input.outputTokens)
        ? Math.max(0, Math.round(input.outputTokens))
        : estimateTextTokens(input.outputText || '')
  };
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

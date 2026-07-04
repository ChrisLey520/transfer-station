import { usageCostCents } from '../server/pricing.ts';

function scaleTokenCount(value, multiplier = 1) {
  return Math.max(0, Math.round(Number(value || 0) * Math.max(1, Number(multiplier || 1))));
}

function normalizeUsage(usage, rates = {}, usageMultiplier = 1) {
  const inputTokenDetails = usage?.input_tokens_details || usage?.prompt_tokens_details;
  const outputTokenDetails = usage?.output_tokens_details || usage?.completion_tokens_details;
  const cachedTokens = Number(inputTokenDetails?.cached_tokens ?? inputTokenDetails?.cache_read_input_tokens ?? 0);
  const rawInputTokens = Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0);
  const inputTokens = scaleTokenCount(Math.max(0, rawInputTokens - cachedTokens), usageMultiplier);
  const outputTokens = scaleTokenCount(Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0), usageMultiplier);
  const cacheCreationInputTokens = scaleTokenCount(
    Number(usage?.cache_creation_input_tokens ?? inputTokenDetails?.cache_creation_input_tokens ?? 0),
    usageMultiplier
  );
  const cacheReadInputTokens = scaleTokenCount(Number(usage?.cache_read_input_tokens ?? cachedTokens ?? 0), usageMultiplier);
  const reasoningTokens = scaleTokenCount(Number(outputTokenDetails?.reasoning_tokens ?? 0), usageMultiplier);
  const billedOutputTokens = outputTokens + reasoningTokens;
  const costs = usageCostCents({
    inputTokens,
    outputTokens: billedOutputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens
  }, rates);

  return {
    inputTokens,
    outputTokens: billedOutputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    reasoningTokens,
    totalTokens: inputTokens + billedOutputTokens + cacheCreationInputTokens + cacheReadInputTokens,
    ...costs
  };
}

function scaleUsageObject(usage, multiplier) {
  if (!usage || typeof usage !== 'object') return usage;
  const record = usage;
  const scaled = Array.isArray(record) ? [...record] : { ...record };
  for (const key of Object.keys(scaled)) {
    const value = scaled[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      scaled[key] = scaleTokenCount(value, multiplier);
      continue;
    }
    if (value && typeof value === 'object') {
      scaled[key] = scaleUsageObject(value, multiplier);
    }
  }
  return scaled;
}

const sampleResponse = {
  id: 'resp_demo_123',
  object: 'response',
  model: 'gpt-5.4',
  output: [
    {
      id: 'out_1',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Simulation OK' }]
    }
  ],
  usage: {
    input_tokens: 1200,
    output_tokens: 340,
    input_tokens_details: {
      cached_tokens: 200,
      cache_creation_input_tokens: 150
    },
    output_tokens_details: {
      reasoning_tokens: 60
    }
  }
};

const displayUsageMultiplier = Number(process.argv[2] || 2);
const rates = {
  inputPerMillion: 1.5,
  outputPerMillion: 9,
  cacheCreationPerMillion: 0,
  cacheReadPerMillion: 0.15
};

const normalized = normalizeUsage(sampleResponse.usage, rates, displayUsageMultiplier);
const rewrittenResponse = {
  ...sampleResponse,
  usage: scaleUsageObject(sampleResponse.usage, displayUsageMultiplier)
};

console.log(JSON.stringify({
  displayUsageMultiplier,
  rates,
  upstreamUsage: sampleResponse.usage,
  rewrittenUsageForClient: rewrittenResponse.usage,
  billingBreakdown: normalized
}, null, 2));

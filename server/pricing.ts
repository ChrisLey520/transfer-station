export type UsageCostInput = {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
};

export type UsageRates = {
  inputPerMillion?: number;
  outputPerMillion?: number;
  cacheCreationPerMillion?: number;
  cacheReadPerMillion?: number;
};

type UsageCostBreakdown = {
  inputCostCents: number;
  outputCostCents: number;
  cacheCreationCostCents: number;
  cacheReadCostCents: number;
  totalCostCents: number;
};

const defaultRates = {
  inputPerMillion: 3,
  outputPerMillion: 15,
  cacheCreationPerMillion: 3.75,
  cacheReadPerMillion: 0.3
};

export function centsForTokens(tokens: number, dollarsPerMillion: number) {
  const rawCents = ((tokens || 0) / 1_000_000) * dollarsPerMillion * 100;
  return rawCents > 0 ? Math.ceil(rawCents) : 0;
}

export function usageCostCents(usage: UsageCostInput, rates: UsageRates = {}) {
  const effectiveRates = { ...defaultRates, ...rates };
  const inputCostCents = centsForTokens(usage.inputTokens || 0, effectiveRates.inputPerMillion);
  const outputCostCents = centsForTokens(usage.outputTokens || 0, effectiveRates.outputPerMillion);
  const cacheCreationCostCents = centsForTokens(
    usage.cacheCreationInputTokens || 0,
    effectiveRates.cacheCreationPerMillion
  );
  const cacheReadCostCents = centsForTokens(usage.cacheReadInputTokens || 0, effectiveRates.cacheReadPerMillion);

  return applyMinimumRequestCost({
    inputCostCents,
    outputCostCents,
    cacheCreationCostCents,
    cacheReadCostCents,
    totalCostCents: inputCostCents + outputCostCents + cacheCreationCostCents + cacheReadCostCents
  });
}

function applyMinimumRequestCost(costs: UsageCostBreakdown): UsageCostBreakdown {
  if (costs.totalCostCents > 0) return costs;

  return {
    ...costs,
    inputCostCents: 1,
    totalCostCents: 1
  };
}

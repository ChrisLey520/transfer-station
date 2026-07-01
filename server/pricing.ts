export type UsageCostInput = {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
};

const defaultRates = {
  inputPerMillion: 3,
  outputPerMillion: 15,
  cacheCreationPerMillion: 3.75,
  cacheReadPerMillion: 0.3
};

export function centsForTokens(tokens: number, dollarsPerMillion: number) {
  return Math.round(((tokens || 0) / 1_000_000) * dollarsPerMillion * 100);
}

export function usageCostCents(usage: UsageCostInput) {
  const inputCostCents = centsForTokens(usage.inputTokens || 0, defaultRates.inputPerMillion);
  const outputCostCents = centsForTokens(usage.outputTokens || 0, defaultRates.outputPerMillion);
  const cacheCreationCostCents = centsForTokens(
    usage.cacheCreationInputTokens || 0,
    defaultRates.cacheCreationPerMillion
  );
  const cacheReadCostCents = centsForTokens(usage.cacheReadInputTokens || 0, defaultRates.cacheReadPerMillion);

  return {
    inputCostCents,
    outputCostCents,
    cacheCreationCostCents,
    cacheReadCostCents,
    totalCostCents: inputCostCents + outputCostCents + cacheCreationCostCents + cacheReadCostCents
  };
}

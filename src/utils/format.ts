export function compact(value: number) {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

export function percent(value: number) {
  return `${Intl.NumberFormat('en', { maximumFractionDigits: value >= 0.1 ? 1 : 2 }).format((value || 0) * 100)}%`;
}

export function currency(cents: number, currencyCode: string) {
  void currencyCode;
  const amount = roundToDecimals((cents || 0) / 100, 2);
  return `$${amount.toFixed(2)}`;
}

export function currencyNoDecimals(cents: number, currencyCode: string) {
  void currencyCode;
  const value = Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format((cents || 0) / 100);
  return `$${value}`;
}

export function dollarsToCents(value: number) {
  return Math.max(1, Math.ceil((value || 0) * 100));
}

export function ceilToDecimals(value: number, digits: number) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.ceil((value + Number.EPSILON) * factor) / factor;
}

export function roundToDecimals(value: number, digits: number) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function tokenK(value: number) {
  const normalized = Math.max(0, Number(value || 0));
  if (normalized < 1000) {
    return Intl.NumberFormat('en').format(normalized);
  }
  const amount = ceilToDecimals(normalized / 1000, 3);
  return `${amount.toFixed(3)}k`;
}

export function usageColor(value: number) {
  if (value <= 20) return 'var(--usage-green)';
  if (value <= 40) return 'var(--usage-blue)';
  if (value <= 60) return 'var(--usage-yellow)';
  if (value <= 80) return 'var(--usage-orange)';
  return 'var(--usage-red)';
}

export function pct(used: number, limit: number) {
  if (!limit) return 0;
  return (used / limit) * 100;
}

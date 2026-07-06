export function upstreamErrorMessage(payload: unknown, fallback: string) {
  const error = payload && typeof payload === 'object' && 'error' in payload ? (payload as any).error : null;
  if (typeof error === 'string') return error;
  if (error?.message) return String(error.message);
  if (payload && typeof payload === 'object' && 'message' in payload && (payload as any).message) {
    return String((payload as any).message);
  }
  return fallback;
}

export function hasUpstreamErrorPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as Record<string, unknown>;
  return Boolean(record.error) || record.type === 'error' || record.object === 'error';
}

function parseRetryValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const now = Date.now();
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (value > 1_000_000_000_000) return new Date(value).toISOString();
    if (value > 1_000_000_000) return new Date(value * 1000).toISOString();
    return new Date(now + value * 1000).toISOString();
  }

  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return parseRetryValue(Number(text));

  const duration = text.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)$/i);
  if (duration) {
    const amount = Number(duration[1]);
    const unit = duration[2].toLowerCase();
    const multiplier = unit === 'ms' ? 1 : unit === 's' ? 1000 : unit === 'm' ? 60_000 : 3_600_000;
    return new Date(now + amount * multiplier).toISOString();
  }

  const parsed = Date.parse(text);
  if (Number.isFinite(parsed) && parsed > now) return new Date(parsed).toISOString();
  return null;
}

function nestedValue(source: unknown, pathValue: string) {
  return pathValue.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

export function recoveryUntilFromUpstream(headers: Headers, payload: unknown) {
  const headerNames = [
    'retry-after',
    'x-ratelimit-reset',
    'x-ratelimit-reset-requests',
    'x-ratelimit-reset-tokens',
    'x-rate-limit-reset',
    'x-quota-reset'
  ];
  for (const name of headerNames) {
    const parsed = parseRetryValue(headers.get(name));
    if (parsed) return parsed;
  }

  const jsonPaths = [
    'retry_after',
    'retryAfter',
    'retry_after_ms',
    'reset_at',
    'resetAt',
    'resets_at',
    'quota_reset_at',
    'error.retry_after',
    'error.retryAfter',
    'error.retry_after_ms',
    'error.reset_at',
    'error.resetAt',
    'error.resets_at'
  ];
  for (const pathValue of jsonPaths) {
    const value = nestedValue(payload, pathValue);
    if (pathValue.endsWith('_ms') && typeof value === 'number') {
      const parsed = parseRetryValue(value / 1000);
      if (parsed) return parsed;
      continue;
    }
    const parsed = parseRetryValue(value);
    if (parsed) return parsed;
  }

  return null;
}

export function isKeyLevelFailure(statusCode: number, message: string) {
  if (statusCode === 402 || statusCode === 429) return true;
  const normalized = message.toLowerCase();
  return /\b(quota|credit|balance|exhaust|insufficient|rate limit|billing)\b/.test(normalized);
}

export function isGroupLevelFailure(statusCode: number) {
  return statusCode >= 500;
}

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

const monthIndexes: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11
};

function datePartsInOffsetTimezone(now: number, offsetMinutes: number) {
  const shifted = new Date(now + offsetMinutes * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate()
  };
}

function parseUtcOffset(hoursText: string, minutesText?: string) {
  const hours = Number(hoursText);
  const minutes = minutesText ? Number(minutesText) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (Math.abs(hours) > 14 || minutes < 0 || minutes >= 60) return null;
  const sign = hours < 0 ? -1 : 1;
  return sign * (Math.abs(hours) * 60 + minutes);
}

function parseTextResetValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  const match = text.match(
    /\b(?:will\s+)?(?:reset|resets|retry|available)\b[\s\S]*?\bon\s+(?:(today|tomorrow)|([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s+(\d{4}))?)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*\(\s*UTC\s*([+-]\d{1,2})(?::?(\d{2}))?\s*\)/i
  );
  if (!match) return null;

  const relativeDay = match[1]?.toLowerCase() ?? null;
  const month = relativeDay ? null : monthIndexes[match[2].toLowerCase()];
  const day = relativeDay ? null : Number(match[3]);
  const explicitYear = match[4] ? Number(match[4]) : null;
  let hour = Number(match[5]);
  const minute = match[6] ? Number(match[6]) : 0;
  const meridiem = match[7]?.toUpperCase();
  const offsetMinutes = parseUtcOffset(match[8], match[9]);
  if (
    (!relativeDay &&
      (month === undefined || !Number.isInteger(day) || (day as number) < 1 || (day as number) > 31)) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute >= 60 ||
    offsetMinutes === null
  ) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  const now = Date.now();
  const todayParts = datePartsInOffsetTimezone(now, offsetMinutes);
  let timestamp: number;
  if (relativeDay) {
    const dayOffset = relativeDay === 'tomorrow' ? 1 : 0;
    timestamp =
      Date.UTC(todayParts.year, todayParts.month, todayParts.day + dayOffset, hour, minute) - offsetMinutes * 60 * 1000;
  } else {
    let year = explicitYear ?? todayParts.year;
    timestamp = Date.UTC(year, month as number, day as number, hour, minute) - offsetMinutes * 60 * 1000;
    // 无年份且时间已过:仅当差距接近一年(跨年场景)才推到下一年;
    // 差距很小说明只是重置时间刚过或时钟偏差,保留原始时间即可。
    if (!explicitYear && timestamp <= now && now - timestamp > 30 * 24 * 60 * 60 * 1000) {
      year += 1;
      timestamp = Date.UTC(year, month as number, day as number, hour, minute) - offsetMinutes * 60 * 1000;
    }
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function nestedValue(source: unknown, pathValue: string) {
  return pathValue.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

export function recoveryUntilFromUpstream(headers: Headers, payload: unknown) {
  // 优先使用响应体:结构化字段和报错消息文本给出的是精确的重置时间,
  // 且消息原文会一并展示给用户;retry-after 等头部往往只是粗略的相对秒数,
  // 放最后兜底,避免与消息里的时间不一致。
  const jsonPaths = [
    'reset_at',
    'resetAt',
    'resets_at',
    'quota_reset_at',
    'error.reset_at',
    'error.resetAt',
    'error.resets_at',
    'retry_after',
    'retryAfter',
    'retry_after_ms',
    'error.retry_after',
    'error.retryAfter',
    'error.retry_after_ms'
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

  const textPaths = ['error', 'message', 'detail', 'error.message', 'error.detail'];
  for (const pathValue of textPaths) {
    const parsed = parseTextResetValue(nestedValue(payload, pathValue));
    if (parsed) return parsed;
  }

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

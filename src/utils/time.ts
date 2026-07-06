import { Bootstrap } from '../types.js';
import dayjs from 'dayjs';

export function futureTimestamp(value: string | null | undefined, now = Date.now()) {
  if (!value) return null;
  const timestamp = dayjs(value).valueOf();
  return Number.isFinite(timestamp) && timestamp > now ? timestamp : null;
}

export function futureDateLabel(value: string | null | undefined) {
  if (!value) return '';
  return futureTimestamp(value) ? fullDate(value) : '';
}

export function nextBootstrapRefreshDelay(data: Bootstrap, now = Date.now()) {
  const resetTimes = data.keys.flatMap((key) => [key.usage.fiveHourResetAt, key.usage.weeklyResetAt]);
  const timestamps = [data.account.planExpiresAt, ...resetTimes]
    .map((value) => futureTimestamp(value, now))
    .filter((value): value is number => value !== null);

  if (!timestamps.length) return null;
  const nextTimestamp = Math.min(...timestamps);
  return Math.min(Math.max(nextTimestamp - now + 1500, 1500), 2_147_483_647);
}

export function formatDateTime(value: string) {
  const date = dayjs(value);
  if (!date.isValid()) return value;
  return date.format('YYYY-MM-DD HH:mm:ss');
}

export function dateTimeLocalValue(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

export function dateTimeLocalToIso(value: string) {
  if (!value) return null;
  const date = dayjs(value);
  return date.isValid() ? date.toISOString() : null;
}

export function displayDateTime(value: string | null) {
  if (!value) return '';
  const date = dayjs(value);
  if (!date.isValid()) return value;
  return date.format('YYYY-MM-DD HH:mm:ss');
}

export function isPastDate(value: string | null) {
  if (!value) return false;
  const timestamp = dayjs(value).valueOf();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

export function shortDate(value: string) {
  const date = dayjs(value);
  if (!date.isValid()) return value;
  return date.format('MM-DD HH:mm');
}

export function fullDate(value: string) {
  const date = dayjs(value);
  if (!date.isValid()) return value;
  return date.format('YYYY-MM-DD HH:mm:ss');
}

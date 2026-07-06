import { tr } from '../../i18n.js';
import type { UpstreamChannelKey, UpstreamKeyAgentType } from '../../types.js';
import { fullDate, isPastDate } from '../../utils/time.js';

export function upstreamKeyRuntimeStatus(key: UpstreamChannelKey) {
  if (key.status === 'banned') return 'banned' as const;
  if (isPastDate(key.expiresAt)) return 'expired' as const;
  if (key.failureStatusCode === 402) return 'quota-exhausted' as const;
  if (key.failureStatusCode === 401) return 'expired' as const;
  if (key.failureStatusCode === 503) return 'channel-error' as const;
  if (key.status === 'paused') return 'paused' as const;
  if (key.status === 'revoked') return 'revoked' as const;
  return 'available' as const;
}

export function upstreamKeyStatusLabel(key: UpstreamChannelKey, t: Record<string, string>) {
  const runtimeStatus = upstreamKeyRuntimeStatus(key);
  if (runtimeStatus === 'banned') return tr(t, 'banned', '封禁');
  if (runtimeStatus === 'quota-exhausted') return tr(t, 'quotaInsufficient', '额度不足');
  if (runtimeStatus === 'channel-error') return tr(t, 'channelInternalError', '渠道内部错误');
  if (runtimeStatus === 'expired') return tr(t, 'expired', '已过期');
  if (runtimeStatus === 'paused') return t.pause;
  if (runtimeStatus === 'revoked') return t.revoke;
  return tr(t, 'available', '可用');
}

export function upstreamKeyStatusClassName(key: UpstreamChannelKey) {
  const runtimeStatus = upstreamKeyRuntimeStatus(key);
  if (runtimeStatus === 'available') return 'status-pill success';
  if (runtimeStatus === 'quota-exhausted') return 'status-pill warn';
  if (runtimeStatus === 'banned') return 'status-pill danger';
  if (runtimeStatus === 'channel-error') return 'status-pill danger';
  return 'status-pill';
}

export function upstreamKeyAutoResetDisplay(key: UpstreamChannelKey, t: Record<string, string>) {
  return key.failureStatusCode === 402 && key.exhaustedUntil ? fullDate(key.exhaustedUntil) : t.notAvailable || '-';
}

export function agentTypeLabel(value: UpstreamKeyAgentType) {
  if (value === 'claude-code') return 'Claude Code';
  if (value === 'codex') return 'Codex';
  return 'Shared';
}

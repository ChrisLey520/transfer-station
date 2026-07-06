import type { GuideAgentId, UpstreamKeyAgentType } from './core.js';

export type UpstreamChannelKey = {
  id: string;
  channelGroupId: string;
  name: string;
  agentType: UpstreamKeyAgentType;
  keyPreview: string;
  status: 'active' | 'paused' | 'revoked' | 'banned';
  sortOrder: number;
  expiresAt: string | null;
  exhaustedUntil: string | null;
  failureReason: string | null;
  failureStatusCode: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpstreamModelRate = {
  id: string;
  channelGroupId: string;
  agentType: GuideAgentId;
  model: string;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  cacheCreationRatePerMillion: number;
  cacheReadRatePerMillion: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type UpstreamChannel = {
  id: string;
  channelNumber: number;
  name: string;
  websiteUrl: string;
  status: 'active' | 'paused' | 'banned';
  claudeApiUrl: string;
  codexApiUrl: string;
  useIndependentAgentKeys: boolean;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  cacheCreationRatePerMillion: number;
  cacheReadRatePerMillion: number;
  serverErrorRecoveryMinutes: number;
  displayUsageMultiplier: number;
  sortOrder: number;
  degradedUntil: string | null;
  degradedReason: string | null;
  degradedStatusCode: number | null;
  keys: UpstreamChannelKey[];
  modelRates: UpstreamModelRate[];
  keyCounts: Record<UpstreamKeyAgentType, number>;
  createdAt: string;
  updatedAt: string;
};

export type UpstreamChannelAgentTab = GuideAgentId;

export type UpstreamKeyDeleteTarget = {
  channel: UpstreamChannel;
  key: UpstreamChannelKey;
};

export type UpstreamKeyEditTarget = {
  channel: UpstreamChannel;
  key: UpstreamChannelKey;
};

export type UpstreamModelRateTarget = {
  channel: UpstreamChannel;
  rate?: UpstreamModelRate;
};

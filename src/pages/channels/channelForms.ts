import type { GuideAgentId, UpstreamChannel, UpstreamModelRate } from '../../types.js';

export const emptyChannelForm = {
  id: '',
  name: '',
  websiteUrl: '',
  status: 'active' as UpstreamChannel['status'],
  claudeApiUrl: '',
  codexApiUrl: '',
  useIndependentAgentKeys: false,
  inputRatePerMillion: 3,
  outputRatePerMillion: 15,
  cacheCreationRatePerMillion: 3.75,
  cacheReadRatePerMillion: 0.3,
  serverErrorRecoveryMinutes: 10,
  displayUsageMultiplier: 2,
  sortOrder: 100
};

export type ChannelFormState = typeof emptyChannelForm;

export function channelToForm(channel: UpstreamChannel) {
  return {
    id: channel.id,
    name: channel.name,
    websiteUrl: channel.websiteUrl,
    status: channel.status,
    claudeApiUrl: channel.claudeApiUrl,
    codexApiUrl: channel.codexApiUrl,
    useIndependentAgentKeys: channel.useIndependentAgentKeys,
    inputRatePerMillion: channel.inputRatePerMillion,
    outputRatePerMillion: channel.outputRatePerMillion,
    cacheCreationRatePerMillion: channel.cacheCreationRatePerMillion,
    cacheReadRatePerMillion: channel.cacheReadRatePerMillion,
    serverErrorRecoveryMinutes: channel.serverErrorRecoveryMinutes,
    displayUsageMultiplier: channel.displayUsageMultiplier,
    sortOrder: channel.sortOrder
  };
}

export const emptyModelRateForm = {
  agentType: 'claude-code' as GuideAgentId,
  model: '',
  inputRatePerMillion: 0,
  outputRatePerMillion: 0,
  cacheCreationRatePerMillion: 0,
  cacheReadRatePerMillion: 0,
  isDefault: false,
  sortOrder: 100
};

export type ModelRateFormState = typeof emptyModelRateForm;

export function modelRateToForm(rate: UpstreamModelRate) {
  return {
    agentType: rate.agentType,
    model: rate.model,
    inputRatePerMillion: rate.inputRatePerMillion,
    outputRatePerMillion: rate.outputRatePerMillion,
    cacheCreationRatePerMillion: rate.cacheCreationRatePerMillion,
    cacheReadRatePerMillion: rate.cacheReadRatePerMillion,
    isDefault: rate.isDefault,
    sortOrder: rate.sortOrder
  };
}

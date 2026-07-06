import type { UpstreamChannel, UpstreamChannelKey, UpstreamModelRate } from '../../types.js';
import { readJsonResponse, responseErrorMessage } from '../../utils/api.js';
import type { ChannelFormState, ModelRateFormState } from './channelForms.js';

type ChannelListPayload = { channels: UpstreamChannel[] };

async function readChannelPayload<T>(response: Response, requestFailed: string): Promise<T> {
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(responseErrorMessage(response, payload, requestFailed));
  }
  return payload as T;
}

export async function fetchChannels(headers: HeadersInit, requestFailed: string) {
  const response = await fetch('/api/upstream-channels', { headers });
  return readChannelPayload<ChannelListPayload>(response, requestFailed);
}

export async function persistChannel(channelForm: ChannelFormState, headers: HeadersInit, requestFailed: string) {
  const isEdit = Boolean(channelForm.id);
  const response = await fetch(isEdit ? `/api/upstream-channels/${channelForm.id}` : '/api/upstream-channels', {
    method: isEdit ? 'PATCH' : 'POST',
    headers,
    body: JSON.stringify({
      name: channelForm.name,
      status: channelForm.status,
      claudeApiUrl: channelForm.claudeApiUrl,
      codexApiUrl: channelForm.codexApiUrl,
      useIndependentAgentKeys: channelForm.useIndependentAgentKeys,
      inputRatePerMillion: channelForm.inputRatePerMillion,
      outputRatePerMillion: channelForm.outputRatePerMillion,
      cacheCreationRatePerMillion: channelForm.cacheCreationRatePerMillion,
      cacheReadRatePerMillion: channelForm.cacheReadRatePerMillion,
      serverErrorRecoveryMinutes: channelForm.serverErrorRecoveryMinutes,
      displayUsageMultiplier: Number(channelForm.displayUsageMultiplier.toFixed(2)),
      sortOrder: channelForm.sortOrder
    })
  });
  return readChannelPayload<ChannelListPayload>(response, requestFailed);
}

export async function cloneUpstreamChannel(channel: UpstreamChannel, includeKeys: boolean, headers: HeadersInit, requestFailed: string) {
  const response = await fetch(`/api/upstream-channels/${channel.id}/clone`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ includeKeys })
  });
  return readChannelPayload<{ channel?: UpstreamChannel; channels?: UpstreamChannel[] }>(response, requestFailed);
}

export async function removeChannel(channel: UpstreamChannel, headers: HeadersInit, requestFailed: string) {
  const response = await fetch(`/api/upstream-channels/${channel.id}`, { method: 'DELETE', headers });
  return readChannelPayload<ChannelListPayload>(response, requestFailed);
}

export async function persistChannelStatus(channel: UpstreamChannel, status: UpstreamChannel['status'], headers: HeadersInit, requestFailed: string) {
  const response = await fetch(`/api/upstream-channels/${channel.id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status })
  });
  return readChannelPayload<ChannelListPayload>(response, requestFailed);
}

export async function createUpstreamKey({
  channel,
  body,
  headers,
  requestFailed
}: {
  channel: UpstreamChannel;
  body: {
    name: string;
    key: string;
    agentType: string;
    status: 'active';
    expiresAt: string | null;
  };
  headers: HeadersInit;
  requestFailed: string;
}) {
  const response = await fetch(`/api/upstream-channels/${channel.id}/keys`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  return readChannelPayload<ChannelListPayload>(response, requestFailed);
}

export async function updateUpstreamKey({
  channel,
  key,
  body,
  headers,
  requestFailed
}: {
  channel: UpstreamChannel;
  key: UpstreamChannelKey;
  body: {
    name?: string;
    key?: string;
    status?: UpstreamChannelKey['status'];
    expiresAt?: string | null;
  };
  headers: HeadersInit;
  requestFailed: string;
}) {
  const response = await fetch(`/api/upstream-channels/${channel.id}/keys/${key.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body)
  });
  return readChannelPayload<ChannelListPayload>(response, requestFailed);
}

export async function removeUpstreamKey(channel: UpstreamChannel, key: UpstreamChannelKey, headers: HeadersInit, requestFailed: string) {
  const response = await fetch(`/api/upstream-channels/${channel.id}/keys/${key.id}`, { method: 'DELETE', headers });
  return readChannelPayload<ChannelListPayload>(response, requestFailed);
}

export async function persistModelRate({
  channel,
  modelRate,
  modelRateForm,
  headers,
  requestFailed
}: {
  channel: UpstreamChannel;
  modelRate: UpstreamModelRate | undefined;
  modelRateForm: ModelRateFormState;
  headers: HeadersInit;
  requestFailed: string;
}) {
  const response = await fetch(modelRate ? `/api/upstream-channels/${channel.id}/model-rates/${modelRate.id}` : `/api/upstream-channels/${channel.id}/model-rates`, {
    method: modelRate ? 'PATCH' : 'POST',
    headers,
    body: JSON.stringify(modelRateForm)
  });
  return readChannelPayload<ChannelListPayload>(response, requestFailed);
}

export async function removeModelRate(channel: UpstreamChannel, rate: UpstreamModelRate, headers: HeadersInit, requestFailed: string) {
  const response = await fetch(`/api/upstream-channels/${channel.id}/model-rates/${rate.id}`, { method: 'DELETE', headers });
  return readChannelPayload<ChannelListPayload>(response, requestFailed);
}

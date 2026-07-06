import { ButtonSpinner, Empty, LoadingContent } from '../components/common.js';
import { showErrorToast, showSuccessToast } from '../components/toast.js';
import { tr } from '../i18n.js';
import { GuideAgentId, UpstreamChannel, UpstreamChannelAgentTab, UpstreamChannelKey, UpstreamKeyAgentType, UpstreamKeyDeleteTarget, UpstreamKeyEditTarget, UpstreamModelRate, UpstreamModelRateTarget } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { dateTimeLocalToIso, dateTimeLocalValue, displayDateTime, fullDate, isPastDate } from '../utils/time.js';
import { Ban, Check, ChevronDown, Copy, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import React from 'react';

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

export function ChannelsPanel({ headers, refreshTick, t }: { headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const [channels, setChannels] = React.useState<UpstreamChannel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isChannelOpen, setIsChannelOpen] = React.useState(false);
  const [channelForm, setChannelForm] = React.useState(emptyChannelForm);
  const [expandedChannelIds, setExpandedChannelIds] = React.useState<Set<string>>(() => new Set());
  const [keyTarget, setKeyTarget] = React.useState<UpstreamChannel | null>(null);
  const [keyName, setKeyName] = React.useState('');
  const [keyValue, setKeyValue] = React.useState('');
  const [keyAgentType, setKeyAgentType] = React.useState<UpstreamKeyAgentType>('shared');
  const [keyExpiresAt, setKeyExpiresAt] = React.useState('');
  const [keyIsPermanent, setKeyIsPermanent] = React.useState(true);
  const [keyEditTarget, setKeyEditTarget] = React.useState<UpstreamKeyEditTarget | null>(null);
  const [keyEditName, setKeyEditName] = React.useState('');
  const [keyEditValue, setKeyEditValue] = React.useState('');
  const [keyEditExpiresAt, setKeyEditExpiresAt] = React.useState('');
  const [keyEditIsPermanent, setKeyEditIsPermanent] = React.useState(true);
  const [modelRateTarget, setModelRateTarget] = React.useState<UpstreamModelRateTarget | null>(null);
  const [modelRateForm, setModelRateForm] = React.useState(emptyModelRateForm);
  const [cloneTarget, setCloneTarget] = React.useState<UpstreamChannel | null>(null);
  const [cloneIncludesKeys, setCloneIncludesKeys] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<UpstreamChannel | null>(null);
  const [keyDeleteTarget, setKeyDeleteTarget] = React.useState<UpstreamKeyDeleteTarget | null>(null);
  const [channelStatusUpdatingId, setChannelStatusUpdatingId] = React.useState<string | null>(null);
  const [savingChannel, setSavingChannel] = React.useState(false);
  const [cloningChannelId, setCloningChannelId] = React.useState('');
  const [deletingChannelId, setDeletingChannelId] = React.useState('');
  const [savingKey, setSavingKey] = React.useState(false);
  const [savingEditedKey, setSavingEditedKey] = React.useState(false);
  const [updatingKeyStatusId, setUpdatingKeyStatusId] = React.useState('');
  const [savingModelRate, setSavingModelRate] = React.useState(false);
  const [deletingModelRateId, setDeletingModelRateId] = React.useState('');
  const [deletingKeyId, setDeletingKeyId] = React.useState('');

  const loadChannels = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/upstream-channels', { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setExpandedChannelIds((current) => new Set([...current].filter((id) => ((payload as { channels: UpstreamChannel[] }).channels || []).some((channel) => channel.id === id))));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [headers, t.requestFailed]);

  React.useEffect(() => {
    void loadChannels();
  }, [loadChannels, refreshTick]);

  function openCreate() {
    setChannelForm(emptyChannelForm);
    setIsChannelOpen(true);
  }

  function openEdit(channel: UpstreamChannel) {
    setChannelForm(channelToForm(channel));
    setIsChannelOpen(true);
  }

  async function saveChannel(event: React.FormEvent) {
    event.preventDefault();
    if (savingChannel) return;
    setSavingChannel(true);
    const isEdit = Boolean(channelForm.id);
    const body = {
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
    };

    try {
      const response = await fetch(isEdit ? `/api/upstream-channels/${channelForm.id}` : '/api/upstream-channels', {
        method: isEdit ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setIsChannelOpen(false);
      showSuccessToast(tr(t, 'channelSaved', '渠道已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setSavingChannel(false);
    }
  }

  function openClone(channel: UpstreamChannel) {
    setCloneTarget(channel);
    setCloneIncludesKeys(false);
  }

  async function cloneChannel(channel: UpstreamChannel) {
    if (cloningChannelId) return;
    setCloningChannelId(channel.id);
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}/clone`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ includeKeys: cloneIncludesKeys })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }

      const nextChannels = (payload as { channel?: UpstreamChannel; channels?: UpstreamChannel[] }).channels || [];
      const clonedChannel = (payload as { channel?: UpstreamChannel }).channel;
      setChannels(nextChannels);
      if (clonedChannel?.id) {
        setExpandedChannelIds((current) => new Set(current).add(clonedChannel.id));
      }
      setCloneTarget(null);
      setCloneIncludesKeys(false);
      showSuccessToast(tr(t, 'cloneChannelSuccess', '渠道已克隆。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setCloningChannelId('');
    }
  }

  async function deleteChannel(channel: UpstreamChannel) {
    if (deletingChannelId) return;
    setDeletingChannelId(channel.id);
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setDeleteTarget(null);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setDeletingChannelId('');
    }
  }

  async function updateChannelStatus(channel: UpstreamChannel, status: UpstreamChannel['status']) {
    if (channelStatusUpdatingId) return;
    setChannelStatusUpdatingId(channel.id);
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      showSuccessToast(status === 'banned' ? tr(t, 'banned', '封禁') : tr(t, 'unban', '解封'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setChannelStatusUpdatingId((current) => (current === channel.id ? null : current));
    }
  }

  async function saveKey(event: React.FormEvent) {
    event.preventDefault();
    if (!keyTarget) return;
    if (savingKey) return;
    setSavingKey(true);
    try {
      const response = await fetch(`/api/upstream-channels/${keyTarget.id}/keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: keyName,
          key: keyValue,
          agentType: keyAgentType,
          status: 'active',
          expiresAt: keyIsPermanent ? null : dateTimeLocalToIso(keyExpiresAt)
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setKeyTarget(null);
      setKeyName('');
      setKeyValue('');
      setKeyAgentType('shared');
      setKeyExpiresAt('');
      setKeyIsPermanent(true);
      showSuccessToast(tr(t, 'upstreamKeySaved', '上游 Key 已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setSavingKey(false);
    }
  }

  function openEditKey(channel: UpstreamChannel, key: UpstreamChannelKey) {
    setKeyEditTarget({ channel, key });
    setKeyEditName(key.name || '');
    setKeyEditValue('');
    setKeyEditIsPermanent(!key.expiresAt);
    setKeyEditExpiresAt(dateTimeLocalValue(key.expiresAt));
  }

  async function saveEditedKey(event: React.FormEvent) {
    event.preventDefault();
    if (!keyEditTarget) return;
    if (savingEditedKey) return;
    setSavingEditedKey(true);

    const body: {
      name: string;
      key?: string;
      expiresAt: string | null;
    } = {
      name: keyEditName,
      expiresAt: keyEditIsPermanent ? null : dateTimeLocalToIso(keyEditExpiresAt)
    };
    if (keyEditValue.trim()) {
      body.key = keyEditValue.trim();
    }

    try {
      const response = await fetch(`/api/upstream-channels/${keyEditTarget.channel.id}/keys/${keyEditTarget.key.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setKeyEditTarget(null);
      setKeyEditName('');
      setKeyEditValue('');
      setKeyEditExpiresAt('');
      setKeyEditIsPermanent(true);
      showSuccessToast(tr(t, 'upstreamKeySaved', '上游 Key 已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setSavingEditedKey(false);
    }
  }

  async function updateKeyStatus(channel: UpstreamChannel, key: UpstreamChannelKey, status: UpstreamChannelKey['status']) {
    if (updatingKeyStatusId) return;
    setUpdatingKeyStatusId(key.id);
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}/keys/${key.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      showSuccessToast(status === 'banned' ? tr(t, 'banned', '封禁') : status === 'active' ? tr(t, 'available', '可用') : t.pause);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setUpdatingKeyStatusId('');
    }
  }

  function openModelRate(channel: UpstreamChannel, rate?: UpstreamModelRate) {
    setModelRateTarget({ channel, rate });
    setModelRateForm(rate ? modelRateToForm(rate) : { ...emptyModelRateForm });
  }

  async function saveModelRate(event: React.FormEvent) {
    event.preventDefault();
    if (!modelRateTarget) return;
    if (savingModelRate) return;
    setSavingModelRate(true);
    const isEdit = Boolean(modelRateTarget.rate);
    try {
      const response = await fetch(
        isEdit
          ? `/api/upstream-channels/${modelRateTarget.channel.id}/model-rates/${modelRateTarget.rate!.id}`
          : `/api/upstream-channels/${modelRateTarget.channel.id}/model-rates`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers,
          body: JSON.stringify(modelRateForm)
        }
      );
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setModelRateTarget(null);
      setModelRateForm(emptyModelRateForm);
      showSuccessToast(tr(t, 'modelRateSaved', '模型计费已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setSavingModelRate(false);
    }
  }

  async function deleteModelRate(channel: UpstreamChannel, rate: UpstreamModelRate) {
    if (deletingModelRateId) return;
    setDeletingModelRateId(rate.id);
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}/model-rates/${rate.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setDeletingModelRateId('');
    }
  }

  async function deleteKey(channel: UpstreamChannel, key: UpstreamChannelKey) {
    if (deletingKeyId) return;
    setDeletingKeyId(key.id);
    try {
      const response = await fetch(`/api/upstream-channels/${channel.id}/keys/${key.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setChannels((payload as { channels: UpstreamChannel[] }).channels || []);
      setKeyDeleteTarget(null);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setDeletingKeyId('');
    }
  }

  function toggleChannel(channelId: string) {
    setExpandedChannelIds((current) => {
      const next = new Set(current);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }

  return (
    <section className="content-grid">
      <section className="table-panel">
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'channelManagement', '渠道管理')}</h2>
            <p>{tr(t, 'channelDescription', '配置上游渠道、Agent URL、共享或独立 API Key、故障恢复策略，以及智能调度优先级（值越小越先尝试）。')}</p>
          </div>
          <button type="button" className="primary-button" onClick={openCreate}>
            <Plus size={17} />
            {tr(t, 'createChannel', '新增渠道')}
          </button>
        </div>
        {loading ? <div className="loading-line" /> : null}
        {!channels.length ? (
          <Empty t={t}>
            <button type="button" className="primary-button" onClick={openCreate}>
              <Plus size={17} />
              {tr(t, 'createChannel', '新增渠道')}
            </button>
          </Empty>
        ) : (
          <div className="channel-list">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                t={t}
                isExpanded={expandedChannelIds.has(channel.id)}
                onToggle={() => toggleChannel(channel.id)}
                onEdit={() => openEdit(channel)}
                onChannelStatus={(status) => updateChannelStatus(channel, status)}
                isChannelStatusUpdating={channelStatusUpdatingId === channel.id}
                onClone={() => openClone(channel)}
                onAddKey={() => {
                  setKeyTarget(channel);
                  setKeyAgentType(channel.useIndependentAgentKeys ? 'claude-code' : 'shared');
                  setKeyName('');
                  setKeyValue('');
                  setKeyExpiresAt('');
                  setKeyIsPermanent(true);
                }}
                onDelete={() => setDeleteTarget(channel)}
                onKeyStatus={(key, status) => updateKeyStatus(channel, key, status)}
                onEditKey={(key) => openEditKey(channel, key)}
                onDeleteKey={(key) => setKeyDeleteTarget({ channel, key })}
                onAddModelRate={() => openModelRate(channel)}
                onEditModelRate={(rate) => openModelRate(channel, rate)}
                onDeleteModelRate={(rate) => deleteModelRate(channel, rate)}
                updatingKeyStatusId={updatingKeyStatusId}
                deletingModelRateId={deletingModelRateId}
              />
            ))}
          </div>
        )}
      </section>

      {isChannelOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel channel-modal-panel" onSubmit={saveChannel}>
            <div className="section-heading">
              <div>
                <h2>{channelForm.id ? tr(t, 'editChannel', '编辑渠道') : tr(t, 'createChannel', '新增渠道')}</h2>
                <p>{tr(t, 'channelModalHint', 'Codex 与 Claude Code 可使用不同 API URL，API Key 可共享或按 Agent 独立维护。')}</p>
              </div>
            </div>
            <div className="channel-form-grid">
              <label>
                {tr(t, 'channelName', '渠道名称')}
                <input
                  value={channelForm.name}
                  onChange={(event) => setChannelForm((value) => ({ ...value, name: event.target.value }))}
                  required
                  autoFocus
                />
              </label>
              <label className="wide-field">
                {tr(t, 'officialWebsite', '官网地址')}
                <input
                  type="url"
                  value={channelForm.websiteUrl}
                  onChange={(event) => setChannelForm((value) => ({ ...value, websiteUrl: event.target.value }))}
                  placeholder="https://example.com"
                  required
                />
              </label>
              <label>
                {t.status}
                <select
                  value={channelForm.status}
                  onChange={(event) => setChannelForm((value) => ({ ...value, status: event.target.value as UpstreamChannel['status'] }))}
                >
                  <option value="active">{tr(t, 'active', '启用')}</option>
                  <option value="paused">{t.pause}</option>
                  <option value="banned">{tr(t, 'banned', '封禁')}</option>
                </select>
              </label>
              <label className="wide-field">
                Claude Code API URL
                <input
                  value={channelForm.claudeApiUrl}
                  onChange={(event) => setChannelForm((value) => ({ ...value, claudeApiUrl: event.target.value }))}
                  placeholder="https://api-cc.example.com"
                  required
                />
              </label>
              <label className="wide-field">
                Codex API URL
                <input
                  value={channelForm.codexApiUrl}
                  onChange={(event) => setChannelForm((value) => ({ ...value, codexApiUrl: event.target.value }))}
                  placeholder="https://codex.example.com"
                  required
                />
              </label>
              <label>
                {tr(t, 'inputRate', '输入单价 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={channelForm.inputRatePerMillion}
                  onChange={(event) => setChannelForm((value) => ({ ...value, inputRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'outputRate', '输出单价 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={channelForm.outputRatePerMillion}
                  onChange={(event) => setChannelForm((value) => ({ ...value, outputRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'cacheWriteRate', '缓存写入 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={channelForm.cacheCreationRatePerMillion}
                  onChange={(event) =>
                    setChannelForm((value) => ({ ...value, cacheCreationRatePerMillion: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                {tr(t, 'cacheReadRate', '缓存读取 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={channelForm.cacheReadRatePerMillion}
                  onChange={(event) => setChannelForm((value) => ({ ...value, cacheReadRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'serverErrorRecoveryMinutes', '上游服务端错误恢复时间')}
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={channelForm.serverErrorRecoveryMinutes}
                  onChange={(event) =>
                    setChannelForm((value) => ({ ...value, serverErrorRecoveryMinutes: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                {tr(t, 'displayUsageMultiplier', '显示用量倍率')}
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={channelForm.displayUsageMultiplier}
                  onChange={(event) =>
                    setChannelForm((value) => ({
                      ...value,
                      displayUsageMultiplier: Math.max(1, Math.round(Number(event.target.value || 1) * 100) / 100)
                    }))
                  }
                />
              </label>
              <label>
                {tr(t, 'channelPriority', '优先级（越小越靠前）')}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={channelForm.sortOrder}
                  onChange={(event) =>
                    setChannelForm((value) => ({ ...value, sortOrder: Math.max(1, Math.trunc(Number(event.target.value) || 1)) }))
                  }
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={channelForm.useIndependentAgentKeys}
                onChange={(event) => setChannelForm((value) => ({ ...value, useIndependentAgentKeys: event.target.checked }))}
              />
              <span>{tr(t, 'useIndependentAgentKeys', 'Claude Code 与 Codex 使用独立 API Key')}</span>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setIsChannelOpen(false)} disabled={savingChannel}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button" disabled={savingChannel}>
                <LoadingContent loading={savingChannel} icon={<Check size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
                  {t.savePlan}
                </LoadingContent>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {keyTarget ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={saveKey}>
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'addUpstreamKey', '添加上游 Key')}</h2>
                <p>{keyTarget.name}</p>
              </div>
            </div>
            <label>
              {tr(t, 'keyScope', 'Key 作用域')}
              <select value={keyAgentType} onChange={(event) => setKeyAgentType(event.target.value as UpstreamKeyAgentType)}>
                <option value="shared" disabled={keyTarget.useIndependentAgentKeys}>
                  {tr(t, 'sharedKey', '共享')}
                </option>
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
              </select>
            </label>
            <label>
              {tr(t, 'upstreamKeyName', 'Key 名称')}
              <input value={keyName} onChange={(event) => setKeyName(event.target.value)} autoFocus />
            </label>
            <label>
              API Key
              <input value={keyValue} onChange={(event) => setKeyValue(event.target.value)} required />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={keyIsPermanent}
                onChange={(event) => setKeyIsPermanent(event.target.checked)}
              />
              <span>{tr(t, 'permanentKey', '永久有效')}</span>
            </label>
            {!keyIsPermanent ? (
              <label>
                {tr(t, 'keyExpiresAt', '到期时间')}
                <input
                  type="datetime-local"
                  step="1"
                  value={keyExpiresAt}
                  onChange={(event) => setKeyExpiresAt(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setKeyTarget(null)} disabled={savingKey}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button" disabled={savingKey}>
                <LoadingContent loading={savingKey} icon={<Plus size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
                  {tr(t, 'addUpstreamKey', '添加上游 Key')}
                </LoadingContent>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {cloneTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true">
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'cloneChannelConfirm', '确认克隆这个渠道？')}</h2>
                <p>{cloneTarget.name}</p>
              </div>
            </div>
            <p className="modal-hint-text">{tr(t, 'cloneChannelHint', '会复制渠道配置和模型计费信息。')}</p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={cloneIncludesKeys}
                onChange={(event) => setCloneIncludesKeys(event.target.checked)}
                disabled={Boolean(cloningChannelId)}
              />
              <span>{tr(t, 'cloneApiKeyOption', '同时克隆 API Key')}</span>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCloneTarget(null)} disabled={Boolean(cloningChannelId)}>
                {t.cancel}
              </button>
              <button type="button" className="primary-button" onClick={() => cloneChannel(cloneTarget)} disabled={Boolean(cloningChannelId)}>
                <LoadingContent loading={cloningChannelId === cloneTarget.id} icon={<Copy size={16} />} loadingLabel={tr(t, 'cloning', '克隆中...')}>
                  {tr(t, 'clone', '克隆')}
                </LoadingContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel modal-panel-danger" role="dialog" aria-modal="true">
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'deleteChannelConfirm', '确认删除这个渠道？')}</h2>
                <p>{deleteTarget.name}</p>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingChannelId)}>
                {t.cancel}
              </button>
              <button type="button" className="danger-button" onClick={() => deleteChannel(deleteTarget)} disabled={Boolean(deletingChannelId)}>
                <LoadingContent loading={deletingChannelId === deleteTarget.id} icon={<Trash2 size={16} />} loadingLabel={tr(t, 'deleting', '删除中...')}>
                  {t.delete}
                </LoadingContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {keyEditTarget ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={saveEditedKey}>
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'editUpstreamKey', '编辑上游 Key')}</h2>
                <p>
                  {keyEditTarget.channel.name} · {keyEditTarget.key.keyPreview}
                </p>
              </div>
            </div>
            <label>
              {tr(t, 'upstreamKeyName', 'Key 名称')}
              <input value={keyEditName} onChange={(event) => setKeyEditName(event.target.value)} autoFocus />
            </label>
            <label>
              API Key
              <input
                value={keyEditValue}
                onChange={(event) => setKeyEditValue(event.target.value)}
                placeholder={tr(t, 'leaveBlankKeepKey', '留空则不更换 Key')}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={keyEditIsPermanent}
                onChange={(event) => setKeyEditIsPermanent(event.target.checked)}
              />
              <span>{tr(t, 'permanentKey', '永久有效')}</span>
            </label>
            {!keyEditIsPermanent ? (
              <label>
                {tr(t, 'keyExpiresAt', '到期时间')}
                <input
                  type="datetime-local"
                  step="1"
                  value={keyEditExpiresAt}
                  onChange={(event) => setKeyEditExpiresAt(event.target.value)}
                  required
                />
              </label>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setKeyEditTarget(null)} disabled={savingEditedKey}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button" disabled={savingEditedKey}>
                <LoadingContent loading={savingEditedKey} icon={<Check size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
                  {t.savePlan}
                </LoadingContent>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {modelRateTarget ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel channel-modal-panel" onSubmit={saveModelRate}>
            <div className="section-heading">
              <div>
                <h2>{modelRateTarget.rate ? tr(t, 'editModelRate', '编辑模型计费') : tr(t, 'addModelRate', '新增模型计费')}</h2>
                <p>{modelRateTarget.channel.name}</p>
              </div>
            </div>
            <div className="channel-form-grid">
              <label>
                Agent
                <select
                  value={modelRateForm.agentType}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, agentType: event.target.value as GuideAgentId }))}
                >
                  <option value="claude-code">Claude Code</option>
                  <option value="codex">Codex</option>
                </select>
              </label>
              <label>
                {tr(t, 'modelName', '模型名称')}
                <input
                  value={modelRateForm.model}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, model: event.target.value }))}
                  placeholder="claude-sonnet-5* / gpt-5.3-codex / *"
                  required
                />
              </label>
              <label>
                {tr(t, 'inputRate', '输入单价 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={modelRateForm.inputRatePerMillion}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, inputRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'outputRate', '输出单价 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={modelRateForm.outputRatePerMillion}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, outputRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'cacheWriteRate', '缓存写入 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={modelRateForm.cacheCreationRatePerMillion}
                  onChange={(event) =>
                    setModelRateForm((value) => ({ ...value, cacheCreationRatePerMillion: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                {tr(t, 'cacheReadRate', '缓存读取 / M')}
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={modelRateForm.cacheReadRatePerMillion}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, cacheReadRatePerMillion: Number(event.target.value) }))}
                />
              </label>
              <label>
                {tr(t, 'sortOrder', '排序')}
                <input
                  type="number"
                  value={modelRateForm.sortOrder}
                  onChange={(event) => setModelRateForm((value) => ({ ...value, sortOrder: Number(event.target.value) }))}
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={modelRateForm.isDefault}
                onChange={(event) => setModelRateForm((value) => ({ ...value, isDefault: event.target.checked }))}
              />
              <span>{tr(t, 'defaultModelRate', '作为该 Agent 的默认计费')}</span>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModelRateTarget(null)} disabled={savingModelRate}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button" disabled={savingModelRate}>
                <LoadingContent loading={savingModelRate} icon={<Check size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
                  {t.savePlan}
                </LoadingContent>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {keyDeleteTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel modal-panel-danger" role="dialog" aria-modal="true">
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'deleteUpstreamKeyConfirm', '确认删除这个上游 Key？')}</h2>
                <p>
                  {keyDeleteTarget.channel.name} · {keyDeleteTarget.key.keyPreview}
                </p>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setKeyDeleteTarget(null)} disabled={Boolean(deletingKeyId)}>
                {t.cancel}
              </button>
              <button type="button" className="danger-button" onClick={() => deleteKey(keyDeleteTarget.channel, keyDeleteTarget.key)} disabled={Boolean(deletingKeyId)}>
                <LoadingContent loading={deletingKeyId === keyDeleteTarget.key.id} icon={<Trash2 size={16} />} loadingLabel={tr(t, 'deleting', '删除中...')}>
                  {t.delete}
                </LoadingContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ChannelCard({
  channel,
  t,
  isExpanded,
  onToggle,
  onEdit,
  onChannelStatus,
  isChannelStatusUpdating,
  onClone,
  onAddKey,
  onDelete,
  onKeyStatus,
  onEditKey,
  onDeleteKey,
  onAddModelRate,
  onEditModelRate,
  onDeleteModelRate,
  updatingKeyStatusId,
  deletingModelRateId,
  selectedAgentTab: selectedAgentTabProp
}: {
  channel: UpstreamChannel;
  t: Record<string, string>;
  selectedAgentTab?: GuideAgentId;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onChannelStatus: (status: UpstreamChannel['status']) => void;
  isChannelStatusUpdating: boolean;
  onClone: () => void;
  onAddKey: () => void;
  onDelete: () => void;
  onKeyStatus: (key: UpstreamChannelKey, status: UpstreamChannelKey['status']) => void;
  onEditKey: (key: UpstreamChannelKey) => void;
  onDeleteKey: (key: UpstreamChannelKey) => void;
  onAddModelRate: () => void;
  onEditModelRate: (rate: UpstreamModelRate) => void;
  onDeleteModelRate: (rate: UpstreamModelRate) => void;
  updatingKeyStatusId: string;
  deletingModelRateId: string;
}) {
  const [selectedAgentTab, setSelectedAgentTab] = React.useState<UpstreamChannelAgentTab>(selectedAgentTabProp || 'claude-code');
  const [isRatesExpanded, setIsRatesExpanded] = React.useState(true);
  const [isKeysExpanded, setIsKeysExpanded] = React.useState(true);
  const totalKeys = channel.keyCounts.shared + channel.keyCounts['claude-code'] + channel.keyCounts.codex;
  const claudeRates = channel.modelRates.filter((rate) => rate.agentType === 'claude-code');
  const codexRates = channel.modelRates.filter((rate) => rate.agentType === 'codex');
  const visibleKeys = channel.keys.filter((key) => key.agentType === 'shared' || key.agentType === selectedAgentTab);
  const visibleRates = selectedAgentTab === 'claude-code' ? claudeRates : codexRates;
  return (
    <article className="channel-card">
      <div className="channel-card-head">
        <div>
          <div className="channel-title-row">
            <button type="button" className="channel-toggle-button" onClick={onToggle} aria-expanded={isExpanded} title={isExpanded ? tr(t, 'collapseKeys', '收起 Key') : tr(t, 'expandKeys', '展开 Key')}>
              <ChevronDown size={16} className={isExpanded ? 'rotate-icon open' : 'rotate-icon'} />
            </button>
            <strong>{channel.name}</strong>
            <span className="status-pill">{tr(t, 'channelNumber', '渠道编号')} #{channel.channelNumber}</span>
            <span className="status-pill">{tr(t, 'channelPriorityShort', '优先级')} {channel.sortOrder}</span>
            <span className={channel.status === 'active' ? 'status-code ok' : 'status-code error'}>
              {channel.status === 'active' ? tr(t, 'active', '启用') : channel.status === 'banned' ? tr(t, 'banned', '封禁') : t.pause}
            </span>
            {channel.degradedUntil ? (
              <span className="status-pill warn">
                {tr(t, 'recoverAt', '恢复于')} {fullDate(channel.degradedUntil)}
              </span>
            ) : null}
          </div>
          <p>
            {tr(t, 'serverErrorRecoveryMinutes', '上游服务端错误恢复时间')}: {channel.serverErrorRecoveryMinutes} ·{' '}
            {tr(t, 'displayUsageMultiplier', '显示用量倍率')}: {channel.displayUsageMultiplier.toFixed(2)} ·{' '}
            {tr(t, 'billingRates', '计费')}: Claude {claudeRates.length} / Codex {codexRates.length}
          </p>
        </div>
        <div className="row-actions">
          {channel.status === 'banned' ? (
            <button type="button" className="secondary-button" onClick={() => onChannelStatus('active')} disabled={isChannelStatusUpdating}>
              <LoadingContent loading={isChannelStatusUpdating} icon={<ShieldCheck size={16} />} loadingLabel={tr(t, 'unbanning', '解封中...')}>
                {tr(t, 'unban', '解封')}
              </LoadingContent>
            </button>
          ) : (
            <button type="button" className="secondary-button" onClick={() => onChannelStatus('banned')} disabled={isChannelStatusUpdating}>
              <LoadingContent loading={isChannelStatusUpdating} icon={<Ban size={16} />} loadingLabel={tr(t, 'banning', '封禁中...')}>
                {tr(t, 'ban', '封禁')}
              </LoadingContent>
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClone}>
            <Copy size={16} />
            {tr(t, 'clone', '克隆')}
          </button>
          <button type="button" className="secondary-button" onClick={onEdit}>
            {tr(t, 'edit', '编辑')}
          </button>
          <button type="button" className="icon-button danger" onClick={onDelete} title={t.delete}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="channel-url-grid">
        <div>
          <span>{tr(t, 'officialWebsite', '官网地址')}</span>
          <a href={channel.websiteUrl} target="_blank" rel="noreferrer noopener">
            <code>{channel.websiteUrl}</code>
          </a>
        </div>
        <div>
          <span>{selectedAgentTab === 'claude-code' ? 'Claude Code' : 'Codex'}</span>
          <code>{selectedAgentTab === 'claude-code' ? channel.claudeApiUrl : channel.codexApiUrl}</code>
        </div>
      </div>

      <div className="channel-key-mode">
        <span>{channel.useIndependentAgentKeys ? tr(t, 'independentKeys', '独立 Key') : tr(t, 'sharedKey', '共享 Key')}</span>
        <span>{tr(t, 'totalKeys', '总数')} {totalKeys}</span>
        <span>Shared {channel.keyCounts.shared}</span>
        <span>Claude {channel.keyCounts['claude-code']}</span>
        <span>Codex {channel.keyCounts.codex}</span>
      </div>

      {isExpanded ? (
        <>
          <div className="agent-tabs channel-inner-tabs">
            <button type="button" className={selectedAgentTab === 'claude-code' ? 'agent-tab active' : 'agent-tab'} onClick={() => setSelectedAgentTab('claude-code')}>
              Claude Code
            </button>
            <button type="button" className={selectedAgentTab === 'codex' ? 'agent-tab active' : 'agent-tab'} onClick={() => setSelectedAgentTab('codex')}>
              Codex
            </button>
          </div>
          <div className="channel-subcard">
            <div className="channel-subcard-head">
              <button type="button" className="channel-subcard-toggle" onClick={() => setIsRatesExpanded((value) => !value)} aria-expanded={isRatesExpanded}>
                <ChevronDown size={16} className={isRatesExpanded ? 'rotate-icon open' : 'rotate-icon'} />
                <strong>{tr(t, 'billingModels', '计费模型')}</strong>
              </button>
              <button type="button" className="secondary-button" onClick={onAddModelRate}>
                <Plus size={15} />
                {tr(t, 'addModelRate', '新增模型计费')}
              </button>
            </div>
            {isRatesExpanded ? (
              <div className="model-rate-section">
                <div className="model-rate-groups">
                  <ModelRateGroup
                    title={selectedAgentTab === 'claude-code' ? 'Claude Code' : 'Codex'}
                    rates={visibleRates}
                    t={t}
                    onEdit={onEditModelRate}
                    onDelete={onDeleteModelRate}
                    deletingModelRateId={deletingModelRateId}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div className="channel-subcard">
            <div className="channel-subcard-head">
              <button type="button" className="channel-subcard-toggle" onClick={() => setIsKeysExpanded((value) => !value)} aria-expanded={isKeysExpanded}>
                <ChevronDown size={16} className={isKeysExpanded ? 'rotate-icon open' : 'rotate-icon'} />
                <strong>API Key</strong>
              </button>
              <button type="button" className="secondary-button" onClick={onAddKey}>
                <Plus size={15} />
                {tr(t, 'addUpstreamKey', '添加上游 Key')}
              </button>
            </div>
            {isKeysExpanded ? (
              visibleKeys.length ? (
                <div className="upstream-key-list">
                  {visibleKeys.map((key) => {
                    const isUpdatingStatus = updatingKeyStatusId === key.id;
                    return (
                      <div className="upstream-key-row" key={key.id}>
                        <div>
                          {key.name ? <span className="upstream-key-name">{key.name}</span> : null}
                          <strong>{key.keyPreview}</strong>
                          <span>{agentTypeLabel(key.agentType)}</span>
                        </div>
                        <span className={upstreamKeyStatusClassName(key)}>{upstreamKeyStatusLabel(key, t)}</span>
                        <div className="upstream-key-meta">
                          <span>
                            {tr(t, 'keyExpiresAt', '到期时间')}: {key.expiresAt ? displayDateTime(key.expiresAt) : tr(t, 'permanentKey', '永久有效')}
                          </span>
                          <span>{tr(t, 'autoResetAt', '自动重置时间')}: {upstreamKeyAutoResetDisplay(key, t)}</span>
                          <span>{key.failureReason || (key.lastUsedAt ? fullDate(key.lastUsedAt) : t.never)}</span>
                        </div>
                        <div className="row-actions">
                          <button type="button" className="secondary-button" onClick={() => onEditKey(key)}>
                            {tr(t, 'edit', '编辑')}
                          </button>
                          {key.status === 'banned' ? (
                            <button type="button" className="secondary-button" onClick={() => onKeyStatus(key, 'active')} disabled={Boolean(updatingKeyStatusId)}>
                              <LoadingContent loading={isUpdatingStatus} loadingLabel={tr(t, 'updating', '更新中...')}>
                                {tr(t, 'unban', '解封')}
                              </LoadingContent>
                            </button>
                          ) : (
                            <button type="button" className="secondary-button" onClick={() => onKeyStatus(key, 'banned')} disabled={Boolean(updatingKeyStatusId)}>
                              <LoadingContent loading={isUpdatingStatus} loadingLabel={tr(t, 'updating', '更新中...')}>
                                {tr(t, 'ban', '封禁')}
                              </LoadingContent>
                            </button>
                          )}
                          <button type="button" className="icon-button danger" onClick={() => onDeleteKey(key)} title={t.delete}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty t={t} />
              )
            ) : null}
          </div>
        </>
      ) : null}
      {channel.degradedReason ? <p className="channel-failure">{channel.degradedReason}</p> : null}
    </article>
  );
}

export function agentTypeLabel(value: UpstreamKeyAgentType) {
  if (value === 'claude-code') return 'Claude Code';
  if (value === 'codex') return 'Codex';
  return 'Shared';
}

export function ModelRateGroup({
  title,
  rates,
  t,
  onEdit,
  onDelete,
  deletingModelRateId
}: {
  title: string;
  rates: UpstreamModelRate[];
  t: Record<string, string>;
  onEdit: (rate: UpstreamModelRate) => void;
  onDelete: (rate: UpstreamModelRate) => void;
  deletingModelRateId: string;
}) {
  return (
    <div className="model-rate-group">
      <div className="model-rate-group-title">{title}</div>
      {rates.length ? (
        <div className="model-rate-list">
          {rates.map((rate) => (
            <div className="model-rate-row" key={rate.id}>
              <div>
                <strong>{rate.model}</strong>
                {rate.isDefault ? <span>{tr(t, 'defaultRate', '默认')}</span> : null}
              </div>
              <span>I {rate.inputRatePerMillion}</span>
              <span>CW {rate.cacheCreationRatePerMillion}</span>
              <span>CR {rate.cacheReadRatePerMillion}</span>
              <span>O {rate.outputRatePerMillion}</span>
              <div className="row-actions">
                <button type="button" className="secondary-button" onClick={() => onEdit(rate)}>
                  {tr(t, 'edit', '编辑')}
                </button>
                <button type="button" className="icon-button danger" onClick={() => onDelete(rate)} title={t.delete} disabled={Boolean(deletingModelRateId)}>
                  {deletingModelRateId === rate.id ? <ButtonSpinner size={16} /> : <Trash2 size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty t={t} />
      )}
    </div>
  );
}

import React from 'react';
import { showErrorToast, showSuccessToast } from '../../components/toast.js';
import { tr } from '../../i18n.js';
import type { UpstreamChannel, UpstreamChannelKey, UpstreamKeyAgentType, UpstreamKeyDeleteTarget, UpstreamKeyEditTarget } from '../../types.js';
import { unknownErrorMessage } from '../../utils/api.js';
import { dateTimeLocalToIso, dateTimeLocalValue } from '../../utils/time.js';
import { createUpstreamKey, removeUpstreamKey, updateUpstreamKey } from './channelApi.js';

export function useChannelKeys({
  headers,
  setChannels,
  t
}: {
  headers: HeadersInit;
  setChannels: React.Dispatch<React.SetStateAction<UpstreamChannel[]>>;
  t: Record<string, string>;
}) {
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
  const [keyDeleteTarget, setKeyDeleteTarget] = React.useState<UpstreamKeyDeleteTarget | null>(null);
  const [savingKey, setSavingKey] = React.useState(false);
  const [savingEditedKey, setSavingEditedKey] = React.useState(false);
  const [updatingKeyStatusId, setUpdatingKeyStatusId] = React.useState('');
  const [deletingKeyId, setDeletingKeyId] = React.useState('');

  function openAddKey(channel: UpstreamChannel) {
    setKeyTarget(channel);
    setKeyAgentType(channel.useIndependentAgentKeys ? 'claude-code' : 'shared');
    setKeyName('');
    setKeyValue('');
    setKeyExpiresAt('');
    setKeyIsPermanent(true);
  }

  async function saveKey(event: React.FormEvent) {
    event.preventDefault();
    if (!keyTarget || savingKey) return;
    setSavingKey(true);
    try {
      const payload = await createUpstreamKey({
        channel: keyTarget,
        headers,
        requestFailed: t.requestFailed,
        body: {
          name: keyName,
          key: keyValue,
          agentType: keyAgentType,
          status: 'active',
          expiresAt: keyIsPermanent ? null : dateTimeLocalToIso(keyExpiresAt)
        }
      });
      setChannels(payload.channels || []);
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
    if (!keyEditTarget || savingEditedKey) return;
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
      const payload = await updateUpstreamKey({
        channel: keyEditTarget.channel,
        key: keyEditTarget.key,
        body,
        headers,
        requestFailed: t.requestFailed
      });
      setChannels(payload.channels || []);
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
      const payload = await updateUpstreamKey({
        channel,
        key,
        body: { status },
        headers,
        requestFailed: t.requestFailed
      });
      setChannels(payload.channels || []);
      showSuccessToast(status === 'banned' ? tr(t, 'banned', '封禁') : status === 'active' ? tr(t, 'available', '可用') : t.pause);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setUpdatingKeyStatusId('');
    }
  }

  async function deleteKey(channel: UpstreamChannel, key: UpstreamChannelKey) {
    if (deletingKeyId) return;
    setDeletingKeyId(key.id);
    try {
      const payload = await removeUpstreamKey(channel, key, headers, t.requestFailed);
      setChannels(payload.channels || []);
      setKeyDeleteTarget(null);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setDeletingKeyId('');
    }
  }

  return {
    deleteKey,
    deletingKeyId,
    keyAgentType,
    keyDeleteTarget,
    keyEditExpiresAt,
    keyEditIsPermanent,
    keyEditName,
    keyEditTarget,
    keyEditValue,
    keyExpiresAt,
    keyIsPermanent,
    keyName,
    keyTarget,
    keyValue,
    openAddKey,
    openEditKey,
    saveEditedKey,
    saveKey,
    savingEditedKey,
    savingKey,
    setKeyAgentType,
    setKeyDeleteTarget,
    setKeyEditExpiresAt,
    setKeyEditIsPermanent,
    setKeyEditName,
    setKeyEditTarget,
    setKeyEditValue,
    setKeyExpiresAt,
    setKeyIsPermanent,
    setKeyName,
    setKeyTarget,
    setKeyValue,
    updateKeyStatus,
    updatingKeyStatusId
  };
}

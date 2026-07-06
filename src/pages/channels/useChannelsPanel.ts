import React from 'react';
import { showErrorToast, showSuccessToast } from '../../components/toast.js';
import { tr } from '../../i18n.js';
import type {
  UpstreamChannel,
  UpstreamModelRate,
  UpstreamModelRateTarget
} from '../../types.js';
import { unknownErrorMessage } from '../../utils/api.js';
import {
  cloneUpstreamChannel,
  fetchChannels,
  persistChannel,
  persistChannelStatus,
  persistModelRate,
  removeChannel,
  removeModelRate
} from './channelApi.js';
import { channelToForm, emptyChannelForm, emptyModelRateForm, modelRateToForm } from './channelForms.js';
import { useChannelKeys } from './useChannelKeys.js';

type UseChannelsPanelArgs = {
  headers: HeadersInit;
  refreshTick: number;
  t: Record<string, string>;
};

export function useChannelsPanel({ headers, refreshTick, t }: UseChannelsPanelArgs) {
  const [channels, setChannels] = React.useState<UpstreamChannel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isChannelOpen, setIsChannelOpen] = React.useState(false);
  const [channelForm, setChannelForm] = React.useState(emptyChannelForm);
  const [expandedChannelIds, setExpandedChannelIds] = React.useState<Set<string>>(() => new Set());
  const [modelRateTarget, setModelRateTarget] = React.useState<UpstreamModelRateTarget | null>(null);
  const [modelRateForm, setModelRateForm] = React.useState(emptyModelRateForm);
  const [cloneTarget, setCloneTarget] = React.useState<UpstreamChannel | null>(null);
  const [cloneIncludesKeys, setCloneIncludesKeys] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<UpstreamChannel | null>(null);
  const [channelStatusUpdatingId, setChannelStatusUpdatingId] = React.useState<string | null>(null);
  const [savingChannel, setSavingChannel] = React.useState(false);
  const [cloningChannelId, setCloningChannelId] = React.useState('');
  const [deletingChannelId, setDeletingChannelId] = React.useState('');
  const [savingModelRate, setSavingModelRate] = React.useState(false);
  const [deletingModelRateId, setDeletingModelRateId] = React.useState('');
  const channelKeys = useChannelKeys({ headers, setChannels, t });

  const loadChannels = React.useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchChannels(headers, t.requestFailed);
      const nextChannels = payload.channels || [];
      setChannels(nextChannels);
      setExpandedChannelIds((current) => new Set([...current].filter((id) => nextChannels.some((channel) => channel.id === id))));
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
    try {
      const payload = await persistChannel(channelForm, headers, t.requestFailed);
      setChannels(payload.channels || []);
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
      const payload = await cloneUpstreamChannel(channel, cloneIncludesKeys, headers, t.requestFailed);
      const nextChannels = payload.channels || [];
      const clonedChannel = payload.channel;
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
      const payload = await removeChannel(channel, headers, t.requestFailed);
      setChannels(payload.channels || []);
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
      const payload = await persistChannelStatus(channel, status, headers, t.requestFailed);
      setChannels(payload.channels || []);
      showSuccessToast(status === 'banned' ? tr(t, 'banned', '封禁') : tr(t, 'unban', '解封'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setChannelStatusUpdatingId((current) => (current === channel.id ? null : current));
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
    try {
      const payload = await persistModelRate({
        channel: modelRateTarget.channel,
        modelRate: modelRateTarget.rate,
        modelRateForm,
        headers,
        requestFailed: t.requestFailed
      });
      setChannels(payload.channels || []);
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
      const payload = await removeModelRate(channel, rate, headers, t.requestFailed);
      setChannels(payload.channels || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setDeletingModelRateId('');
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

  return {
    channelForm,
    channelStatusUpdatingId,
    channels,
    cloneChannel,
    cloneIncludesKeys,
    cloneTarget,
    cloningChannelId,
    deleteChannel,
    deleteModelRate,
    deleteTarget,
    deletingChannelId,
    deletingModelRateId,
    expandedChannelIds,
    isChannelOpen,
    loading,
    modelRateForm,
    modelRateTarget,
    openClone,
    openCreate,
    openEdit,
    openModelRate,
    saveChannel,
    saveModelRate,
    savingChannel,
    savingModelRate,
    setChannelForm,
    setCloneIncludesKeys,
    setCloneTarget,
    setDeleteTarget,
    setIsChannelOpen,
    setModelRateForm,
    setModelRateTarget,
    ...channelKeys,
    toggleChannel,
    updateChannelStatus
  };
}

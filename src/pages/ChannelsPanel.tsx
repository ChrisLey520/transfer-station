import { ChannelListSection } from './channels/ChannelListSection.js';
import { ChannelModalStack } from './channels/ChannelModalStack.js';
import { useChannelsPanel } from './channels/useChannelsPanel.js';

export function ChannelsPanel({ headers, refreshTick, t }: { headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const panel = useChannelsPanel({ headers, refreshTick, t });

  return (
    <section className="content-grid">
      <ChannelListSection
        channelStatusUpdatingId={panel.channelStatusUpdatingId}
        channels={panel.channels}
        deletingModelRateId={panel.deletingModelRateId}
        expandedChannelIds={panel.expandedChannelIds}
        loading={panel.loading}
        onAddKey={panel.openAddKey}
        onAddModelRate={panel.openModelRate}
        onChannelStatus={(channel, status) => void panel.updateChannelStatus(channel, status)}
        onClone={panel.openClone}
        onCreate={panel.openCreate}
        onDelete={panel.setDeleteTarget}
        onDeleteKey={(channel, key) => panel.setKeyDeleteTarget({ channel, key })}
        onDeleteModelRate={(channel, rate) => void panel.deleteModelRate(channel, rate)}
        onEdit={panel.openEdit}
        onEditKey={panel.openEditKey}
        onEditModelRate={panel.openModelRate}
        onKeyStatus={(channel, key, status) => void panel.updateKeyStatus(channel, key, status)}
        onToggle={panel.toggleChannel}
        t={t}
        updatingKeyStatusId={panel.updatingKeyStatusId}
      />
      <ChannelModalStack
        channelForm={panel.channelForm}
        cloneIncludesKeys={panel.cloneIncludesKeys}
        cloneTarget={panel.cloneTarget}
        cloningChannelId={panel.cloningChannelId}
        deleteTarget={panel.deleteTarget}
        deletingChannelId={panel.deletingChannelId}
        deletingKeyId={panel.deletingKeyId}
        isChannelOpen={panel.isChannelOpen}
        keyAgentType={panel.keyAgentType}
        keyDeleteTarget={panel.keyDeleteTarget}
        keyEditExpiresAt={panel.keyEditExpiresAt}
        keyEditIsPermanent={panel.keyEditIsPermanent}
        keyEditName={panel.keyEditName}
        keyEditTarget={panel.keyEditTarget}
        keyEditValue={panel.keyEditValue}
        keyExpiresAt={panel.keyExpiresAt}
        keyIsPermanent={panel.keyIsPermanent}
        keyName={panel.keyName}
        keyTarget={panel.keyTarget}
        keyValue={panel.keyValue}
        modelRateForm={panel.modelRateForm}
        modelRateTarget={panel.modelRateTarget}
        onClone={panel.cloneChannel}
        onDeleteChannel={panel.deleteChannel}
        onDeleteKey={(target) => panel.deleteKey(target.channel, target.key)}
        onSaveChannel={panel.saveChannel}
        onSaveEditedKey={panel.saveEditedKey}
        onSaveKey={panel.saveKey}
        onSaveModelRate={panel.saveModelRate}
        savingChannel={panel.savingChannel}
        savingEditedKey={panel.savingEditedKey}
        savingKey={panel.savingKey}
        savingModelRate={panel.savingModelRate}
        setChannelForm={panel.setChannelForm}
        setCloneIncludesKeys={panel.setCloneIncludesKeys}
        setCloneTarget={panel.setCloneTarget}
        setDeleteTarget={panel.setDeleteTarget}
        setIsChannelOpen={panel.setIsChannelOpen}
        setKeyAgentType={panel.setKeyAgentType}
        setKeyDeleteTarget={panel.setKeyDeleteTarget}
        setKeyEditExpiresAt={panel.setKeyEditExpiresAt}
        setKeyEditIsPermanent={panel.setKeyEditIsPermanent}
        setKeyEditName={panel.setKeyEditName}
        setKeyEditTarget={panel.setKeyEditTarget}
        setKeyEditValue={panel.setKeyEditValue}
        setKeyExpiresAt={panel.setKeyExpiresAt}
        setKeyIsPermanent={panel.setKeyIsPermanent}
        setKeyName={panel.setKeyName}
        setKeyTarget={panel.setKeyTarget}
        setKeyValue={panel.setKeyValue}
        setModelRateForm={panel.setModelRateForm}
        setModelRateTarget={panel.setModelRateTarget}
        t={t}
      />
    </section>
  );
}

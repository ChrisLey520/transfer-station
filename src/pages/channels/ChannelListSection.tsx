import { Empty } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { UpstreamChannel, UpstreamChannelKey, UpstreamModelRate } from '../../types.js';
import { Plus } from 'lucide-react';
import { ChannelCard } from './ChannelCard.js';

type ChannelListSectionProps = {
  channelStatusUpdatingId: string | null;
  channels: UpstreamChannel[];
  deletingModelRateId: string;
  expandedChannelIds: Set<string>;
  loading: boolean;
  onAddKey: (channel: UpstreamChannel) => void;
  onAddModelRate: (channel: UpstreamChannel) => void;
  onChannelStatus: (channel: UpstreamChannel, status: UpstreamChannel['status']) => void;
  onClone: (channel: UpstreamChannel) => void;
  onCreate: () => void;
  onDelete: (channel: UpstreamChannel) => void;
  onDeleteKey: (channel: UpstreamChannel, key: UpstreamChannelKey) => void;
  onDeleteModelRate: (channel: UpstreamChannel, rate: UpstreamModelRate) => void;
  onEdit: (channel: UpstreamChannel) => void;
  onEditKey: (channel: UpstreamChannel, key: UpstreamChannelKey) => void;
  onEditModelRate: (channel: UpstreamChannel, rate: UpstreamModelRate) => void;
  onKeyStatus: (channel: UpstreamChannel, key: UpstreamChannelKey, status: UpstreamChannelKey['status']) => void;
  onToggle: (channelId: string) => void;
  t: Record<string, string>;
  updatingKeyStatusId: string;
};

export function ChannelListSection({
  channelStatusUpdatingId,
  channels,
  deletingModelRateId,
  expandedChannelIds,
  loading,
  onAddKey,
  onAddModelRate,
  onChannelStatus,
  onClone,
  onCreate,
  onDelete,
  onDeleteKey,
  onDeleteModelRate,
  onEdit,
  onEditKey,
  onEditModelRate,
  onKeyStatus,
  onToggle,
  t,
  updatingKeyStatusId
}: ChannelListSectionProps) {
  return (
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <h2>{tr(t, 'channelManagement', '渠道管理')}</h2>
          <p>{tr(t, 'channelDescription', '配置上游渠道、Agent URL、共享或独立 API Key、故障恢复策略，以及智能调度优先级（值越小越先尝试）。')}</p>
        </div>
        <button type="button" className="primary-button" onClick={onCreate}>
          <Plus size={17} />
          {tr(t, 'createChannel', '新增渠道')}
        </button>
      </div>
      {loading ? <div className="loading-line" /> : null}
      {!channels.length ? (
        <Empty t={t}>
          <button type="button" className="primary-button" onClick={onCreate}>
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
              onToggle={() => onToggle(channel.id)}
              onEdit={() => onEdit(channel)}
              onChannelStatus={(status) => onChannelStatus(channel, status)}
              isChannelStatusUpdating={channelStatusUpdatingId === channel.id}
              onClone={() => onClone(channel)}
              onAddKey={() => onAddKey(channel)}
              onDelete={() => onDelete(channel)}
              onKeyStatus={(key, status) => onKeyStatus(channel, key, status)}
              onEditKey={(key) => onEditKey(channel, key)}
              onDeleteKey={(key) => onDeleteKey(channel, key)}
              onAddModelRate={() => onAddModelRate(channel)}
              onEditModelRate={(rate) => onEditModelRate(channel, rate)}
              onDeleteModelRate={(rate) => onDeleteModelRate(channel, rate)}
              updatingKeyStatusId={updatingKeyStatusId}
              deletingModelRateId={deletingModelRateId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

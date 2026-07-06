import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { GuideAgentId, UpstreamChannel, UpstreamChannelAgentTab, UpstreamChannelKey, UpstreamModelRate } from '../../types.js';
import { fullDate } from '../../utils/time.js';
import { Ban, ChevronDown, Copy, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import React from 'react';
import { ModelRateGroup } from './ModelRateGroup.js';
import { UpstreamKeyList } from './UpstreamKeyList.js';

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
            {isKeysExpanded ? <UpstreamKeyList keys={visibleKeys} onDelete={onDeleteKey} onEdit={onEditKey} onStatus={onKeyStatus} t={t} updatingKeyStatusId={updatingKeyStatusId} /> : null}
          </div>
        </>
      ) : null}
      {channel.degradedReason ? <p className="channel-failure">{channel.degradedReason}</p> : null}
    </article>
  );
}

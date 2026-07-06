import { Empty, LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { UpstreamChannelKey } from '../../types.js';
import { displayDateTime, fullDate } from '../../utils/time.js';
import { Trash2 } from 'lucide-react';
import { agentTypeLabel, upstreamKeyAutoResetDisplay, upstreamKeyStatusClassName, upstreamKeyStatusLabel } from './channelUtils.js';

export function UpstreamKeyList({
  keys,
  onDelete,
  onEdit,
  onStatus,
  t,
  updatingKeyStatusId
}: {
  keys: UpstreamChannelKey[];
  onDelete: (key: UpstreamChannelKey) => void;
  onEdit: (key: UpstreamChannelKey) => void;
  onStatus: (key: UpstreamChannelKey, status: UpstreamChannelKey['status']) => void;
  t: Record<string, string>;
  updatingKeyStatusId: string;
}) {
  if (!keys.length) return <Empty t={t} />;

  return (
    <div className="upstream-key-list">
      {keys.map((key) => {
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
              <button type="button" className="secondary-button" onClick={() => onEdit(key)}>
                {tr(t, 'edit', '编辑')}
              </button>
              {key.status === 'banned' ? (
                <button type="button" className="secondary-button" onClick={() => onStatus(key, 'active')} disabled={Boolean(updatingKeyStatusId)}>
                  <LoadingContent loading={isUpdatingStatus} loadingLabel={tr(t, 'updating', '更新中...')}>
                    {tr(t, 'unban', '解封')}
                  </LoadingContent>
                </button>
              ) : (
                <button type="button" className="secondary-button" onClick={() => onStatus(key, 'banned')} disabled={Boolean(updatingKeyStatusId)}>
                  <LoadingContent loading={isUpdatingStatus} loadingLabel={tr(t, 'updating', '更新中...')}>
                    {tr(t, 'ban', '封禁')}
                  </LoadingContent>
                </button>
              )}
              <button type="button" className="icon-button danger" onClick={() => onDelete(key)} title={t.delete}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import { Copy } from 'lucide-react';
import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { UpstreamChannel } from '../../types.js';
import { DangerConfirmModal, type TranslationMap } from './ChannelModalFields.js';

export function CloneChannelModal({
  cloneIncludesKeys,
  cloneTarget,
  cloningChannelId,
  setCloneIncludesKeys,
  setCloneTarget,
  onClone,
  t
}: {
  cloneIncludesKeys: boolean;
  cloneTarget: UpstreamChannel;
  cloningChannelId: string;
  setCloneIncludesKeys: (value: boolean) => void;
  setCloneTarget: (value: UpstreamChannel | null) => void;
  onClone: (channel: UpstreamChannel) => void;
  t: TranslationMap;
}) {
  return (
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
          <input type="checkbox" checked={cloneIncludesKeys} onChange={(event) => setCloneIncludesKeys(event.target.checked)} disabled={Boolean(cloningChannelId)} />
          <span>{tr(t, 'cloneApiKeyOption', '同时克隆 API Key')}</span>
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={() => setCloneTarget(null)} disabled={Boolean(cloningChannelId)}>
            {t.cancel}
          </button>
          <button type="button" className="primary-button" onClick={() => onClone(cloneTarget)} disabled={Boolean(cloningChannelId)}>
            <LoadingContent loading={cloningChannelId === cloneTarget.id} icon={<Copy size={16} />} loadingLabel={tr(t, 'cloning', '克隆中...')}>
              {tr(t, 'clone', '克隆')}
            </LoadingContent>
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteChannelModal({
  deleteTarget,
  deletingChannelId,
  setDeleteTarget,
  onDelete,
  t
}: {
  deleteTarget: UpstreamChannel;
  deletingChannelId: string;
  setDeleteTarget: (value: UpstreamChannel | null) => void;
  onDelete: (channel: UpstreamChannel) => void;
  t: TranslationMap;
}) {
  return (
    <DangerConfirmModal
      busy={deletingChannelId === deleteTarget.id}
      busyLabel={tr(t, 'deleting', '删除中...')}
      cancelLabel={t.cancel}
      confirmLabel={t.delete}
      disabled={Boolean(deletingChannelId)}
      message={deleteTarget.name}
      title={tr(t, 'deleteChannelConfirm', '确认删除这个渠道？')}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={() => onDelete(deleteTarget)}
    />
  );
}

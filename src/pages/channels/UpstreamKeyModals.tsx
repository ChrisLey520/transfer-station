import React from 'react';
import { Check, Plus } from 'lucide-react';
import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { UpstreamChannel, UpstreamKeyAgentType, UpstreamKeyDeleteTarget, UpstreamKeyEditTarget } from '../../types.js';
import { DangerConfirmModal, NumberField, PermanentKeyFields, type TranslationMap } from './ChannelModalFields.js';

export function AddUpstreamKeyModal({
  keyAgentType,
  keyExpiresAt,
  keyIsPermanent,
  keyName,
  keyPriority,
  keyTarget,
  keyValue,
  savingKey,
  setKeyAgentType,
  setKeyExpiresAt,
  setKeyIsPermanent,
  setKeyName,
  setKeyPriority,
  setKeyTarget,
  setKeyValue,
  onSubmit,
  t
}: {
  keyAgentType: UpstreamKeyAgentType;
  keyExpiresAt: string;
  keyIsPermanent: boolean;
  keyName: string;
  keyPriority: number;
  keyTarget: UpstreamChannel;
  keyValue: string;
  savingKey: boolean;
  setKeyAgentType: (value: UpstreamKeyAgentType) => void;
  setKeyExpiresAt: (value: string) => void;
  setKeyIsPermanent: (value: boolean) => void;
  setKeyName: (value: string) => void;
  setKeyPriority: (value: number) => void;
  setKeyTarget: (value: UpstreamChannel | null) => void;
  setKeyValue: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  t: TranslationMap;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel" onSubmit={onSubmit}>
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'addUpstreamKey', '添加上游 Key')}</h2>
            <p>{keyTarget.name}</p>
          </div>
        </div>
        <label>
          {tr(t, 'keyScope', 'Key 作用域')}
          <select value={keyAgentType} onChange={(event) => setKeyAgentType(event.target.value as UpstreamKeyAgentType)}>
            <option value="shared" disabled={keyTarget.useIndependentAgentKeys}>{tr(t, 'sharedKey', '共享')}</option>
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
        <NumberField label={tr(t, 'keyPriority', 'Key 优先级（越小越优先）')} value={keyPriority} min="1" step="1" onChange={(value) => setKeyPriority(Math.max(1, Math.trunc(value || 1)))} />
        <PermanentKeyFields
          checked={keyIsPermanent}
          expiresAt={keyExpiresAt}
          onCheckedChange={setKeyIsPermanent}
          onExpiresAtChange={setKeyExpiresAt}
          t={t}
        />
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
  );
}

export function EditUpstreamKeyModal({
  keyEditExpiresAt,
  keyEditIsPermanent,
  keyEditName,
  keyEditPriority,
  keyEditTarget,
  keyEditValue,
  savingEditedKey,
  setKeyEditExpiresAt,
  setKeyEditIsPermanent,
  setKeyEditName,
  setKeyEditPriority,
  setKeyEditTarget,
  setKeyEditValue,
  onSubmit,
  t
}: {
  keyEditExpiresAt: string;
  keyEditIsPermanent: boolean;
  keyEditName: string;
  keyEditPriority: number;
  keyEditTarget: UpstreamKeyEditTarget;
  keyEditValue: string;
  savingEditedKey: boolean;
  setKeyEditExpiresAt: (value: string) => void;
  setKeyEditIsPermanent: (value: boolean) => void;
  setKeyEditName: (value: string) => void;
  setKeyEditPriority: (value: number) => void;
  setKeyEditTarget: (value: UpstreamKeyEditTarget | null) => void;
  setKeyEditValue: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  t: TranslationMap;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel" onSubmit={onSubmit}>
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'editUpstreamKey', '编辑上游 Key')}</h2>
            <p>{keyEditTarget.channel.name} · {keyEditTarget.key.keyPreview}</p>
          </div>
        </div>
        <label>
          {tr(t, 'upstreamKeyName', 'Key 名称')}
          <input value={keyEditName} onChange={(event) => setKeyEditName(event.target.value)} autoFocus />
        </label>
        <label>
          API Key
          <input value={keyEditValue} onChange={(event) => setKeyEditValue(event.target.value)} placeholder={tr(t, 'leaveBlankKeepKey', '留空则不更换 Key')} />
        </label>
        <NumberField label={tr(t, 'keyPriority', 'Key 优先级（越小越优先）')} value={keyEditPriority} min="1" step="1" onChange={(value) => setKeyEditPriority(Math.max(1, Math.trunc(value || 1)))} />
        <PermanentKeyFields
          checked={keyEditIsPermanent}
          expiresAt={keyEditExpiresAt}
          onCheckedChange={setKeyEditIsPermanent}
          onExpiresAtChange={setKeyEditExpiresAt}
          t={t}
        />
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
  );
}

export function DeleteUpstreamKeyModal({
  deletingKeyId,
  keyDeleteTarget,
  setKeyDeleteTarget,
  onDelete,
  t
}: {
  deletingKeyId: string;
  keyDeleteTarget: UpstreamKeyDeleteTarget;
  setKeyDeleteTarget: (value: UpstreamKeyDeleteTarget | null) => void;
  onDelete: (target: UpstreamKeyDeleteTarget) => void;
  t: TranslationMap;
}) {
  return (
    <DangerConfirmModal
      busy={deletingKeyId === keyDeleteTarget.key.id}
      busyLabel={tr(t, 'deleting', '删除中...')}
      cancelLabel={t.cancel}
      confirmLabel={t.delete}
      disabled={Boolean(deletingKeyId)}
      message={`${keyDeleteTarget.channel.name} · ${keyDeleteTarget.key.keyPreview}`}
      title={tr(t, 'deleteUpstreamKeyConfirm', '确认删除这个上游 Key？')}
      onCancel={() => setKeyDeleteTarget(null)}
      onConfirm={() => onDelete(keyDeleteTarget)}
    />
  );
}

import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { ApiKey } from '../../types.js';
import { Play, Plus, Trash2 } from 'lucide-react';
import type React from 'react';

type CreateKeyModalProps = {
  isCreatingKey: boolean;
  name: string;
  onCancel: () => void;
  onNameChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  t: Record<string, string>;
};

export function CreateKeyModal({ isCreatingKey, name, onCancel, onNameChange, onSubmit, t }: CreateKeyModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel" onSubmit={onSubmit}>
        <div className="section-heading">
          <div>
            <h2>{t.createApiKey}</h2>
            <p>{t.createApiKeyDescription}</p>
          </div>
        </div>
        <label>
          {t.keyName}
          <input value={name} onChange={(event) => onNameChange(event.target.value)} autoFocus required />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isCreatingKey}>
            {t.cancel}
          </button>
          <button type="submit" className="primary-button" disabled={isCreatingKey}>
            <LoadingContent loading={isCreatingKey} icon={<Plus size={17} />} loadingLabel={tr(t, 'creating', '创建中...')}>
              {t.createKey}
            </LoadingContent>
          </button>
        </div>
      </form>
    </div>
  );
}

type UseKeyModalProps = {
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onSelectedAgentChange: (agent: 'claude' | 'codex') => void;
  selectedAgent: 'claude' | 'codex';
  t: Record<string, string>;
  useTarget: ApiKey;
};

export function UseKeyModal({ isImporting, onCancel, onConfirm, onSelectedAgentChange, selectedAgent, t, useTarget }: UseKeyModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel">
        <div className="section-heading">
          <div>
            <h2>{t.importToCcSwitch}</h2>
            <p>{useTarget.name || useTarget.keyPreview || '-'}</p>
          </div>
        </div>
        <div className="agent-options" role="radiogroup" aria-label={t.selectAgent}>
          <button type="button" className={selectedAgent === 'claude' ? 'agent-option active' : 'agent-option'} onClick={() => onSelectedAgentChange('claude')}>
            Claude Code
          </button>
          <button type="button" className={selectedAgent === 'codex' ? 'agent-option active' : 'agent-option'} onClick={() => onSelectedAgentChange('codex')}>
            Codex
          </button>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isImporting}>
            {t.cancel}
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={isImporting}>
            <LoadingContent loading={isImporting} icon={<Play size={16} />} loadingLabel={tr(t, 'importing', '导入中...')}>
              {t.confirmImport}
            </LoadingContent>
          </button>
        </div>
      </div>
    </div>
  );
}

type RevokeKeyModalProps = {
  isRevoking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  revokeTarget: ApiKey;
  t: Record<string, string>;
};

export function RevokeKeyModal({ isRevoking, onCancel, onConfirm, revokeTarget, t }: RevokeKeyModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel modal-panel-danger" role="dialog" aria-modal="true" aria-labelledby="delete-key-title">
        <div className="section-heading">
          <div>
            <h2 id="delete-key-title">{t.deleteConfirm}</h2>
            <p>{revokeTarget.name || revokeTarget.keyPreview || '-'}</p>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isRevoking}>
            {t.cancel}
          </button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={isRevoking}>
            <LoadingContent loading={isRevoking} icon={<Trash2 size={16} />} loadingLabel={tr(t, 'deleting', '删除中...')}>
              {t.delete}
            </LoadingContent>
          </button>
        </div>
      </div>
    </div>
  );
}

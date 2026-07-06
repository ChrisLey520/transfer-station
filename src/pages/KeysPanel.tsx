import { ButtonSpinner, Empty, LoadingContent } from '../components/common.js';
import { showErrorToast, showSuccessToast } from '../components/toast.js';
import { tr } from '../i18n.js';
import { ApiKey, Bootstrap, KeySecret, QuotaSnapshot } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { compact, currency, pct, usageColor } from '../utils/format.js';
import { fullDate } from '../utils/time.js';
import { Check, Copy, Play, Plus, Trash2 } from 'lucide-react';
import React from 'react';

export function KeysPanel({
  data,
  headers,
  reload,
  t
}: {
  data: Bootstrap;
  headers: HeadersInit;
  reload: () => Promise<void>;
  t: Record<string, string>;
}) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [useTarget, setUseTarget] = React.useState<ApiKey | null>(null);
  const [selectedAgent, setSelectedAgent] = React.useState<'claude' | 'codex'>('claude');
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [isCreatingKey, setIsCreatingKey] = React.useState(false);
  const [copyingKeyId, setCopyingKeyId] = React.useState('');
  const [importingKeyId, setImportingKeyId] = React.useState('');
  const [name, setName] = React.useState('');
  const [copiedId, setCopiedId] = React.useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isCreatingKey) return;
    setIsCreatingKey(true);
    try {
      const response = await fetch('/api/user/keys', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setIsCreateOpen(false);
      setName('');
      await reload();
      showSuccessToast(t.createdKeySuccess);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsCreatingKey(false);
    }
  }

  async function fetchSecret(id: string): Promise<KeySecret | null> {
    try {
      const response = await fetch(`/api/user/keys/${id}/secret`, { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.keyUnavailable));
        return null;
      }
      return payload as KeySecret;
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
      return null;
    }
  }

  async function revoke(apiKey: ApiKey) {
    if (isRevoking) return;
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/user/keys/${apiKey.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setRevokeTarget(null);
      await reload();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRevoking(false);
    }
  }

  async function copyExistingKey(apiKey: ApiKey) {
    if (copyingKeyId) return;
    setCopyingKeyId(apiKey.id);
    try {
      const secret = await fetchSecret(apiKey.id);
      if (!secret) return;
      await navigator.clipboard.writeText(secret.key);
      setCopiedId(apiKey.id);
      window.setTimeout(() => setCopiedId(''), 1400);
    } finally {
      setCopyingKeyId('');
    }
  }

  async function useWithCcSwitch(apiKey: ApiKey, app: 'codex' | 'claude') {
    if (importingKeyId) return;
    setImportingKeyId(apiKey.id);
    try {
      const secret = await fetchSecret(apiKey.id);
      if (!secret) return;
      window.location.href = secret.ccSwitch[app];
      setUseTarget(null);
    } finally {
      setImportingKeyId('');
    }
  }

  const isImportingUseTarget = Boolean(useTarget && importingKeyId === useTarget.id);

  return (
    <section className="content-grid">
      <section className="table-panel">
        <div className="section-heading">
          <h2>{t.keys}</h2>
          <button type="button" className="primary-button" onClick={() => setIsCreateOpen(true)}>
            <Plus size={17} />
            {t.createKey}
          </button>
        </div>
        <KeyRows
          keys={data.keys}
          t={t}
          copiedId={copiedId}
          copyingKeyId={copyingKeyId}
          onCopy={copyExistingKey}
          onUse={(apiKey) => {
            setUseTarget(apiKey);
            setSelectedAgent('claude');
          }}
          onCreate={() => setIsCreateOpen(true)}
          onRevoke={setRevokeTarget}
        />
      </section>

      {isCreateOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel" onSubmit={submit}>
            <div className="section-heading">
              <div>
                <h2>{t.createApiKey}</h2>
                <p>{t.createApiKeyDescription}</p>
              </div>
            </div>
            <label>
              {t.keyName}
              <input value={name} onChange={(event) => setName(event.target.value)} autoFocus required />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setName('');
                }}
                disabled={isCreatingKey}
              >
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
      ) : null}

      {useTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel">
            <div className="section-heading">
              <div>
                <h2>{t.importToCcSwitch}</h2>
                <p>{useTarget.name || useTarget.keyPreview || '-'}</p>
              </div>
            </div>
            <div className="agent-options" role="radiogroup" aria-label={t.selectAgent}>
              <button
                type="button"
                className={selectedAgent === 'claude' ? 'agent-option active' : 'agent-option'}
                onClick={() => setSelectedAgent('claude')}
              >
                Claude Code
              </button>
              <button
                type="button"
                className={selectedAgent === 'codex' ? 'agent-option active' : 'agent-option'}
                onClick={() => setSelectedAgent('codex')}
              >
                Codex
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setUseTarget(null)} disabled={isImportingUseTarget}>
                {t.cancel}
              </button>
              <button type="button" className="primary-button" onClick={() => useWithCcSwitch(useTarget, selectedAgent)} disabled={isImportingUseTarget}>
                <LoadingContent loading={isImportingUseTarget} icon={<Play size={16} />} loadingLabel={tr(t, 'importing', '导入中...')}>
                  {t.confirmImport}
                </LoadingContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revokeTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel modal-panel-danger" role="dialog" aria-modal="true" aria-labelledby="delete-key-title">
            <div className="section-heading">
              <div>
                <h2 id="delete-key-title">{t.deleteConfirm}</h2>
                <p>{revokeTarget.name || revokeTarget.keyPreview || '-'}</p>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setRevokeTarget(null)}
                disabled={isRevoking}
              >
                {t.cancel}
              </button>
              <button type="button" className="danger-button" onClick={() => revoke(revokeTarget)} disabled={isRevoking}>
                <LoadingContent loading={isRevoking} icon={<Trash2 size={16} />} loadingLabel={tr(t, 'deleting', '删除中...')}>
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

export function KeyRows({
  keys,
  t,
  copiedId,
  copyingKeyId,
  onCopy,
  onUse,
  onCreate,
  onRevoke
}: {
  keys: ApiKey[];
  t: Record<string, string>;
  copiedId: string;
  copyingKeyId: string;
  onCopy: (apiKey: ApiKey) => Promise<void>;
  onUse: (apiKey: ApiKey) => void;
  onCreate: () => void;
  onRevoke?: (apiKey: ApiKey) => void;
}) {
  if (!keys.length) {
    return (
      <Empty t={t} className="key-table-empty">
        <button type="button" className="primary-button" onClick={onCreate}>
          <Plus size={17} />
          {t.createKey}
        </button>
      </Empty>
    );
  }

  return (
    <div className="key-table">
      <div className="key-table-head">
        <span>{t.keyName}</span>
        <span>{t.keyValue}</span>
        <span>{t.createdAt}</span>
        <span>{t.lastUsed}</span>
        <span>{t.todayUsage}</span>
        <span>{t.action}</span>
      </div>
      {keys.map((apiKey) => {
        const isCopying = copyingKeyId === apiKey.id;
        return (
          <article className="key-table-row" key={apiKey.id}>
            <div className="key-main">
              <div>
                <strong>{apiKey.name || '-'}</strong>
              </div>
            </div>
            <div className="key-secret-cell">
              <code>{apiKey.keyPreview || '-'}</code>
              <button type="button" className="icon-button compact" onClick={() => onCopy(apiKey)} title={t.copy} disabled={Boolean(copyingKeyId)}>
                {isCopying ? <ButtonSpinner size={15} /> : copiedId === apiKey.id ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <span>{apiKey.createdAt ? fullDate(apiKey.createdAt) : '-'}</span>
            <span>{apiKey.lastUsedAt ? fullDate(apiKey.lastUsedAt) : '-'}</span>
            <span>{currency(apiKey.todayUsageCents, 'USD')}</span>
            <div className="row-actions">
              <button type="button" className="secondary-button" onClick={() => onUse(apiKey)}>
                <Play size={15} />
                {t.use}
              </button>
              <button type="button" className="icon-button danger" onClick={() => onRevoke?.(apiKey)} title={t.delete}>
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function QuotaMeters({ quota }: { quota: QuotaSnapshot }) {
  const fiveHourPct = pct(quota.fiveHourUsed, quota.fiveHourLimit);
  const weeklyPct = pct(quota.weeklyUsed, quota.weeklyLimit);
  return (
    <div className="quota-pair">
      <Meter label="5h" value={fiveHourPct} used={quota.fiveHourUsed} limit={quota.fiveHourLimit} />
      <Meter label="7d" value={weeklyPct} used={quota.weeklyUsed} limit={quota.weeklyLimit} />
    </div>
  );
}

export function Meter({ label, value, used, limit }: { label: string; value: number; used: number; limit: number }) {
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <strong>{Math.round(value)}%</strong>
      </div>
      <div className="meter-track">
        <div style={{ width: `${Math.min(value, 100)}%`, background: usageColor(value) }} />
      </div>
      <small>
        {currency(used, 'USD')} / {currency(limit, 'USD')}
      </small>
    </div>
  );
}

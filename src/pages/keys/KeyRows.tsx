import { ButtonSpinner, Empty } from '../../components/common.js';
import type { ApiKey, QuotaSnapshot } from '../../types.js';
import { currency, pct, usageColor } from '../../utils/format.js';
import { fullDate } from '../../utils/time.js';
import { Check, Copy, Play, Plus, Trash2 } from 'lucide-react';

type KeyRowsProps = {
  copiedId: string;
  copyingKeyId: string;
  keys: ApiKey[];
  onCopy: (apiKey: ApiKey) => Promise<void>;
  onCreate: () => void;
  onRevoke?: (apiKey: ApiKey) => void;
  onUse: (apiKey: ApiKey) => void;
  t: Record<string, string>;
};

export function KeyRows({ keys, t, copiedId, copyingKeyId, onCopy, onUse, onCreate, onRevoke }: KeyRowsProps) {
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

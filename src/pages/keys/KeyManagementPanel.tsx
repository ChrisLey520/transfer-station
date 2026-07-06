import type { ApiKey } from '../../types.js';
import { Plus } from 'lucide-react';
import { KeyRows } from './KeyRows.js';

export function KeyManagementPanel({
  copiedId,
  copyingKeyId,
  keys,
  onCopy,
  onCreate,
  onRevoke,
  onUse,
  t
}: {
  copiedId: string;
  copyingKeyId: string;
  keys: ApiKey[];
  onCopy: (apiKey: ApiKey) => Promise<void>;
  onCreate: () => void;
  onRevoke: (apiKey: ApiKey) => void;
  onUse: (apiKey: ApiKey) => void;
  t: Record<string, string>;
}) {
  return (
    <section className="table-panel">
      <div className="section-heading">
        <h2>{t.keys}</h2>
        <button type="button" className="primary-button" onClick={onCreate}>
          <Plus size={17} />
          {t.createKey}
        </button>
      </div>
      <KeyRows
        keys={keys}
        t={t}
        copiedId={copiedId}
        copyingKeyId={copyingKeyId}
        onCopy={onCopy}
        onUse={onUse}
        onCreate={onCreate}
        onRevoke={onRevoke}
      />
    </section>
  );
}

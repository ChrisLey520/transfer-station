import { ButtonSpinner, Empty } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { UpstreamModelRate } from '../../types.js';
import { Trash2 } from 'lucide-react';

export function ModelRateGroup({
  title,
  rates,
  t,
  onEdit,
  onDelete,
  deletingModelRateId
}: {
  title: string;
  rates: UpstreamModelRate[];
  t: Record<string, string>;
  onEdit: (rate: UpstreamModelRate) => void;
  onDelete: (rate: UpstreamModelRate) => void;
  deletingModelRateId: string;
}) {
  return (
    <div className="model-rate-group">
      <div className="model-rate-group-title">{title}</div>
      {rates.length ? (
        <div className="model-rate-list">
          {rates.map((rate) => (
            <div className="model-rate-row" key={rate.id}>
              <div>
                <strong>{rate.model}</strong>
                {rate.isDefault ? <span>{tr(t, 'defaultRate', '默认')}</span> : null}
              </div>
              <span>I {rate.inputRatePerMillion}</span>
              <span>CW {rate.cacheCreationRatePerMillion}</span>
              <span>CR {rate.cacheReadRatePerMillion}</span>
              <span>O {rate.outputRatePerMillion}</span>
              <div className="row-actions">
                <button type="button" className="secondary-button" onClick={() => onEdit(rate)}>
                  {tr(t, 'edit', '编辑')}
                </button>
                <button type="button" className="icon-button danger" onClick={() => onDelete(rate)} title={t.delete} disabled={Boolean(deletingModelRateId)}>
                  {deletingModelRateId === rate.id ? <ButtonSpinner size={16} /> : <Trash2 size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty t={t} />
      )}
    </div>
  );
}

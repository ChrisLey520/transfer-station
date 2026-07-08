import { ButtonSpinner, Empty } from '../../components/common.js';
import { DataTable } from '../../components/DataTable.js';
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
      <DataTable
        className="model-rate-list"
        headClassName="model-rate-head"
        rowClassName="model-rate-row"
        rowElement="div"
        headers={[t.model, tr(t, 'inputRateShort', '输入'), tr(t, 'cacheWriteRateShort', '缓存写入'), tr(t, 'cacheReadRateShort', '缓存读取'), tr(t, 'outputRateShort', '输出'), t.action]}
        items={rates}
        getItemKey={(rate) => rate.id}
        empty={<Empty t={t} />}
        renderRow={(rate) => (
          <>
            <div>
              <strong>{rate.model}</strong>
              {rate.isDefault ? <span>{tr(t, 'defaultRate', '默认')}</span> : null}
            </div>
            <span>{rate.inputRatePerMillion}</span>
            <span>{rate.cacheCreationRatePerMillion}</span>
            <span>{rate.cacheReadRatePerMillion}</span>
            <span>{rate.outputRatePerMillion}</span>
            <div className="row-actions">
              <button type="button" className="secondary-button" onClick={() => onEdit(rate)}>
                {tr(t, 'edit', '编辑')}
              </button>
              <button type="button" className="icon-button danger" onClick={() => onDelete(rate)} title={t.delete} disabled={Boolean(deletingModelRateId)}>
                {deletingModelRateId === rate.id ? <ButtonSpinner size={16} /> : <Trash2 size={16} />}
              </button>
            </div>
          </>
        )}
      />
    </div>
  );
}

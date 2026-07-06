import { Trash2 } from 'lucide-react';
import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';

export type TranslationMap = Record<string, string>;

export function NumberField({
  label,
  max,
  min = '0',
  onChange,
  step,
  value
}: {
  label: string;
  max?: string;
  min?: string;
  onChange: (value: number) => void;
  step?: string;
  value: number;
}) {
  return (
    <label>
      {label}
      <input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function PermanentKeyFields({
  checked,
  expiresAt,
  onCheckedChange,
  onExpiresAtChange,
  t
}: {
  checked: boolean;
  expiresAt: string;
  onCheckedChange: (value: boolean) => void;
  onExpiresAtChange: (value: string) => void;
  t: TranslationMap;
}) {
  return (
    <>
      <label className="checkbox-row">
        <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
        <span>{tr(t, 'permanentKey', '永久有效')}</span>
      </label>
      {!checked ? (
        <label>
          {tr(t, 'keyExpiresAt', '到期时间')}
          <input type="datetime-local" step="1" value={expiresAt} onChange={(event) => onExpiresAtChange(event.target.value)} required />
        </label>
      ) : null}
    </>
  );
}

export function DangerConfirmModal({
  busy,
  busyLabel,
  cancelLabel,
  confirmLabel,
  disabled,
  message,
  onCancel,
  onConfirm,
  title
}: {
  busy: boolean;
  busyLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  disabled: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel modal-panel-danger" role="dialog" aria-modal="true">
        <div className="section-heading">
          <div>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={disabled}>
            {cancelLabel}
          </button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={disabled}>
            <LoadingContent loading={busy} icon={<Trash2 size={16} />} loadingLabel={busyLabel}>
              {confirmLabel}
            </LoadingContent>
          </button>
        </div>
      </div>
    </div>
  );
}

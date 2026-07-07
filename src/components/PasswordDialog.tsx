import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { LoadingContent } from './common.js';
import { tr } from '../i18n.js';

type PasswordDialogSubmit = (values: {
  currentPassword?: string;
  newPassword: string;
}) => Promise<void> | void;

type PasswordDialogProps = {
  busy: boolean;
  hideCurrentPassword?: boolean;
  onClose: () => void;
  onSubmit: PasswordDialogSubmit;
  submitLabel: string;
  subtitle?: string;
  t: Record<string, string>;
  title: string;
};

function PasswordField({
  autoComplete,
  isVisible,
  label,
  name,
  onChange,
  onToggleVisible,
  t,
  value
}: {
  autoComplete: string;
  isVisible: boolean;
  label: string;
  name: string;
  onChange: (value: string) => void;
  onToggleVisible: () => void;
  t: Record<string, string>;
  value: string;
}) {
  return (
    <label>
      {label}
      <span className="password-input-shell">
        <input
          autoComplete={autoComplete}
          minLength={name === 'currentPassword' ? undefined : 8}
          onChange={(event) => onChange(event.target.value)}
          required
          type={isVisible ? 'text' : 'password'}
          value={value}
        />
        <button
          type="button"
          className="password-visibility-button"
          onClick={onToggleVisible}
          title={isVisible ? t.hidePassword : t.showPassword}
          aria-label={isVisible ? t.hidePassword : t.showPassword}
        >
          {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

export function PasswordDialog({
  busy,
  hideCurrentPassword = false,
  onClose,
  onSubmit,
  submitLabel,
  subtitle,
  t,
  title
}: PasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [visible, setVisible] = React.useState<Record<string, boolean>>({});
  const [formError, setFormError] = React.useState('');
  const titleId = React.useId();

  function toggleVisible(field: string) {
    setVisible((value) => ({ ...value, [field]: !value[field] }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setFormError(tr(t, 'passwordMinLength', '密码至少需要 8 位。'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError(tr(t, 'passwordConfirmMismatch', '两次输入的新密码不一致。'));
      return;
    }
    setFormError('');
    await onSubmit({
      currentPassword: hideCurrentPassword ? undefined : currentPassword,
      newPassword
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <form
        className="modal-panel password-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="section-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        {!hideCurrentPassword ? (
          <PasswordField
            autoComplete="current-password"
            isVisible={Boolean(visible.currentPassword)}
            label={tr(t, 'currentPassword', '当前密码')}
            name="currentPassword"
            value={currentPassword}
            onChange={setCurrentPassword}
            onToggleVisible={() => toggleVisible('currentPassword')}
            t={t}
          />
        ) : null}
        <PasswordField
          autoComplete="new-password"
          isVisible={Boolean(visible.newPassword)}
          label={tr(t, 'newPassword', '新密码')}
          name="newPassword"
          value={newPassword}
          onChange={setNewPassword}
          onToggleVisible={() => toggleVisible('newPassword')}
          t={t}
        />
        <PasswordField
          autoComplete="new-password"
          isVisible={Boolean(visible.confirmPassword)}
          label={tr(t, 'confirmPassword', '确认新密码')}
          name="confirmPassword"
          value={confirmPassword}
          onChange={setConfirmPassword}
          onToggleVisible={() => toggleVisible('confirmPassword')}
          t={t}
        />
        {formError ? <p className="form-error-text">{formError}</p> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            <LoadingContent loading={busy} loadingLabel={tr(t, 'saving', '保存中...')}>
              {submitLabel}
            </LoadingContent>
          </button>
        </div>
      </form>
    </div>
  );
}

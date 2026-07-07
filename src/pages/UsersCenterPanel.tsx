import { ButtonSpinner, ChevronUpIcon, LoadingContent, Tooltip } from '../components/common.js';
import { showSuccessToast } from '../components/toast.js';
import { tr } from '../i18n.js';
import type { UserListItem } from '../types.js';
import { copyTextToClipboard } from '../utils/clipboard.js';
import { currency } from '../utils/format.js';
import { formatDateTime } from '../utils/time.js';
import { PaginationBar } from './PaginationBar.js';
import { UserDetailPanel } from './users/UserDetailPanel.js';
import { useUsersCenterPanel, type UserSortField } from './users/useUsersCenterPanel.js';
import { ChevronDown, ChevronsUpDown, Copy, KeyRound } from 'lucide-react';
import React from 'react';

export { UserDetailPanel } from './users/UserDetailPanel.js';

function ResetPasswordModal({
  busy,
  generatedPassword,
  onClose,
  onConfirm,
  onCopy,
  t,
  target
}: {
  busy: boolean;
  generatedPassword: string;
  onClose: () => void;
  onConfirm: () => void;
  onCopy: () => void;
  t: Record<string, string>;
  target: UserListItem;
}) {
  const titleId = React.useId();
  const displayName = target.displayName || target.email;

  return (
    <div className="modal-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <h2 id={titleId}>{tr(t, 'resetPassword', '重置密码')}</h2>
            <p>{displayName}</p>
          </div>
        </div>
        {generatedPassword ? (
          <div className="generated-password-result">
            <p className="modal-copy success">
              {tr(t, 'resetPasswordSuccessMessage', '用户 {user} 密码重置成功，新密码为：').replace('{user}', displayName)}
            </p>
            <div className="secret-output once">
              <code>{generatedPassword}</code>
              <button type="button" onClick={onCopy}>
                <Copy size={15} />
                {tr(t, 'copyNewPassword', '复制新密码')}
              </button>
              <span>{tr(t, 'resetPasswordGeneratedHint', '请立即复制并发送给用户，关闭弹窗后不会再次展示。')}</span>
            </div>
          </div>
        ) : (
          <p className="modal-copy">
            {tr(t, 'resetPasswordConfirm', '确认将该用户的登录密码重置为随机密码？').replace('{user}', displayName)}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            {generatedPassword ? tr(t, 'close', '关闭') : t.cancel}
          </button>
          {!generatedPassword ? (
            <button type="button" className="primary-button" onClick={onConfirm} disabled={busy}>
              <LoadingContent loading={busy} loadingLabel={tr(t, 'resetting', '重置中...')}>
                {tr(t, 'confirmResetPassword', '确认重置')}
              </LoadingContent>
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function UsersCenterPanel({ headers, refreshTick, t, onOpenUser }: { headers: HeadersInit; refreshTick: number; t: Record<string, string>; onOpenUser: (userId: string) => void }) {
  const panel = useUsersCenterPanel({ headers, refreshTick, t });
  const [resetPasswordTarget, setResetPasswordTarget] = React.useState<UserListItem | null>(null);
  const [generatedPassword, setGeneratedPassword] = React.useState('');

  function SortableHeader({ field, label }: { field: UserSortField; label: string }) {
    const active = panel.sortField === field;
    return (
      <button
        type="button"
        className={active ? 'users-sort-button active' : 'users-sort-button'}
        onClick={() => panel.toggleSort(field)}
        title={`${label}${active ? (panel.sortOrder === 'desc' ? '（当前降序）' : '（当前升序）') : ''}`}
        disabled={panel.loading}
      >
        <span>{label}</span>
        {panel.sortLoadingField === field ? (
          <ButtonSpinner size={14} />
        ) : active ? (
          panel.sortOrder === 'desc' ? <ChevronDown size={14} /> : <ChevronUpIcon />
        ) : (
          <ChevronsUpDown size={14} />
        )}
      </button>
    );
  }

  return (
    <section className="content-grid">
      <section className="table-panel">
        <div className="log-filters">
          <label>
            搜索
            <input value={panel.search} onChange={(event) => panel.setSearch(event.target.value)} placeholder="ID / 用户名 / 邮箱" />
          </label>
          <button type="button" className="secondary-button" onClick={panel.submitSearch} disabled={panel.loading}>
            <LoadingContent loading={panel.isSearching} loadingLabel={tr(t, 'searching', '搜索中...')}>
              搜索
            </LoadingContent>
          </button>
        </div>
        {panel.loading ? <div className="loading-line" /> : null}
        <div className="users-table">
          <div className="users-table-head">
            <span>ID</span>
            <span>用户名</span>
            <span>邮箱</span>
            <span>当前套餐</span>
            <SortableHeader field="freeCreditCents" label="自由额度" />
            <span>套餐到期</span>
            <SortableHeader field="createdAt" label="创建时间" />
            <span>{t.action}</span>
          </div>
          {panel.pageData.users.map((user) => (
            <article className="users-table-row" key={user.id}>
              <code className="users-table-code">{user.id}</code>
              <Tooltip content={user.displayName || '-'}>
                <button type="button" className="link-button users-table-link" onClick={() => onOpenUser(user.id)}>
                  <span className="users-table-link-text">{user.displayName || '-'}</span>
                </button>
              </Tooltip>
              <Tooltip content={user.email}>
                <button type="button" className="link-button users-table-link" onClick={() => onOpenUser(user.id)}>
                  <span className="users-table-link-text">{user.email}</span>
                </button>
              </Tooltip>
              <span className="users-table-cell">{user.currentPlanName || '-'}</span>
              <span className="users-table-cell users-table-cell-strong">{currency(user.freeCreditCents, 'USD')}</span>
              <span className="users-table-cell">{user.planExpiresAt ? formatDateTime(user.planExpiresAt) : '-'}</span>
              <span className="users-table-cell">{formatDateTime(user.createdAt)}</span>
              <span className="users-table-actions">
                <button
                  type="button"
                  className="icon-button compact"
                  onClick={() => {
                    setGeneratedPassword('');
                    setResetPasswordTarget(user);
                  }}
                  disabled={Boolean(panel.resettingUserId)}
                  title={tr(t, 'resetPassword', '重置密码')}
                  aria-label={`${tr(t, 'resetPassword', '重置密码')}：${user.displayName || user.email}`}
                >
                  {panel.resettingUserId === user.id ? <ButtonSpinner size={14} /> : <KeyRound size={15} />}
                </button>
              </span>
            </article>
          ))}
        </div>
        <PaginationBar page={panel.pageData.page} pageSize={panel.pageData.pageSize} total={panel.pageData.total} onPageChange={panel.setPage} loading={panel.loading} t={t} />
      </section>
      {resetPasswordTarget ? (
        <ResetPasswordModal
          busy={panel.resettingUserId === resetPasswordTarget.id}
          generatedPassword={generatedPassword}
          onClose={() => {
            setResetPasswordTarget(null);
            setGeneratedPassword('');
          }}
          onConfirm={async () => {
            const password = await panel.resetUserPassword(resetPasswordTarget.id);
            if (password) setGeneratedPassword(password);
          }}
          onCopy={() => {
            void copyTextToClipboard(generatedPassword);
            showSuccessToast(t.copied);
          }}
          t={t}
          target={resetPasswordTarget}
        />
      ) : null}
    </section>
  );
}

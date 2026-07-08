import { ButtonSpinner, ChevronUpIcon, LoadingContent, Tooltip } from '../components/common.js';
import { DataTable } from '../components/DataTable.js';
import { showSuccessToast } from '../components/toast.js';
import { tr } from '../i18n.js';
import type { UserListItem } from '../types.js';
import { copyTextToClipboard } from '../utils/clipboard.js';
import { currency } from '../utils/format.js';
import { formatDateTime } from '../utils/time.js';
import { PaginationBar } from './PaginationBar.js';
import { UserDetailPanel } from './users/UserDetailPanel.js';
import { useUsersCenterPanel, type UserSortField } from './users/useUsersCenterPanel.js';
import { Ban, ChevronDown, ChevronsUpDown, Copy, KeyRound, Unlock } from 'lucide-react';
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

function BanUserModal({
  busy,
  onClose,
  onConfirm,
  remark,
  setRemark,
  target
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  remark: string;
  setRemark: (value: string) => void;
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
            <h2 id={titleId}>封禁用户</h2>
            <p>{displayName}</p>
          </div>
        </div>
        <p className="modal-copy">确认封禁该用户？封禁后该用户的所有密钥都不可用。</p>
        <label>
          备注
          <textarea
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder="输入封禁原因"
            maxLength={1000}
            rows={4}
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="danger-button" onClick={onConfirm} disabled={busy}>
            <LoadingContent loading={busy} loadingLabel="封禁中...">
              确认封禁
            </LoadingContent>
          </button>
        </div>
      </section>
    </div>
  );
}

export function UsersCenterPanel({ headers, refreshTick, t, onOpenUser }: { headers: HeadersInit; refreshTick: number; t: Record<string, string>; onOpenUser: (userId: string) => void }) {
  const panel = useUsersCenterPanel({ headers, refreshTick, t });
  const [resetPasswordTarget, setResetPasswordTarget] = React.useState<UserListItem | null>(null);
  const [banTarget, setBanTarget] = React.useState<UserListItem | null>(null);
  const [generatedPassword, setGeneratedPassword] = React.useState('');
  const [banRemark, setBanRemark] = React.useState('');

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

  function renderUserActions(user: UserListItem) {
    return (
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
        {user.status === 'banned' ? (
          <button
            type="button"
            className="icon-button compact"
            onClick={() => void panel.updateUserStatus(user.id, 'active')}
            disabled={Boolean(panel.updatingUserStatusId)}
            title="解封"
            aria-label={`解封：${user.displayName || user.email}`}
          >
            {panel.updatingUserStatusId === user.id ? <ButtonSpinner size={14} /> : <Unlock size={15} />}
          </button>
        ) : (
          <button
            type="button"
            className="icon-button compact danger"
            onClick={() => {
              setBanRemark(user.remark || '');
              setBanTarget(user);
            }}
            disabled={Boolean(panel.updatingUserStatusId)}
            title="封禁"
            aria-label={`封禁：${user.displayName || user.email}`}
          >
            {panel.updatingUserStatusId === user.id ? <ButtonSpinner size={14} /> : <Ban size={15} />}
          </button>
        )}
      </span>
    );
  }

  const userTableColumns = [
    { key: 'id', header: 'ID', colClassName: 'users-col-id' },
    { key: 'name', header: '用户名', colClassName: 'users-col-name' },
    { key: 'email', header: '邮箱', colClassName: 'users-col-email' },
    { key: 'status', header: '状态', colClassName: 'users-col-status' },
    { key: 'plan', header: '当前套餐', colClassName: 'users-col-plan' },
    {
      key: 'freeCreditCents',
      header: <SortableHeader field="freeCreditCents" label="自由额度" />,
      colClassName: 'users-col-credit'
    },
    { key: 'expires', header: '套餐到期', colClassName: 'users-col-expires' },
    {
      key: 'createdAt',
      header: <SortableHeader field="createdAt" label="创建时间" />,
      colClassName: 'users-col-created'
    },
    { key: 'remark', header: '备注', colClassName: 'users-col-remark' },
    {
      key: 'action',
      header: t.action,
      className: 'users-table-action-cell',
      colClassName: 'users-col-action'
    }
  ];

  return (
    <section className="content-grid">
      <section className="table-panel users-table-panel">
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
        <DataTable
          variant="table"
          className="users-table"
          tableClassName="users-table-grid"
          columns={userTableColumns}
          items={panel.pageData.users}
          getItemKey={(user) => user.id}
          renderCells={(user) => (
            <>
              <td>
                <code className="users-table-code">{user.id}</code>
              </td>
              <td>
                <Tooltip content={user.displayName || '-'}>
                  <button type="button" className="link-button users-table-link" onClick={() => onOpenUser(user.id)}>
                    <span className="users-table-link-text">{user.displayName || '-'}</span>
                  </button>
                </Tooltip>
              </td>
              <td>
                <Tooltip content={user.email}>
                  <button type="button" className="link-button users-table-link" onClick={() => onOpenUser(user.id)}>
                    <span className="users-table-link-text">{user.email}</span>
                  </button>
                </Tooltip>
              </td>
              <td>
                <span className={user.status === 'banned' ? 'status-pill danger' : 'status-pill success'}>
                  {user.status === 'banned' ? '封禁' : '正常'}
                </span>
              </td>
              <td>
                <span className="users-table-cell">{user.currentPlanName || '-'}</span>
              </td>
              <td>
                <span className="users-table-cell users-table-cell-strong">{currency(user.freeCreditCents, 'USD')}</span>
              </td>
              <td>
                <span className="users-table-cell">{user.planExpiresAt ? formatDateTime(user.planExpiresAt) : '-'}</span>
              </td>
              <td>
                <span className="users-table-cell">{formatDateTime(user.createdAt)}</span>
              </td>
              <td>
                <Tooltip content={user.remark || '-'}>
                  <span className="users-table-cell">{user.remark || '-'}</span>
                </Tooltip>
              </td>
              <td className="users-table-action-cell">{renderUserActions(user)}</td>
            </>
          )}
        />
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
      {banTarget ? (
        <BanUserModal
          busy={panel.updatingUserStatusId === banTarget.id}
          onClose={() => {
            setBanTarget(null);
            setBanRemark('');
          }}
          onConfirm={async () => {
            const user = await panel.updateUserStatus(banTarget.id, 'banned', banRemark);
            if (user) {
              setBanTarget(null);
              setBanRemark('');
            }
          }}
          remark={banRemark}
          setRemark={setBanRemark}
          target={banTarget}
        />
      ) : null}
    </section>
  );
}

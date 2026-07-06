import { ButtonSpinner, ChevronUpIcon, LoadingContent, Tooltip } from '../components/common.js';
import { tr } from '../i18n.js';
import { currency } from '../utils/format.js';
import { formatDateTime } from '../utils/time.js';
import { PaginationBar } from './PaginationBar.js';
import { UserDetailPanel } from './users/UserDetailPanel.js';
import { useUsersCenterPanel, type UserSortField } from './users/useUsersCenterPanel.js';
import { ChevronDown, ChevronsUpDown } from 'lucide-react';

export { UserDetailPanel } from './users/UserDetailPanel.js';

export function UsersCenterPanel({ headers, refreshTick, t, onOpenUser }: { headers: HeadersInit; refreshTick: number; t: Record<string, string>; onOpenUser: (userId: string) => void }) {
  const panel = useUsersCenterPanel({ headers, refreshTick, t });

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
            </article>
          ))}
        </div>
        <PaginationBar page={panel.pageData.page} pageSize={panel.pageData.pageSize} total={panel.pageData.total} onPageChange={panel.setPage} loading={panel.loading} t={t} />
      </section>
    </section>
  );
}

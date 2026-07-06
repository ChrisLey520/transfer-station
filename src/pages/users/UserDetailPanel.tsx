import React from 'react';
import { LoadingContent } from '../../components/common.js';
import { showErrorToast } from '../../components/toast.js';
import type { ClaimedOrder, GiftCardRedemptionPage, LogPage, Paginated, UserListItem } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';
import { currency } from '../../utils/format.js';
import { GiftRedemptionTable } from '../gift-cards/GiftCardTables.js';
import { LogRows } from '../logs/LogRows.js';
import { OrdersTable } from '../OrdersPanel.js';
import { PaginationBar } from '../PaginationBar.js';

export function UserDetailPanel({ headers, userId, t }: { headers: HeadersInit; userId: string; onBack: () => void; t: Record<string, string> }) {
  const [user, setUser] = React.useState<UserListItem | null>(null);
  const [tab, setTab] = React.useState<'logs' | 'claims' | 'redemptions'>('logs');
  const [giftCardType, setGiftCardType] = React.useState<'all' | 'credit' | 'plan'>('all');
  const [giftCardCode, setGiftCardCode] = React.useState('');
  const [logs, setLogs] = React.useState<LogPage>({ logs: [], total: 0, page: 1, pageSize: 20 });
  const [claims, setClaims] = React.useState<Paginated<{ orders: ClaimedOrder[] }>>({ orders: [], total: 0, page: 1, pageSize: 20 });
  const [redemptions, setRedemptions] = React.useState<GiftCardRedemptionPage>({ giftCards: [], total: 0, page: 1, pageSize: 20, days: 30 });
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [userLoading, setUserLoading] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [pendingDetailTab, setPendingDetailTab] = React.useState<'logs' | 'claims' | 'redemptions' | null>(null);

  React.useEffect(() => {
    void (async () => {
      setUserLoading(true);
      try {
        const response = await fetch(`/api/admin/users/${userId}`, { headers });
        const payload = await readJsonResponse(response);
        if (!response.ok) {
          showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
          return;
        }
        setUser((payload as { user: UserListItem }).user);
      } catch (error) {
        showErrorToast(unknownErrorMessage(error, t.requestFailed));
      } finally {
        setUserLoading(false);
      }
    })();
  }, [headers, userId, t.requestFailed]);

  React.useEffect(() => {
    setLogs((value) => ({ ...value, page: 1 }));
    setClaims((value) => ({ ...value, page: 1 }));
    setRedemptions((value) => ({ ...value, page: 1 }));
  }, [userId]);

  React.useEffect(() => {
    void (async () => {
      setDetailLoading(true);
      try {
        const endpoint = tab === 'logs'
          ? `/api/admin/users/${userId}/logs?page=${logs.page}&pageSize=${logs.pageSize}&range=30d`
          : tab === 'claims'
            ? `/api/admin/users/${userId}/order-claims?page=${claims.page}&pageSize=${claims.pageSize}&days=30&giftCardType=${giftCardType}${giftCardCode.trim() ? `&giftCardCode=${encodeURIComponent(giftCardCode.trim())}` : ''}`
            : `/api/admin/users/${userId}/gift-card-redemptions?page=${redemptions.page}&pageSize=${redemptions.pageSize}&days=30&type=${giftCardType}${giftCardCode.trim() ? `&code=${encodeURIComponent(giftCardCode.trim())}` : ''}`;
        const response = await fetch(endpoint, { headers });
        const payload = await readJsonResponse(response);
        if (!response.ok) {
          showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
          return;
        }
        if (tab === 'logs') setLogs(payload as LogPage);
        if (tab === 'claims') setClaims(payload as Paginated<{ orders: ClaimedOrder[] }>);
        if (tab === 'redemptions') setRedemptions(payload as GiftCardRedemptionPage);
        setExpandedId(null);
      } catch (error) {
        showErrorToast(unknownErrorMessage(error, t.requestFailed));
      } finally {
        setDetailLoading(false);
        setPendingDetailTab(null);
      }
    })();
  }, [claims.page, claims.pageSize, giftCardCode, giftCardType, headers, logs.page, logs.pageSize, redemptions.page, redemptions.pageSize, tab, t.requestFailed, userId]);

  function changeUserDetailTab(nextTab: 'logs' | 'claims' | 'redemptions') {
    if (detailLoading || tab === nextTab) return;
    setPendingDetailTab(nextTab);
    setTab(nextTab);
    if (nextTab === 'logs') setLogs((value) => ({ ...value, page: 1 }));
    if (nextTab === 'claims') setClaims((value) => ({ ...value, page: 1 }));
    if (nextTab === 'redemptions') setRedemptions((value) => ({ ...value, page: 1 }));
  }

  return (
    <section className="content-grid">
      <section className="table-panel">
        <div className="panel-head panel-head-detail">
          <div>
            <h3>{user?.displayName || user?.email || userId}</h3>
            <p>{user?.email || ''} · {user?.currentPlanName || '-'} · 自由额度 {user ? currency(user.freeCreditCents, 'USD') : '-'}</p>
          </div>
        </div>
        <div className="log-type-tabs" role="tablist" aria-label="用户详情分页">
          <button type="button" role="tab" aria-selected={tab === 'logs'} className={tab === 'logs' ? 'log-type-tab active' : 'log-type-tab'} onClick={() => changeUserDetailTab('logs')} disabled={detailLoading}>
            <LoadingContent loading={pendingDetailTab === 'logs'} loadingLabel="30天使用日志">
              30天使用日志
            </LoadingContent>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'claims'} className={tab === 'claims' ? 'log-type-tab active' : 'log-type-tab'} onClick={() => changeUserDetailTab('claims')} disabled={detailLoading}>
            <LoadingContent loading={pendingDetailTab === 'claims'} loadingLabel="礼品码领取记录">
              礼品码领取记录
            </LoadingContent>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'redemptions'} className={tab === 'redemptions' ? 'log-type-tab active' : 'log-type-tab'} onClick={() => changeUserDetailTab('redemptions')} disabled={detailLoading}>
            <LoadingContent loading={pendingDetailTab === 'redemptions'} loadingLabel="礼品码兑换记录">
              礼品码兑换记录
            </LoadingContent>
          </button>
        </div>
        {tab === 'claims' || tab === 'redemptions' ? (
          <div className="log-filters">
            <label>
              类型
              <select value={giftCardType} onChange={(event) => {
                setGiftCardType(event.target.value as 'all' | 'credit' | 'plan');
                if (tab === 'claims') setClaims((value) => ({ ...value, page: 1 }));
                if (tab === 'redemptions') setRedemptions((value) => ({ ...value, page: 1 }));
              }}>
                <option value="all">全部类型</option>
                <option value="plan">套餐</option>
                <option value="credit">余额</option>
              </select>
            </label>
            <label>
              礼品码
              <input value={giftCardCode} onChange={(event) => {
                setGiftCardCode(event.target.value);
                if (tab === 'claims') setClaims((value) => ({ ...value, page: 1 }));
                if (tab === 'redemptions') setRedemptions((value) => ({ ...value, page: 1 }));
              }} placeholder="输入礼品码搜索" />
            </label>
          </div>
        ) : null}
        {userLoading || detailLoading ? <div className="loading-line" /> : null}
        {tab === 'logs' ? <LogRows logs={logs.logs} t={t} expandedId={expandedId} setExpandedId={setExpandedId} /> : null}
        {tab === 'claims' ? <OrdersTable orders={claims.orders} /> : null}
        {tab === 'redemptions' ? <GiftRedemptionTable giftCards={redemptions.giftCards} /> : null}
        {tab === 'logs' ? <PaginationBar page={logs.page} pageSize={logs.pageSize} total={logs.total} onPageChange={(next) => setLogs((value) => ({ ...value, page: next }))} loading={detailLoading} t={t} /> : null}
        {tab === 'claims' ? <PaginationBar page={claims.page} pageSize={claims.pageSize} total={claims.total} onPageChange={(next) => setClaims((value) => ({ ...value, page: next }))} loading={detailLoading} t={t} /> : null}
        {tab === 'redemptions' ? <PaginationBar page={redemptions.page} pageSize={redemptions.pageSize} total={redemptions.total} onPageChange={(next) => setRedemptions((value) => ({ ...value, page: next }))} loading={detailLoading} t={t} /> : null}
      </section>
    </section>
  );
}

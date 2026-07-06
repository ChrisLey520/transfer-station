import { LoadingContent } from '../components/common.js';
import type { ApiKey, LogRange, LogStatus } from '../types.js';
import { GiftRedemptionTable } from './gift-cards/GiftCardTables.js';
import { LogRows } from './logs/LogRows.js';
import { useLogsPanel, type GiftCardLogType } from './logs/useLogsPanel.js';
import { OrdersTable } from './OrdersPanel.js';
import { PaginationBar } from './PaginationBar.js';

export { LogRows } from './logs/LogRows.js';

export function LogsPanel({ keys, headers, refreshTick, t }: { keys: ApiKey[]; headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const panel = useLogsPanel({ headers, refreshTick, t });

  return (
    <section className="content-grid">
      <div className="log-type-tabs" role="tablist" aria-label="日志分页">
        <button
          type="button"
          role="tab"
          aria-selected={panel.tab === 'usage'}
          className={panel.tab === 'usage' ? 'log-type-tab active' : 'log-type-tab'}
          onClick={() => panel.changeLogTab('usage')}
          disabled={panel.loading}
        >
          <LoadingContent loading={panel.pendingTab === 'usage'} loadingLabel="消费日志">
            消费日志
          </LoadingContent>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel.tab === 'claims'}
          className={panel.tab === 'claims' ? 'log-type-tab active' : 'log-type-tab'}
          onClick={() => panel.changeLogTab('claims')}
          disabled={panel.loading}
        >
          <LoadingContent loading={panel.pendingTab === 'claims'} loadingLabel="礼品码记录">
            礼品码记录
          </LoadingContent>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={panel.tab === 'redemptions'}
          className={panel.tab === 'redemptions' ? 'log-type-tab active' : 'log-type-tab'}
          onClick={() => panel.changeLogTab('redemptions')}
          disabled={panel.loading}
        >
          <LoadingContent loading={panel.pendingTab === 'redemptions'} loadingLabel="兑换记录">
            兑换记录
          </LoadingContent>
        </button>
      </div>
      <div className="log-filters">
        {panel.tab === 'usage' ? (
          <>
            <label>
              {t.logKey}
              <select value={panel.apiKeyId} onChange={(event) => panel.updateApiKey(event.target.value)}>
                <option value="all">{t.allKeys}</option>
                {keys.map((apiKey) => (
                  <option value={apiKey.id} key={apiKey.id}>
                    {apiKey.name || apiKey.keyPreview || apiKey.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.status}
              <select value={panel.status} onChange={(event) => panel.updateStatus(event.target.value as LogStatus)}>
                <option value="all">{t.allStatuses}</option>
                <option value="success">{t.successOnly}</option>
                <option value="failed">{t.failedOnly}</option>
              </select>
            </label>
            <label>
              {t.timeRange}
              <select value={panel.range} onChange={(event) => panel.updateRange(event.target.value as LogRange)}>
                <option value="24h">{t.last24Hours}</option>
                <option value="3d">{t.last3Days}</option>
                <option value="7d">{t.last7Days}</option>
                <option value="30d">{t.last30Days}</option>
              </select>
            </label>
          </>
        ) : null}
        {panel.tab === 'claims' || panel.tab === 'redemptions' ? (
          <>
            <label>
              类型
              <select value={panel.giftCardType} onChange={(event) => panel.updateGiftCardType(event.target.value as GiftCardLogType)}>
                <option value="all">全部类型</option>
                <option value="plan">套餐</option>
                <option value="credit">余额</option>
              </select>
            </label>
            <label>
              礼品码
              <input value={panel.giftCardCode} onChange={(event) => panel.updateGiftCardCode(event.target.value)} placeholder="输入礼品码搜索" />
            </label>
          </>
        ) : null}
      </div>
      <section className="table-panel">
        {panel.loading ? <div className="loading-line" /> : null}
        {panel.tab === 'usage' ? <LogRows logs={panel.logPage.logs} t={t} expandedId={panel.expandedId} setExpandedId={panel.setExpandedId} /> : null}
        {panel.tab === 'claims' ? <OrdersTable orders={panel.claimPage.orders} /> : null}
        {panel.tab === 'redemptions' ? <GiftRedemptionTable giftCards={panel.redemptionPage.giftCards} /> : null}
        {panel.tab === 'usage' ? <PaginationBar page={panel.usagePage} pageSize={panel.logPage.pageSize} total={panel.logPage.total} onPageChange={panel.setUsagePage} loading={panel.loading} t={t} /> : null}
        {panel.tab === 'claims' ? <PaginationBar page={panel.claimsPage} pageSize={panel.claimPage.pageSize} total={panel.claimPage.total} onPageChange={panel.setClaimsPage} loading={panel.loading} t={t} /> : null}
        {panel.tab === 'redemptions' ? <PaginationBar page={panel.redemptionsPage} pageSize={panel.redemptionPage.pageSize} total={panel.redemptionPage.total} onPageChange={panel.setRedemptionsPage} loading={panel.loading} t={t} /> : null}
      </section>
    </section>
  );
}

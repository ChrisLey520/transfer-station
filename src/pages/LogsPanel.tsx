import { BreakdownItem, Empty, LoadingContent, MetricBreakdownItem } from '../components/common.js';
import { showErrorToast } from '../components/toast.js';
import { tr } from '../i18n.js';
import { ApiKey, ClaimedOrder, GiftCardRedemptionPage, LogPage, LogRange, LogStatus, Paginated, UsageLog } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { currency, percent } from '../utils/format.js';
import { fullDate } from '../utils/time.js';
import { GiftRedemptionTable } from './GiftCardsPanel.js';
import { OrdersTable } from './OrdersPanel.js';
import { PaginationBar } from './PaginationBar.js';
import { ChevronDown } from 'lucide-react';
import React from 'react';

export function LogsPanel({ keys, headers, refreshTick, t }: { keys: ApiKey[]; headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const [tab, setTab] = React.useState<'usage' | 'claims' | 'redemptions'>('usage');
  const [status, setStatus] = React.useState<LogStatus>('all');
  const [apiKeyId, setApiKeyId] = React.useState('all');
  const [range, setRange] = React.useState<LogRange>('24h');
  const [giftCardType, setGiftCardType] = React.useState<'all' | 'credit' | 'plan'>('all');
  const [giftCardCode, setGiftCardCode] = React.useState('');
  const [usagePage, setUsagePage] = React.useState(1);
  const [claimsPage, setClaimsPage] = React.useState(1);
  const [redemptionsPage, setRedemptionsPage] = React.useState(1);
  const [logPage, setLogPage] = React.useState<LogPage>({ logs: [], total: 0, page: 1, pageSize: 20 });
  const [claimPage, setClaimPage] = React.useState<Paginated<{ orders: ClaimedOrder[] }>>({ orders: [], total: 0, page: 1, pageSize: 20 });
  const [redemptionPage, setRedemptionPage] = React.useState<GiftCardRedemptionPage>({ giftCards: [], total: 0, page: 1, pageSize: 20, days: 30 });
  const [loading, setLoading] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState<'usage' | 'claims' | 'redemptions' | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const loadLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const currentPage = tab === 'usage' ? usagePage : tab === 'claims' ? claimsPage : redemptionsPage;
      const params = new URLSearchParams({ page: String(currentPage) });
      let response: Response;
      if (tab === 'usage') {
        params.set('pageSize', String(logPage.pageSize));
        params.set('status', status);
        params.set('range', range);
        if (apiKeyId !== 'all') params.set('apiKeyId', apiKeyId);
        response = await fetch(`/api/user/logs?${params.toString()}`, { headers });
      } else if (tab === 'claims') {
        params.set('pageSize', String(claimPage.pageSize));
        params.set('days', '30');
        params.set('giftCardType', giftCardType);
        if (giftCardCode.trim()) params.set('giftCardCode', giftCardCode.trim());
        response = await fetch(`/api/user/orders/claims?${params.toString()}`, { headers });
      } else {
        params.set('pageSize', String(redemptionPage.pageSize));
        params.set('days', '30');
        params.set('type', giftCardType);
        if (giftCardCode.trim()) params.set('code', giftCardCode.trim());
        response = await fetch(`/api/user/gift-card-redemptions?${params.toString()}`, { headers });
      }
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      if (tab === 'usage') setLogPage(payload as LogPage);
      if (tab === 'claims') setClaimPage(payload as Paginated<{ orders: ClaimedOrder[] }>);
      if (tab === 'redemptions') setRedemptionPage(payload as GiftCardRedemptionPage);
      setExpandedId(null);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
      setPendingTab(null);
    }
  }, [apiKeyId, claimsPage, giftCardCode, giftCardType, headers, claimPage.pageSize, logPage.pageSize, range, redemptionPage.pageSize, redemptionsPage, status, t.requestFailed, tab, usagePage]);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs, refreshTick]);

  function updateStatus(value: LogStatus) {
    setStatus(value);
    setUsagePage(1);
  }

  function updateApiKey(value: string) {
    setApiKeyId(value);
    setUsagePage(1);
  }

  function updateRange(value: LogRange) {
    setRange(value);
    setUsagePage(1);
  }

  function updateGiftCardType(value: 'all' | 'credit' | 'plan') {
    setGiftCardType(value);
    if (tab === 'claims') setClaimsPage(1);
    if (tab === 'redemptions') setRedemptionsPage(1);
  }

  function updateGiftCardCode(value: string) {
    setGiftCardCode(value);
    if (tab === 'claims') setClaimsPage(1);
    if (tab === 'redemptions') setRedemptionsPage(1);
  }

  function changeLogTab(nextTab: 'usage' | 'claims' | 'redemptions') {
    if (loading || tab === nextTab) return;
    setPendingTab(nextTab);
    setTab(nextTab);
  }

  return (
    <section className="content-grid">
      <div className="log-type-tabs" role="tablist" aria-label="日志分页">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'usage'}
          className={tab === 'usage' ? 'log-type-tab active' : 'log-type-tab'}
          onClick={() => changeLogTab('usage')}
          disabled={loading}
        >
          <LoadingContent loading={pendingTab === 'usage'} loadingLabel="消费日志">
            消费日志
          </LoadingContent>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'claims'}
          className={tab === 'claims' ? 'log-type-tab active' : 'log-type-tab'}
          onClick={() => changeLogTab('claims')}
          disabled={loading}
        >
          <LoadingContent loading={pendingTab === 'claims'} loadingLabel="礼品码记录">
            礼品码记录
          </LoadingContent>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'redemptions'}
          className={tab === 'redemptions' ? 'log-type-tab active' : 'log-type-tab'}
          onClick={() => changeLogTab('redemptions')}
          disabled={loading}
        >
          <LoadingContent loading={pendingTab === 'redemptions'} loadingLabel="兑换记录">
            兑换记录
          </LoadingContent>
        </button>
      </div>
      <div className="log-filters">
        {tab === 'usage' ? (
          <>
            <label>
              {t.logKey}
              <select value={apiKeyId} onChange={(event) => updateApiKey(event.target.value)}>
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
              <select value={status} onChange={(event) => updateStatus(event.target.value as LogStatus)}>
                <option value="all">{t.allStatuses}</option>
                <option value="success">{t.successOnly}</option>
                <option value="failed">{t.failedOnly}</option>
              </select>
            </label>
            <label>
              {t.timeRange}
              <select value={range} onChange={(event) => updateRange(event.target.value as LogRange)}>
                <option value="24h">{t.last24Hours}</option>
                <option value="3d">{t.last3Days}</option>
                <option value="7d">{t.last7Days}</option>
                <option value="30d">{t.last30Days}</option>
              </select>
            </label>
          </>
        ) : null}
        {tab === 'claims' || tab === 'redemptions' ? (
          <>
            <label>
              类型
              <select value={giftCardType} onChange={(event) => updateGiftCardType(event.target.value as 'all' | 'credit' | 'plan')}>
                <option value="all">全部类型</option>
                <option value="plan">套餐</option>
                <option value="credit">余额</option>
              </select>
            </label>
            <label>
              礼品码
              <input value={giftCardCode} onChange={(event) => updateGiftCardCode(event.target.value)} placeholder="输入礼品码搜索" />
            </label>
          </>
        ) : null}
      </div>
      <section className="table-panel">
        {loading ? <div className="loading-line" /> : null}
        {tab === 'usage' ? <LogRows logs={logPage.logs} t={t} expandedId={expandedId} setExpandedId={setExpandedId} /> : null}
        {tab === 'claims' ? <OrdersTable orders={claimPage.orders} /> : null}
        {tab === 'redemptions' ? <GiftRedemptionTable giftCards={redemptionPage.giftCards} /> : null}
        {tab === 'usage' ? <PaginationBar page={usagePage} pageSize={logPage.pageSize} total={logPage.total} onPageChange={setUsagePage} loading={loading} t={t} /> : null}
        {tab === 'claims' ? <PaginationBar page={claimsPage} pageSize={claimPage.pageSize} total={claimPage.total} onPageChange={setClaimsPage} loading={loading} t={t} /> : null}
        {tab === 'redemptions' ? <PaginationBar page={redemptionsPage} pageSize={redemptionPage.pageSize} total={redemptionPage.total} onPageChange={setRedemptionsPage} loading={loading} t={t} /> : null}
      </section>
    </section>
  );
}

export function LogRows({
  logs,
  t,
  compactMode,
  expandedId,
  setExpandedId
}: {
  logs: UsageLog[];
  t: Record<string, string>;
  compactMode?: boolean;
  expandedId?: string | null;
  setExpandedId?: (id: string | null) => void;
}) {
  if (!logs.length) return <Empty t={t} />;

  return (
    <div className="log-list">
      {!compactMode ? (
        <div className="log-head" aria-hidden="true">
          <span>{t.model}</span>
          <span>{tr(t, 'channelNumber', '渠道编号')}</span>
          <span>{t.costUsage}</span>
          <span>{t.status}</span>
          <span>{t.requestTime}</span>
          <span>{t.latency}</span>
        </div>
      ) : null}
      {logs.map((log) => {
        const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
        const isExpanded = expandedId === log.id;
        const toggle = () => setExpandedId?.(isExpanded ? null : log.id);
        const cacheBase = log.inputTokens + log.cacheCreationInputTokens + log.cacheReadInputTokens;
        const cacheHitRate = cacheBase ? log.cacheReadInputTokens / cacheBase : 0;

        return (
          <article className="log-record" key={log.id}>
            <button type="button" className="log-summary" onClick={toggle} aria-expanded={isExpanded}>
              {!compactMode ? <ChevronDown className={isExpanded ? 'log-expand-indicator open' : 'log-expand-indicator'} size={16} /> : null}
              <div>
                <strong>{log.model}</strong>
              </div>
              <span>{log.channelNumber ? `#${log.channelNumber}` : '-'}</span>
              <span className="log-cost">{currency(log.totalCostCents, 'USD')}</span>
              <span className={isSuccess ? 'status-code ok' : 'status-code error'}>{isSuccess ? t.success : t.failed}</span>
              <span>{fullDate(log.createdAt)}</span>
              <span>{log.latencyMs}ms</span>
            </button>

            {isExpanded && !compactMode ? (
              <div className="log-detail">
                {isSuccess ? (
                  <div className="cost-breakdown">
                    <BreakdownItem label={t.input} tokens={log.inputTokens} cents={log.inputCostCents} />
                    <BreakdownItem label={t.output} tokens={log.outputTokens} cents={log.outputCostCents} />
                    <BreakdownItem
                      label={t.cacheCreation}
                      tokens={log.cacheCreationInputTokens}
                      cents={log.cacheCreationCostCents}
                    />
                    <BreakdownItem label={t.cacheHit} tokens={log.cacheReadInputTokens} cents={log.cacheReadCostCents} />
                    <MetricBreakdownItem label={tr(t, 'requestCacheHitRate', '本次缓存命中率')} value={percent(cacheHitRate)} />
                  </div>
                ) : (
                  <div className="failure-detail">
                    <span>{t.failureReason}</span>
                    <strong>{log.errorMessage || '-'}</strong>
                  </div>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

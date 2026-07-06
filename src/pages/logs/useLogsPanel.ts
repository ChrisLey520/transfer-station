import React from 'react';
import { showErrorToast } from '../../components/toast.js';
import type { ClaimedOrder, GiftCardRedemptionPage, LogPage, LogRange, LogStatus, Paginated } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';

export type LogsPanelTab = 'usage' | 'claims' | 'redemptions';
export type GiftCardLogType = 'all' | 'credit' | 'plan';

export function useLogsPanel({ headers, refreshTick, t }: { headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const [tab, setTab] = React.useState<LogsPanelTab>('usage');
  const [status, setStatus] = React.useState<LogStatus>('all');
  const [apiKeyId, setApiKeyId] = React.useState('all');
  const [range, setRange] = React.useState<LogRange>('24h');
  const [giftCardType, setGiftCardType] = React.useState<GiftCardLogType>('all');
  const [giftCardCode, setGiftCardCode] = React.useState('');
  const [usagePage, setUsagePage] = React.useState(1);
  const [claimsPage, setClaimsPage] = React.useState(1);
  const [redemptionsPage, setRedemptionsPage] = React.useState(1);
  const [logPage, setLogPage] = React.useState<LogPage>({ logs: [], total: 0, page: 1, pageSize: 20 });
  const [claimPage, setClaimPage] = React.useState<Paginated<{ orders: ClaimedOrder[] }>>({ orders: [], total: 0, page: 1, pageSize: 20 });
  const [redemptionPage, setRedemptionPage] = React.useState<GiftCardRedemptionPage>({ giftCards: [], total: 0, page: 1, pageSize: 20, days: 30 });
  const [loading, setLoading] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState<LogsPanelTab | null>(null);
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

  function updateGiftCardType(value: GiftCardLogType) {
    setGiftCardType(value);
    if (tab === 'claims') setClaimsPage(1);
    if (tab === 'redemptions') setRedemptionsPage(1);
  }

  function updateGiftCardCode(value: string) {
    setGiftCardCode(value);
    if (tab === 'claims') setClaimsPage(1);
    if (tab === 'redemptions') setRedemptionsPage(1);
  }

  function changeLogTab(nextTab: LogsPanelTab) {
    if (loading || tab === nextTab) return;
    setPendingTab(nextTab);
    setTab(nextTab);
  }

  return {
    apiKeyId,
    changeLogTab,
    claimPage,
    claimsPage,
    expandedId,
    giftCardCode,
    giftCardType,
    loading,
    logPage,
    pendingTab,
    range,
    redemptionPage,
    redemptionsPage,
    setClaimsPage,
    setExpandedId,
    setRedemptionsPage,
    setUsagePage,
    status,
    tab,
    updateApiKey,
    updateGiftCardCode,
    updateGiftCardType,
    updateRange,
    updateStatus,
    usagePage
  };
}

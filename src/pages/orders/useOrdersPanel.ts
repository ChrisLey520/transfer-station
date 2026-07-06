import { showErrorToast, showSuccessToast } from '../../components/toast.js';
import { tr } from '../../i18n.js';
import type { ClaimedOrder } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';
import { copyTextToClipboard } from '../../utils/clipboard.js';
import React from 'react';

export function useOrdersPanel({ headers, refreshTick, t }: { headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const [orderId, setOrderId] = React.useState('');
  const [claimResult, setClaimResult] = React.useState<ClaimedOrder[]>([]);
  const [claimedOrders, setClaimedOrders] = React.useState<ClaimedOrder[]>([]);
  const [isClaiming, setIsClaiming] = React.useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState('');

  const loadClaimHistory = React.useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/user/orders/claims?days=30', { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setClaimedOrders((payload as { orders: ClaimedOrder[] }).orders || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [headers, t.requestFailed]);

  React.useEffect(() => {
    void loadClaimHistory();
  }, [loadClaimHistory, refreshTick]);

  async function claim(event: React.FormEvent) {
    event.preventDefault();
    setIsClaiming(true);
    setClaimResult([]);
    try {
      const response = await fetch('/api/user/orders/claim', {
        method: 'POST',
        headers,
        body: JSON.stringify({ orderId })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setClaimResult((payload as { orders: ClaimedOrder[] }).orders || []);
      showSuccessToast(tr(t, 'claimSuccess', '兑换码已领取。'));
      await loadClaimHistory();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsClaiming(false);
    }
  }

  async function copyCodes(orders: ClaimedOrder[], key: string) {
    const codes = orders
      .map((order) => order.giftCardCode)
      .filter(Boolean)
      .join('\n');
    if (!codes) return;
    await copyTextToClipboard(codes);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1400);
  }

  function statusLabel(status: ClaimedOrder['deliveryStatus']) {
    return tr(t, `deliveryStatus_${status}`, status);
  }

  return {
    claim,
    claimedOrders,
    claimResult,
    copiedKey,
    copyCodes,
    isClaiming,
    isLoadingHistory,
    loadClaimHistory,
    orderId,
    setOrderId,
    statusLabel
  };
}

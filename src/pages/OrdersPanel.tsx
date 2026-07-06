import { Empty, LoadingContent } from '../components/common.js';
import { showErrorToast, showSuccessToast } from '../components/toast.js';
import { tr } from '../i18n.js';
import { ClaimedOrder } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { copyTextToClipboard } from '../utils/clipboard.js';
import { formatDateTime, fullDate } from '../utils/time.js';
import { Check, Copy, RefreshCcw } from 'lucide-react';
import React from 'react';

export function OrdersPanel({ headers, refreshTick, t }: { headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
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
    const codes = orders.map((order) => order.giftCardCode).filter(Boolean).join('\n');
    if (!codes) return;
    await copyTextToClipboard(codes);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(''), 1400);
  }

  function orderKey(order: ClaimedOrder) {
    return `${order.platform}:${order.orderId}:${order.subOrderId}`;
  }

  function statusLabel(status: ClaimedOrder['deliveryStatus']) {
    return tr(t, `deliveryStatus_${status}`, status);
  }

  return (
    <div className="orders-panel">
      <section className="table-panel">
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'claimOrderTitle', '订单取码')}</h2>
            <p>{tr(t, 'claimOrderHint', '输入已付款订单号，领取系统自动生成的兑换码。')}</p>
          </div>
        </div>
        <form className="claim-form" onSubmit={claim}>
          <input
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder={tr(t, 'orderNumberPlaceholder', '请输入订单号')}
            aria-label={tr(t, 'orderNumber', '订单号')}
            required
          />
          <button type="submit" className="primary-button" disabled={isClaiming || !orderId.trim()}>
            <LoadingContent loading={isClaiming} loadingLabel={tr(t, 'verifying', '验证中...')}>
              {tr(t, 'claimOrderCode', '领取兑换码')}
            </LoadingContent>
          </button>
        </form>
        {claimResult.length ? (
          <div className="claim-result">
            <div className="generated-gift-cards-head">
              <strong>{tr(t, 'giftCards', '礼品码')}</strong>
              <button type="button" className="secondary-button" onClick={() => void copyCodes(claimResult, 'claim-result')}>
                {copiedKey === 'claim-result' ? <Check size={15} /> : <Copy size={15} />}
                {copiedKey === 'claim-result' ? tr(t, 'copiedCodes', '已复制兑换码') : tr(t, 'copyCodes', '复制兑换码')}
              </button>
            </div>
            {claimResult.map((order) => (
              <article className="claim-code-row" key={orderKey(order)}>
                <span>{order.title || order.subOrderId}</span>
                <code>{order.giftCardCode}</code>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="table-panel">
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'claimRecordTitle', '领取记录')}</h2>
            <p>{tr(t, 'claimRecordHint', '仅展示近 30 天内由当前账号领取的订单。')}</p>
          </div>
          <button type="button" className="secondary-button" onClick={() => void loadClaimHistory()} disabled={isLoadingHistory}>
            <LoadingContent loading={isLoadingHistory} icon={<RefreshCcw size={16} />} loadingLabel={tr(t, 'refreshing', '刷新中...')}>
              {t.refresh}
            </LoadingContent>
          </button>
        </div>
        {isLoadingHistory ? <div className="loading-line" /> : null}
        {claimedOrders.length ? (
          <div className="order-history-table">
            <div className="order-history-head">
              <span>{tr(t, 'orderNumber', '订单号')}</span>
              <span>{tr(t, 'taobao', '淘宝')}</span>
              <span>{tr(t, 'orderItem', '商品')}</span>
              <span>{tr(t, 'giftCards', '礼品码')}</span>
              <span>{tr(t, 'claimTime', '领取时间')}</span>
              <span>{t.status}</span>
              <span>{t.copy}</span>
            </div>
            {claimedOrders.map((order) => {
              const key = orderKey(order);
              return (
                <article className="order-history-row" key={key}>
                  <strong>{order.orderId}</strong>
                  <span>{t[order.platform] || order.platform}</span>
                  <span>{order.title || order.subOrderId}</span>
                  <code>{order.giftCardCode || '-'}</code>
                  <span>{order.claimedAt ? fullDate(order.claimedAt) : '-'}</span>
                  <span className={order.deliveryStatus === 'claimed' ? 'status-code ok' : 'status-code'}>
                    {statusLabel(order.deliveryStatus)}
                  </span>
                  <button type="button" className="icon-button" onClick={() => void copyCodes([order], key)} title={t.copy}>
                    {copiedKey === key ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty t={t} />
        )}
      </section>
    </div>
  );
}

export function OrdersTable({ orders }: { orders: ClaimedOrder[] }) {
  if (!orders.length) return <div className="table-empty">暂无记录</div>;
  return (
    <div className="gift-card-table">
      <div className="gift-card-table-head">
        <span>ID</span>
        <span>商品</span>
        <span>礼品码</span>
        <span>状态</span>
        <span>领取时间</span>
      </div>
      {orders.map((order) => (
        <article className="gift-card-row" key={`${order.orderId}-${order.subOrderId || ''}`}>
          <code>{order.orderId}{order.subOrderId ? `/${order.subOrderId}` : ''}</code>
          <span>{order.title}</span>
          <code>{order.giftCardCode || '-'}</code>
          <span>{order.deliveryStatus}</span>
          <span>{order.claimedAt ? formatDateTime(order.claimedAt) : '-'}</span>
        </article>
      ))}
    </div>
  );
}

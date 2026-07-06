import { Empty, LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { ClaimedOrder } from '../../types.js';
import { fullDate } from '../../utils/time.js';
import { Check, Copy, RefreshCcw } from 'lucide-react';
import { orderKey } from './orderUtils.js';

export function OrderHistorySection({
  claimedOrders,
  copiedKey,
  isLoadingHistory,
  onCopyCodes,
  onRefresh,
  statusLabel,
  t
}: {
  claimedOrders: ClaimedOrder[];
  copiedKey: string;
  isLoadingHistory: boolean;
  onCopyCodes: (orders: ClaimedOrder[], key: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  statusLabel: (status: ClaimedOrder['deliveryStatus']) => string;
  t: Record<string, string>;
}) {
  return (
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <h2>{tr(t, 'claimRecordTitle', '领取记录')}</h2>
          <p>{tr(t, 'claimRecordHint', '仅展示近 30 天内由当前账号领取的订单。')}</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void onRefresh()} disabled={isLoadingHistory}>
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
                <span className={order.deliveryStatus === 'claimed' ? 'status-code ok' : 'status-code'}>{statusLabel(order.deliveryStatus)}</span>
                <button type="button" className="icon-button" onClick={() => void onCopyCodes([order], key)} title={t.copy}>
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
  );
}

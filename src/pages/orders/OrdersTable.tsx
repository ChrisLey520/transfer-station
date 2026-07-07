import type { ClaimedOrder } from '../../types.js';
import { formatDateTime } from '../../utils/time.js';

export function OrdersTable({ orders, className }: { orders: ClaimedOrder[]; className?: string }) {
  if (!orders.length) return <div className={className ? `table-empty ${className}` : 'table-empty'}>暂无记录</div>;
  return (
    <div className={className ? `gift-card-table ${className}` : 'gift-card-table'}>
      <div className="gift-card-table-head">
        <span>ID</span>
        <span>商品</span>
        <span>礼品码</span>
        <span>状态</span>
        <span>领取时间</span>
      </div>
      {orders.map((order) => (
        <article className="gift-card-row" key={`${order.orderId}-${order.subOrderId || ''}`}>
          <code>
            {order.orderId}
            {order.subOrderId ? `/${order.subOrderId}` : ''}
          </code>
          <span>{order.title}</span>
          <code>{order.giftCardCode || '-'}</code>
          <span>{order.deliveryStatus}</span>
          <span>{order.claimedAt ? formatDateTime(order.claimedAt) : '-'}</span>
        </article>
      ))}
    </div>
  );
}

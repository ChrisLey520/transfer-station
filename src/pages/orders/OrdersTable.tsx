import { DataTable } from '../../components/DataTable.js';
import type { ClaimedOrder } from '../../types.js';
import { formatDateTime } from '../../utils/time.js';

export function OrdersTable({ orders, className }: { orders: ClaimedOrder[]; className?: string }) {
  const tableClassName = className ? `gift-card-table ${className}` : 'gift-card-table';
  const emptyClassName = className ? `table-empty ${className}` : 'table-empty';

  return (
    <DataTable
      className={tableClassName}
      headClassName="gift-card-table-head"
      rowClassName="gift-card-row"
      headers={['ID', '商品', '礼品码', '状态', '领取时间']}
      items={orders}
      getItemKey={(order) => `${order.orderId}-${order.subOrderId || ''}`}
      empty={<div className={emptyClassName}>暂无记录</div>}
      renderRow={(order) => (
        <>
          <code>
            {order.orderId}
            {order.subOrderId ? `/${order.subOrderId}` : ''}
          </code>
          <span>{order.title}</span>
          <code>{order.giftCardCode || '-'}</code>
          <span>{order.deliveryStatus}</span>
          <span>{order.claimedAt ? formatDateTime(order.claimedAt) : '-'}</span>
        </>
      )}
    />
  );
}

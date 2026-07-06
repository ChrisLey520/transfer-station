import { OrderClaimSection } from './orders/OrderClaimSection.js';
import { OrderHistorySection } from './orders/OrderHistorySection.js';
import { OrdersTable } from './orders/OrdersTable.js';
import { useOrdersPanel } from './orders/useOrdersPanel.js';

export function OrdersPanel({ headers, refreshTick, t }: { headers: HeadersInit; refreshTick: number; t: Record<string, string> }) {
  const orders = useOrdersPanel({ headers, refreshTick, t });

  return (
    <div className="orders-panel">
      <OrderClaimSection
        claimResult={orders.claimResult}
        copiedKey={orders.copiedKey}
        isClaiming={orders.isClaiming}
        onClaim={orders.claim}
        onCopyCodes={orders.copyCodes}
        onOrderIdChange={orders.setOrderId}
        orderId={orders.orderId}
        t={t}
      />
      <OrderHistorySection
        claimedOrders={orders.claimedOrders}
        copiedKey={orders.copiedKey}
        isLoadingHistory={orders.isLoadingHistory}
        onCopyCodes={orders.copyCodes}
        onRefresh={orders.loadClaimHistory}
        statusLabel={orders.statusLabel}
        t={t}
      />
    </div>
  );
}

export { OrdersTable };

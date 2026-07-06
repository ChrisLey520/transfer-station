import type { ClaimedOrder } from '../../types.js';

export function orderKey(order: ClaimedOrder) {
  return `${order.platform}:${order.orderId}:${order.subOrderId}`;
}

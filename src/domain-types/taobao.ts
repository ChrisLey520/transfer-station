import type { PurchaseChannelId } from './core.js';

export type TaobaoProductMapping = {
  id: string;
  numIid: string;
  skuId: string | null;
  title: string;
  giftType: 'credit' | 'plan';
  amountCents: number;
  planId: string | null;
  durationMonths: number;
  quantity: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

export type TaobaoShop = {
  id: string;
  nick: string;
  sessionExpiresAt: string | null;
  messagePermittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformOrder = {
  id: string;
  platform: PurchaseChannelId;
  shopId: string | null;
  orderId: string;
  subOrderId: string;
  buyerNick: string;
  itemId: string;
  skuId: string | null;
  title: string;
  status: string;
  giftCardCode: string | null;
  deliveryStatus: 'pending' | 'ready' | 'claimed' | 'skipped' | 'failed';
  deliveryMessage: string | null;
  claimedAt: string | null;
  claimedByUserId: string | null;
  lastEventAt: string | null;
  createdAt: string;
  updatedAt: string;
};

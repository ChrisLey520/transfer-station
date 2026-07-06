import { customAlphabet } from 'nanoid';

export const makeId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

export type TaobaoProductMappingInput = {
  id?: string;
  numIid: string;
  skuId?: string | null;
  title?: string;
  giftType: 'credit' | 'plan';
  amountCents?: number;
  planId?: string | null;
  durationMonths?: number;
  quantity?: number;
  isActive?: boolean;
};

export type TaobaoOrderLineInput = {
  shopId?: string | null;
  orderId: string;
  subOrderId?: string;
  buyerNick?: string;
  itemId: string;
  skuId?: string | null;
  title?: string;
  status: string;
  rawPayload?: unknown;
  lastEventAt?: string | null;
};

export function normalizeTaobaoId(value: string | number | null | undefined) {
  return value === null || value === undefined ? '' : String(value).trim();
}

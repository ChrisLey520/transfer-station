import type { ProductItemType, PurchaseChannelId } from './core.js';

export type UpgradePlan = {
  id: string;
  name: string;
  subtitle: string;
  monthlyPriceYuan: number;
  fiveHourCreditUsd: number;
  weeklyCreditUsd: number;
  features: string[];
  recommended?: boolean;
};

export type PurchaseChannel = {
  id: PurchaseChannelId;
  iconSrc: string;
  labelKey: 'taobao' | 'xianyu';
};

export type CreditProduct = {
  id: string;
  amountUsd: number;
  priceCents: number;
};

export type PurchaseProductOption = {
  itemType: ProductItemType;
  itemId: string;
  name: string;
  priceLabel: string;
  description?: string;
};

export type PlanProductOption = PurchaseProductOption & {
  itemType: 'plan';
  plan: UpgradePlan;
};

export type PurchaseMode = ProductItemType;

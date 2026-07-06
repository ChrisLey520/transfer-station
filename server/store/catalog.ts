import type { PurchaseChannelId } from '../types.js';

export const upgradePlanCatalog = [
  {
    id: 'pro',
    name: 'Pro',
    description: '入门版',
    fiveHourTokenLimit: 2000,
    weeklyTokenLimit: 14000,
    priceCents: 6000,
    currency: 'CNY',
    rank: 1
  },
  {
    id: 'max',
    name: 'Max',
    description: '专业版',
    fiveHourTokenLimit: 4000,
    weeklyTokenLimit: 26400,
    priceCents: 11900,
    currency: 'CNY',
    rank: 2
  },
  {
    id: 'ultra',
    name: 'Ultra',
    description: '高级版',
    fiveHourTokenLimit: 20000,
    weeklyTokenLimit: 132000,
    priceCents: 58000,
    currency: 'CNY',
    rank: 3
  },
  {
    id: 'power',
    name: 'Power',
    description: '旗舰版 · 团队与高强度工作量',
    fiveHourTokenLimit: 40000,
    weeklyTokenLimit: 264000,
    priceCents: 115000,
    currency: 'CNY',
    rank: 4
  }
];

export const creditProductCatalog = [
  { id: '20', amountUsd: 20, priceCents: 599, currency: 'CNY' },
  { id: '50', amountUsd: 50, priceCents: 1199, currency: 'CNY' },
  { id: '100', amountUsd: 100, priceCents: 2199, currency: 'CNY' },
  { id: '200', amountUsd: 200, priceCents: 4699, currency: 'CNY' }
];

export const defaultProductUrls: Record<PurchaseChannelId, string> = {
  taobao: 'https://www.taobao.com/',
  xianyu: 'https://www.goofish.com/'
};

export const defaultFreePlan = {
  id: 'free',
  name: 'Free',
  description: '免费版',
  fiveHourTokenLimit: 0,
  weeklyTokenLimit: 0,
  priceCents: 0,
  currency: 'CNY',
  rank: 0
};

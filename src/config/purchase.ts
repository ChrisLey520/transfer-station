import { CreditProduct, Plan, PlanProductOption, ProductItemType, ProductLink, PurchaseChannel, PurchaseChannelId, UpgradePlan } from '../types.js';

export const officialQqGroupQrSrc = '/relayhub-qq-group-2.jpg';

export const officialQqGroupNumber = '1050784021';

export const upgradePlans: UpgradePlan[] = [
  {
    id: 'pro',
    name: 'Pro',
    subtitle: '入门版',
    monthlyPriceYuan: 60,
    fiveHourCreditUsd: 20,
    weeklyCreditUsd: 140,
    features: ['$20 / 5 小时 · $140 / 7 天', '完整访问 Claude Code Opus 4.8 和 Gpt 5.5']
  },
  {
    id: 'max',
    name: 'Max',
    subtitle: '专业版',
    monthlyPriceYuan: 119,
    fiveHourCreditUsd: 40,
    weeklyCreditUsd: 264,
    features: ['2 倍 于入门版用量', '开发效率工具', '更高输出限额'],
    recommended: true
  },
  {
    id: 'ultra',
    name: 'Ultra',
    subtitle: '高级版',
    monthlyPriceYuan: 580,
    fiveHourCreditUsd: 200,
    weeklyCreditUsd: 1320,
    features: ['10 倍 于入门版用量', '适合重度开发工作流', '优先体验高级功能', '峰值流量优先访问']
  },
  {
    id: 'power',
    name: 'Power',
    subtitle: '旗舰版 · 团队与高强度工作量',
    monthlyPriceYuan: 1150,
    fiveHourCreditUsd: 400,
    weeklyCreditUsd: 2640,
    features: ['20 倍 于入门版用量', '包含高级版全部权益', '最高输出限制', '专属入门服务']
  }
];

export const creditProducts: CreditProduct[] = [
  { id: '20', amountUsd: 20, priceCents: 599 },
  { id: '50', amountUsd: 50, priceCents: 1199 },
  { id: '100', amountUsd: 100, priceCents: 2199 },
  { id: '200', amountUsd: 200, priceCents: 4699 }
];

export const defaultPurchaseLinks: Record<PurchaseChannelId, string> = {
  taobao: 'https://www.taobao.com/',
  xianyu: 'https://www.goofish.com/'
};

export const purchaseChannels: PurchaseChannel[] = [
  { id: 'taobao', iconSrc: 'https://www.taobao.com/favicon.ico', labelKey: 'taobao' },
  { id: 'xianyu', iconSrc: 'https://www.goofish.com/favicon.ico', labelKey: 'xianyu' }
];

export function productLinkUrl(
  productLinks: ProductLink[],
  itemType: ProductItemType,
  itemId: string,
  channel: PurchaseChannelId
) {
  return (
    productLinks.find((link) => link.itemType === itemType && link.itemId === itemId && link.channel === channel)?.url ||
    defaultPurchaseLinks[channel]
  );
}

export function planProductOptions(): PlanProductOption[] {
  return upgradePlans.map((plan) => ({
    itemType: 'plan' as const,
    itemId: plan.id,
    name: plan.name,
    priceLabel: `￥${plan.monthlyPriceYuan}`,
    description: plan.subtitle,
    plan
  }));
}

export function creditProductOptions() {
  return creditProducts.map((credit) => ({
    itemType: 'credit' as const,
    itemId: credit.id,
    name: `$${credit.amountUsd}`,
    priceLabel: `￥${(credit.priceCents / 100).toFixed(2)}`
  }));
}

export function giftPlanProductOptions(plans: Plan[]) {
  const activePlanIds = new Set(plans.filter((plan) => plan.isActive && plan.id !== 'free').map((plan) => plan.id));
  return planProductOptions().filter((option) => activePlanIds.has(option.itemId));
}

export function planProductOptionLabel(option: PlanProductOption) {
  return `${option.name} · ${option.description || option.plan.subtitle} · ${option.priceLabel}`;
}

import type { PlanProductOption, TaobaoProductMapping } from '../../types.js';
import { currency } from '../../utils/format.js';

export function taobaoMappingProductLabel(mapping: TaobaoProductMapping, plans: PlanProductOption[]) {
  if (mapping.giftType === 'plan') {
    const option = plans.find((plan) => plan.itemId === mapping.planId);
    return option ? option.name : mapping.planId || '-';
  }
  return currency(mapping.amountCents, 'CNY');
}

import React from 'react';
import { creditProductOptions } from '../../config/purchase.js';
import type { GiftCardFormType, PlanProductOption, PurchaseProductOption } from '../../types.js';
import type { TaobaoMappingPayload } from './taobaoApi.js';

export function useTaobaoMappingForm(plans: PlanProductOption[]) {
  const taobaoProducts = React.useMemo<PurchaseProductOption[]>(() => [...plans, ...creditProductOptions()], [plans]);
  const [selectedProductKey, setSelectedProductKey] = React.useState(() => {
    const first = plans[0] || creditProductOptions()[0];
    return first ? `${first.itemType}:${first.itemId}` : '';
  });
  const [giftType, setGiftType] = React.useState<GiftCardFormType>('plan');
  const [numIid, setNumIid] = React.useState('');
  const [skuId, setSkuId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [planId, setPlanId] = React.useState(plans[0]?.itemId || '');
  const [amountYuan, setAmountYuan] = React.useState('100');
  const [durationMonths, setDurationMonths] = React.useState(1);
  const [quantity, setQuantity] = React.useState(1);

  React.useEffect(() => {
    if (!planId && plans[0]?.itemId) setPlanId(plans[0].itemId);
  }, [planId, plans]);

  const selectedProduct = taobaoProducts.find((product) => `${product.itemType}:${product.itemId}` === selectedProductKey) || taobaoProducts[0];

  React.useEffect(() => {
    if (!selectedProduct && taobaoProducts[0]) {
      setSelectedProductKey(`${taobaoProducts[0].itemType}:${taobaoProducts[0].itemId}`);
      return;
    }
    if (!selectedProduct) return;
    setGiftType(selectedProduct.itemType);
    if (selectedProduct.itemType === 'plan') {
      setPlanId(selectedProduct.itemId);
    } else {
      setAmountYuan(selectedProduct.itemId);
    }
    setTitle((current) => current || selectedProduct.name);
  }, [selectedProduct, taobaoProducts]);

  function selectTaobaoProduct(product: PurchaseProductOption) {
    setSelectedProductKey(`${product.itemType}:${product.itemId}`);
    setGiftType(product.itemType);
    setTitle(product.name);
    if (product.itemType === 'plan') {
      setPlanId(product.itemId);
    } else {
      setAmountYuan(product.itemId);
    }
  }

  function buildMappingPayload(): TaobaoMappingPayload {
    return giftType === 'credit'
      ? {
          numIid,
          skuId: skuId || null,
          title,
          giftType: 'credit',
          amountCents: Math.max(1, Math.round(Number(amountYuan || 0) * 100)),
          quantity,
          isActive: true
        }
      : {
          numIid,
          skuId: skuId || null,
          title,
          giftType: 'plan',
          planId,
          durationMonths,
          quantity,
          isActive: true
        };
  }

  function resetMappingIdentity() {
    setNumIid('');
    setSkuId('');
    setTitle('');
  }

  return {
    amountYuan,
    buildMappingPayload,
    durationMonths,
    giftType,
    numIid,
    planId,
    quantity,
    resetMappingIdentity,
    selectTaobaoProduct,
    selectedProductKey,
    setAmountYuan,
    setDurationMonths,
    setGiftType,
    setNumIid,
    setPlanId,
    setQuantity,
    setSkuId,
    setTitle,
    skuId,
    taobaoProducts,
    title
  };
}

import { LoadingContent } from '../../components/common.js';
import { planProductOptionLabel } from '../../config/purchase.js';
import { tr } from '../../i18n.js';
import type { GiftCardFormType, PlanProductOption, PurchaseProductOption } from '../../types.js';
import { Plus } from 'lucide-react';
import type React from 'react';

type TaobaoMappingFormProps = {
  amountYuan: string;
  durationMonths: number;
  giftType: GiftCardFormType;
  numIid: string;
  onAmountYuanChange: (value: string) => void;
  onDurationMonthsChange: (value: number) => void;
  onGiftTypeChange: (value: GiftCardFormType) => void;
  onNumIidChange: (value: string) => void;
  onPlanIdChange: (value: string) => void;
  onQuantityChange: (value: number) => void;
  onSelectProduct: (product: PurchaseProductOption) => void;
  onSkuIdChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onTitleChange: (value: string) => void;
  planId: string;
  plans: PlanProductOption[];
  quantity: number;
  savingMapping: boolean;
  selectedProductKey: string;
  skuId: string;
  t: Record<string, string>;
  taobaoProducts: PurchaseProductOption[];
  title: string;
};

export function TaobaoMappingForm({
  amountYuan,
  durationMonths,
  giftType,
  numIid,
  onAmountYuanChange,
  onDurationMonthsChange,
  onGiftTypeChange,
  onNumIidChange,
  onPlanIdChange,
  onQuantityChange,
  onSelectProduct,
  onSkuIdChange,
  onSubmit,
  onTitleChange,
  planId,
  plans,
  quantity,
  savingMapping,
  selectedProductKey,
  skuId,
  t,
  taobaoProducts,
  title
}: TaobaoMappingFormProps) {
  return (
    <form className="taobao-mapping-form" onSubmit={onSubmit}>
      <div className="taobao-product-picker">
        <span>{tr(t, 'purchaseProductTitle', '选择商品')}</span>
        <div className="taobao-product-grid">
          {taobaoProducts.map((product) => {
            const productKey = `${product.itemType}:${product.itemId}`;
            return (
              <button
                type="button"
                className={selectedProductKey === productKey ? 'taobao-product-card active' : 'taobao-product-card'}
                key={productKey}
                onClick={() => onSelectProduct(product)}
              >
                <strong>{product.name}</strong>
                <span>{product.itemType === 'plan' ? tr(t, 'giftCardPlanType', '套餐') : tr(t, 'giftCardCreditType', '余额')}</span>
                <small>{product.description || product.priceLabel}</small>
              </button>
            );
          })}
        </div>
      </div>
      <label>
        淘宝商品 ID
        <input value={numIid} onChange={(event) => onNumIidChange(event.target.value)} required />
      </label>
      <label>
        SKU ID
        <input value={skuId} onChange={(event) => onSkuIdChange(event.target.value)} placeholder={tr(t, 'optional', '可选')} />
      </label>
      <label>
        {t.description}
        <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
      </label>
      <label>
        {tr(t, 'giftCardType', '礼品卡类型')}
        <select value={giftType} onChange={(event) => onGiftTypeChange(event.target.value as GiftCardFormType)}>
          <option value="plan">{tr(t, 'giftCardPlanType', '套餐')}</option>
          <option value="credit">{tr(t, 'giftCardCreditType', '余额')}</option>
        </select>
      </label>
      {giftType === 'plan' ? (
        <>
          <label>
            {t.plan}
            <select value={planId} onChange={(event) => onPlanIdChange(event.target.value)} required>
              {plans.map((plan) => (
                <option value={plan.itemId} key={plan.itemId}>
                  {planProductOptionLabel(plan)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr(t, 'giftCardDuration', '有效月份')}
            <input type="number" min="1" max="36" value={durationMonths} onChange={(event) => onDurationMonthsChange(Number(event.target.value))} />
          </label>
        </>
      ) : (
        <label>
          {tr(t, 'giftCardAmount', '余额金额')}
          <input type="number" min="0.01" step="0.01" value={amountYuan} onChange={(event) => onAmountYuanChange(event.target.value)} />
        </label>
      )}
      <label>
        {tr(t, 'giftCardQuantity', '生成数量')}
        <input type="number" min="1" max="20" value={quantity} onChange={(event) => onQuantityChange(Number(event.target.value))} />
      </label>
      <button type="submit" className="primary-button" disabled={savingMapping}>
        <LoadingContent loading={savingMapping} icon={<Plus size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
          {tr(t, 'saveMapping', '保存映射')}
        </LoadingContent>
      </button>
    </form>
  );
}

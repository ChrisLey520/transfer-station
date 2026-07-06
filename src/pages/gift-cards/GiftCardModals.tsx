import { LoadingContent } from '../../components/common.js';
import { planProductOptionLabel } from '../../config/purchase.js';
import { tr } from '../../i18n.js';
import type { AdminGiftCard, GiftCardFormType, GiftCardPreview, PlanProductOption } from '../../types.js';
import { currency } from '../../utils/format.js';
import { Ban, Check, Copy, Gift } from 'lucide-react';
import React from 'react';

export function CreateGiftCardModal({
  amountYuan,
  copiedCode,
  durationMonths,
  eligiblePlans,
  formType,
  generatedCards,
  isCreatingGiftCards,
  planId,
  prefix,
  quantity,
  setAmountYuan,
  setDurationMonths,
  setFormType,
  setPlanId,
  setPrefix,
  setQuantity,
  onCancel,
  onCopyGeneratedCodes,
  onSubmit,
  t
}: {
  amountYuan: string;
  copiedCode: string;
  durationMonths: number;
  eligiblePlans: PlanProductOption[];
  formType: GiftCardFormType;
  generatedCards: AdminGiftCard[];
  isCreatingGiftCards: boolean;
  planId: string;
  prefix: string;
  quantity: number;
  setAmountYuan: (value: string) => void;
  setDurationMonths: (value: number) => void;
  setFormType: (value: GiftCardFormType) => void;
  setPlanId: (value: string) => void;
  setPrefix: (value: string) => void;
  setQuantity: (value: number) => void;
  onCancel: () => void;
  onCopyGeneratedCodes: () => void;
  onSubmit: (event: React.FormEvent) => void;
  t: Record<string, string>;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel gift-card-create-panel" onSubmit={onSubmit}>
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'createGiftCard', '生成礼品码')}</h2>
            <p>{formType === 'plan' ? tr(t, 'giftCardPlanType', '套餐') : tr(t, 'giftCardCreditType', '余额')}</p>
          </div>
        </div>
        <label>
          {tr(t, 'giftCardType', '礼品卡类型')}
          <div className="agent-options gift-card-type-options" role="radiogroup" aria-label={tr(t, 'giftCardType', '礼品卡类型')}>
            <button type="button" className={formType === 'plan' ? 'agent-option active' : 'agent-option'} onClick={() => setFormType('plan')}>
              {tr(t, 'giftCardPlanType', '套餐')}
            </button>
            <button type="button" className={formType === 'credit' ? 'agent-option active' : 'agent-option'} onClick={() => setFormType('credit')}>
              {tr(t, 'giftCardCreditType', '余额')}
            </button>
          </div>
        </label>
        {formType === 'plan' ? (
          <>
            <label>
              {t.plan}
              <select value={planId} onChange={(event) => setPlanId(event.target.value)} required>
                {eligiblePlans.map((plan) => (
                  <option value={plan.itemId} key={plan.itemId}>
                    {planProductOptionLabel(plan)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr(t, 'giftCardDuration', '有效月份')}
              <input type="number" min="1" max="36" value={durationMonths} onChange={(event) => setDurationMonths(Number(event.target.value))} required />
            </label>
          </>
        ) : (
          <label>
            {tr(t, 'giftCardAmount', '余额金额')}
            <input type="number" min="0.01" step="0.01" value={amountYuan} onChange={(event) => setAmountYuan(event.target.value)} required />
          </label>
        )}
        <div className="gift-card-form-grid">
          <label>
            {tr(t, 'giftCardQuantity', '生成数量')}
            <input type="number" min="1" max="200" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required />
          </label>
          <label>
            {tr(t, 'giftCardPrefix', '卡密前缀')}
            <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="RH" />
          </label>
        </div>
        {generatedCards.length ? (
          <div className="generated-gift-cards">
            <div className="generated-gift-cards-head">
              <strong>{tr(t, 'generatedGiftCards', '本次生成')}</strong>
              <button type="button" className="secondary-button" onClick={onCopyGeneratedCodes}>
                {copiedCode === '__generated__' ? <Check size={15} /> : <Copy size={15} />}
                {t.copy}
              </button>
            </div>
            <div className="generated-code-list">
              {generatedCards.map((card) => (
                <code key={card.code}>{card.code}</code>
              ))}
            </div>
          </div>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isCreatingGiftCards}>
            {t.cancel}
          </button>
          <button type="submit" className="primary-button" disabled={isCreatingGiftCards || (formType === 'plan' && !eligiblePlans.length)}>
            <LoadingContent loading={isCreatingGiftCards} icon={<Gift size={16} />} loadingLabel={tr(t, 'creating', '生成中...')}>
              {tr(t, 'createGiftCard', '生成礼品码')}
            </LoadingContent>
          </button>
        </div>
      </form>
    </div>
  );
}

export function RevokeGiftCardModal({
  isRevoking,
  onCancel,
  onRevoke,
  revokeTarget,
  t
}: {
  isRevoking: boolean;
  onCancel: () => void;
  onRevoke: (card: AdminGiftCard) => void;
  revokeTarget: AdminGiftCard;
  t: Record<string, string>;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel">
        <div className="section-heading">
          <div>
            <h2>{tr(t, 'revokeGiftCard', '撤销兑换码')}</h2>
            <p>{revokeTarget.code}</p>
          </div>
        </div>
        <p className="modal-copy">{tr(t, 'revokeGiftCardConfirm', '确认撤销这个未使用的兑换码？撤销后用户将无法兑换。')}</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isRevoking}>
            {t.cancel}
          </button>
          <button type="button" className="danger-button" onClick={() => onRevoke(revokeTarget)} disabled={isRevoking}>
            <LoadingContent loading={isRevoking} icon={<Ban size={16} />} loadingLabel={tr(t, 'revoking', '撤销中...')}>
              {tr(t, 'revokeGiftCard', '撤销兑换码')}
            </LoadingContent>
          </button>
        </div>
      </div>
    </div>
  );
}

export function GiftCardConfirmModal({
  preview,
  t,
  disabled,
  onConfirm,
  onClose
}: {
  preview: GiftCardPreview;
  t: Record<string, string>;
  disabled: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal-panel gift-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-card-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <h2 id="gift-card-confirm-title">{t.redeemCard}</h2>
            <p>{preview.message}</p>
          </div>
        </div>
        <div className="gift-card-summary">
          <div>
            <span>{t.plan}</span>
            <strong>{preview.card.planName || '-'}</strong>
          </div>
          <div>
            <span>{t.fiveHourQuota}</span>
            <strong>{currency(preview.card.fiveHourTokenLimit, 'USD')}</strong>
          </div>
          <div>
            <span>{t.weeklyQuota}</span>
            <strong>{currency(preview.card.weeklyTokenLimit, 'USD')}</strong>
          </div>
        </div>
        <p className="gift-card-warning">
          {preview.consequence === 'extend'
            ? '同级套餐将延长一个月。'
            : '立即使用后，此前更低级的套餐将被覆盖且无法恢复。'}
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={disabled}>
            {t.cancel}
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={disabled}>
            <LoadingContent loading={disabled} loadingLabel={tr(t, 'redeeming', '兑换中...')}>
              {t.redeem}
            </LoadingContent>
          </button>
        </div>
      </section>
    </div>
  );
}

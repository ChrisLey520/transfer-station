import { LoadingContent } from '../components/common.js';
import { RechargeModal } from '../components/RechargeModal.js';
import { buildRechargeModalProps, showErrorToast, showSuccessToast } from '../components/toast.js';
import { upgradePlans } from '../config/purchase.js';
import { tr } from '../i18n.js';
import { Bootstrap, GiftCardPreview, PlanView, UpgradePlan } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { compact, currency, currencyNoDecimals, dollarsToCents } from '../utils/format.js';
import { buildAccountQuota, emptyQuota } from '../utils/quota.js';
import { futureDateLabel } from '../utils/time.js';
import { GiftCardConfirmModal } from './GiftCardsPanel.js';
import { Check, Plus } from 'lucide-react';
import React from 'react';

export function PlansPanel({
  data,
  headers,
  reload,
  t,
  view,
  setView
}: {
  data: Bootstrap;
  headers: HeadersInit;
  reload: () => Promise<void>;
  t: Record<string, string>;
  view: PlanView;
  setView: (view: PlanView) => void;
}) {
  const [redeemCode, setRedeemCode] = React.useState('');
  const [giftPreview, setGiftPreview] = React.useState<GiftCardPreview | null>(null);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [purchaseTarget, setPurchaseTarget] = React.useState<UpgradePlan | null>(null);
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false);
  const primaryKey = data.keys.find((key) => key.status === 'active') || data.keys[0];
  const accountPlan =
    data.plans.find((plan) => plan.id === data.account.currentPlanId) ||
    data.plans.find((plan) => plan.id === 'free');
  const quota = buildAccountQuota(data, accountPlan, primaryKey?.usage) || emptyQuota();
  const currencyCode = accountPlan?.currency || 'CNY';
  const planResetLabel = futureDateLabel(data.account.planExpiresAt);

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    const code = redeemCode.trim();
    if (!code) return;
    if (isRedeeming) return;
    setIsRedeeming(true);
    try {
      const response = await fetch('/api/user/gift-cards/preview', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const result = payload as GiftCardPreview;
      if (result.requiresConfirmation) {
        setGiftPreview(result);
        return;
      }
      await redeemCreditGiftCard(code);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRedeeming(false);
    }
  }

  async function redeemCreditGiftCard(code: string) {
    try {
      const response = await fetch('/api/user/gift-cards/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      showSuccessToast((payload as { message?: string }).message || t.redeem);
      setRedeemCode('');
      await reload();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function confirmGiftCard() {
    if (!giftPreview) return;
    if (isRedeeming) return;
    setIsRedeeming(true);
    try {
      const response = await fetch('/api/user/gift-cards/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: giftPreview.card.code, confirm: true })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setGiftPreview(null);
      setRedeemCode('');
      showSuccessToast((payload as { message?: string }).message || t.redeem);
      await reload();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRedeeming(false);
    }
  }

  if (view === 'change') {
    return (
      <>
        <PlanChangePage
          currentPlanId={data.account.currentPlanId || undefined}
          openPurchaseDialog={setPurchaseTarget}
          t={t}
        />
        {purchaseTarget ? (
          <RechargeModal {...buildRechargeModalProps(t, () => setPurchaseTarget(null))} />
        ) : null}
      </>
    );
  }

  return (
    <section className="billing-page">
      <section className="billing-section">
        <div className="billing-section-head">
          <h2>{t.billingCurrentPlan}</h2>
          <button type="button" className="secondary-button" onClick={() => setView('change')}>
            {t.changePlanPage}
          </button>
        </div>
        <article className="current-plan-card">
          <div className="free-plan-badge">{accountPlan?.name || t.freePlan}</div>
          <div className="current-plan-copy">
            <strong>{data.account.currentPlanRank > 0 ? data.account.currentPlanName || accountPlan?.name : t.currentFreePlan}</strong>
            <p>
              {planResetLabel ? `${t.nextReset}: ${planResetLabel}` : t.upgradePlanHint}
            </p>
          </div>
          <div className="current-plan-quotas">
            <div>
              <span>{t.fiveHourQuota}</span>
              <strong>
                {currency(quota.fiveHourUsed, 'USD')} / {currency(quota.fiveHourLimit, 'USD')}
              </strong>
            </div>
            <div>
              <span>{t.weeklyQuota}</span>
              <strong>
                {currency(quota.weeklyUsed, 'USD')} / {currency(quota.weeklyLimit, 'USD')}
              </strong>
            </div>
          </div>
        </article>
        <article className="current-plan-card balance-plan-card">
          <div className="free-plan-badge">{t.balance}</div>
          <div className="current-plan-copy">
            <strong>{currency(data.summary.accountBalanceCents, currencyCode)}</strong>
            <p>{t.extraBalance}</p>
          </div>
          <div className="current-plan-quotas">
            <div>
              <span>{t.todayUsage}</span>
              <strong>{currency(data.summary.todayCostCents, currencyCode)}</strong>
            </div>
            <div>
              <span>{t.todayRequests}</span>
              <strong>{compact(data.summary.todayRequests)}</strong>
            </div>
          </div>
          <button type="button" className="primary-button" onClick={() => setIsRechargeOpen(true)}>
            <Plus size={16} />
            {t.recharge}
          </button>
        </article>
      </section>

      <section className="billing-section redeem-card-section">
        <h2>{t.redeemCard}</h2>
        <form className="redeem-card-panel" onSubmit={redeem}>
          <p>{t.redeemCardHint}</p>
          <div className="redeem-row">
            <input
              className="redeem-card-input"
              value={redeemCode}
              onChange={(event) => setRedeemCode(event.target.value)}
              placeholder={t.redeemCardPlaceholder}
            />
            <button type="submit" disabled={!redeemCode.trim() || isRedeeming}>
              <LoadingContent loading={isRedeeming} loadingLabel={tr(t, 'redeeming', '兑换中...')}>
                {t.redeem}
              </LoadingContent>
            </button>
          </div>
        </form>
      </section>
      {giftPreview ? (
        <GiftCardConfirmModal
          preview={giftPreview}
          t={t}
          disabled={isRedeeming}
          onConfirm={confirmGiftCard}
          onClose={() => setGiftPreview(null)}
        />
      ) : null}
      {isRechargeOpen ? (
        <RechargeModal {...buildRechargeModalProps(t, () => setIsRechargeOpen(false))} />
      ) : null}
    </section>
  );
}

export function PlanChangePage({
  currentPlanId,
  openPurchaseDialog,
  t
}: {
  currentPlanId?: string;
  openPurchaseDialog: (plan: UpgradePlan) => void;
  t: Record<string, string>;
}) {
  return (
    <section className="upgrade-page">
      <section className="upgrade-hero">
        <p>{t.upgradeEyebrow}</p>
        <h1>
          {t.upgradeTitleBefore} <span>{t.upgradeTitleAccent}</span>。
        </h1>
        <div className="upgrade-price-note">
          <span>{t.upgradeUnitBadge}</span>
          <strong>{t.upgradeUnitLine}</strong>
        </div>
      </section>

      <div className="upgrade-plan-grid">
        {upgradePlans.map((plan) => (
          <article
            className={plan.recommended ? 'upgrade-card recommended' : 'upgrade-card'}
            key={plan.id}
          >
            {plan.recommended ? <div className="recommended-badge">{t.recommendedUpgrade}</div> : null}
            <div className="upgrade-card-head">
              <h2>{plan.name}</h2>
              <p>{plan.subtitle}</p>
            </div>
            <div className="upgrade-price">
              <span>￥</span>
              <strong>{plan.monthlyPriceYuan}</strong>
            </div>
            <p className="upgrade-billing">{t.monthlyBilling}</p>
            <button
              type="button"
              className={plan.recommended ? 'primary-button upgrade-cta' : 'secondary-button upgrade-cta'}
              onClick={() => openPurchaseDialog(plan)}
              aria-pressed={currentPlanId === plan.id}
            >
              {t.switchToPlan.replace('{plan}', plan.name)}
            </button>
            <div className="upgrade-quota-box">
              <span>{t.rateLimitQuota}</span>
              <div>
                <strong>{currencyNoDecimals(dollarsToCents(plan.fiveHourCreditUsd), 'USD')}</strong>
                <strong>{currencyNoDecimals(dollarsToCents(plan.weeklyCreditUsd), 'USD')}</strong>
              </div>
              <div>
                <small>{t.fiveHourShort}</small>
                <small>{t.sevenDayShort}</small>
              </div>
            </div>
            <ul className="upgrade-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={14} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="upgrade-footnote">{t.planFootnote}</p>
    </section>
  );
}

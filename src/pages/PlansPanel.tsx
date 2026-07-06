import { LoadingContent } from '../components/common.js';
import { RechargeModal } from '../components/RechargeModal.js';
import { buildRechargeModalProps } from '../components/toast.js';
import { tr } from '../i18n.js';
import type { Bootstrap, PlanView } from '../types.js';
import { compact, currency } from '../utils/format.js';
import { buildAccountQuota, emptyQuota } from '../utils/quota.js';
import { futureDateLabel } from '../utils/time.js';
import { GiftCardConfirmModal } from './gift-cards/GiftCardModals.js';
import { PlanChangePage } from './plans/PlanChangePage.js';
import { usePlansPanel } from './plans/usePlansPanel.js';
import { Plus } from 'lucide-react';

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
  const panel = usePlansPanel({ headers, reload, t });
  const primaryKey = data.keys.find((key) => key.status === 'active') || data.keys[0];
  const accountPlan =
    data.plans.find((plan) => plan.id === data.account.currentPlanId) ||
    data.plans.find((plan) => plan.id === 'free');
  const quota = buildAccountQuota(data, accountPlan, primaryKey?.usage) || emptyQuota();
  const currencyCode = accountPlan?.currency || 'CNY';
  const planResetLabel = futureDateLabel(data.account.planExpiresAt);

  if (view === 'change') {
    return (
      <>
        <PlanChangePage
          currentPlanId={data.account.currentPlanId || undefined}
          openPurchaseDialog={panel.setPurchaseTarget}
          t={t}
        />
        {panel.purchaseTarget ? (
          <RechargeModal {...buildRechargeModalProps(t, () => panel.setPurchaseTarget(null))} />
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
          <button type="button" className="primary-button" onClick={() => panel.setIsRechargeOpen(true)}>
            <Plus size={16} />
            {t.recharge}
          </button>
        </article>
      </section>

      <section className="billing-section redeem-card-section">
        <h2>{t.redeemCard}</h2>
        <form className="redeem-card-panel" onSubmit={panel.redeem}>
          <p>{t.redeemCardHint}</p>
          <div className="redeem-row">
            <input
              className="redeem-card-input"
              value={panel.redeemCode}
              onChange={(event) => panel.setRedeemCode(event.target.value)}
              placeholder={t.redeemCardPlaceholder}
            />
            <button type="submit" disabled={!panel.redeemCode.trim() || panel.isRedeeming}>
              <LoadingContent loading={panel.isRedeeming} loadingLabel={tr(t, 'redeeming', '兑换中...')}>
                {t.redeem}
              </LoadingContent>
            </button>
          </div>
        </form>
      </section>
      {panel.giftPreview ? (
        <GiftCardConfirmModal
          preview={panel.giftPreview}
          t={t}
          disabled={panel.isRedeeming}
          onConfirm={panel.confirmGiftCard}
          onClose={() => panel.setGiftPreview(null)}
        />
      ) : null}
      {panel.isRechargeOpen ? (
        <RechargeModal {...buildRechargeModalProps(t, () => panel.setIsRechargeOpen(false))} />
      ) : null}
    </section>
  );
}

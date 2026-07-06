import { upgradePlans } from '../../config/purchase.js';
import type { UpgradePlan } from '../../types.js';
import { currencyNoDecimals, dollarsToCents } from '../../utils/format.js';
import { Check } from 'lucide-react';

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
          <article className={plan.recommended ? 'upgrade-card recommended' : 'upgrade-card'} key={plan.id}>
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

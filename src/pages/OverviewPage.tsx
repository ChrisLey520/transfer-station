import { RechargeModal } from '../components/RechargeModal.js';
import { buildRechargeModalProps } from '../components/toast.js';
import { tr } from '../i18n.js';
import { Bootstrap, PlanView, Tab } from '../types.js';
import { compact, currency, percent, tokenK } from '../utils/format.js';
import { Activity, BarChart3, CreditCard, DollarSign, Gauge, KeyRound, Plus } from 'lucide-react';
import React from 'react';

export function OverviewPage({
  data,
  t,
  onNavigate,
  onUpgradePlan
}: {
  data: Bootstrap;
  t: Record<string, string>;
  onNavigate: (tab: Tab, planView?: PlanView) => void;
  onUpgradePlan: () => void;
}) {
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false);
  const currentPlan =
    data.plans.find((plan) => plan.id === data.account.currentPlanId) ||
    data.plans.find((plan) => plan.id === 'free') ||
    data.plans[0];
  const currentPlanName =
    data.account.currentPlanRank > 0 ? data.account.currentPlanName || currentPlan?.name : currentPlan?.name || t.freePlan;
  const currencyCode = currentPlan?.currency || 'CNY';
  const todayCacheBase =
    data.summary.todayInputTokens +
    data.summary.todayCacheCreationInputTokens +
    data.summary.todayCacheReadInputTokens;
  const todayCacheHitRate = todayCacheBase ? data.summary.todayCacheReadInputTokens / todayCacheBase : 0;
  const welcomeName = data.user.displayName?.trim() || data.user.email.split('@')[0];
  const welcomeMessage = welcomeName ? t.overviewWelcomeNamed.replace('{name}', welcomeName) : t.overviewWelcome;

  const quickEntries = [
    { label: t.keyManagement, icon: KeyRound, onClick: () => onNavigate('keys') },
    { label: t.viewUsage, icon: BarChart3, onClick: () => onNavigate('usage') },
    { label: t.planUpgrade, icon: CreditCard, onClick: onUpgradePlan },
    { label: t.usageLogs, icon: Activity, onClick: () => onNavigate('logs') }
  ];

  return (
    <section className="overview-page">
      <p className="overview-welcome">{welcomeMessage}</p>

      <div className="overview-card-grid">
        <article className="overview-card current-plan-overview">
          <div className="overview-card-icon">
            <CreditCard size={20} />
          </div>
          <span>{t.billingCurrentPlan}</span>
          <strong>{currentPlanName}</strong>
          <p>{currentPlan?.description || t.upgradePlanHint}</p>
          <button type="button" className="secondary-button" onClick={onUpgradePlan}>
            <CreditCard size={16} />
            {t.upgrade}
          </button>
        </article>

        <article className="overview-card">
          <div className="overview-card-icon blue">
            <BarChart3 size={20} />
          </div>
          <span>{t.todayRequests}</span>
          <strong>{compact(data.summary.todayRequests)}</strong>
          <p>{t.todayUsage}: {currency(data.summary.todayCostCents, currencyCode)}</p>
        </article>

        <article className="overview-card">
          <div className="overview-card-icon amber">
            <Gauge size={20} />
          </div>
          <span>{t.todayCacheHitRate}</span>
          <strong>{percent(todayCacheHitRate)}</strong>
          <p>{tr(t, 'todayCacheReuseHint', '按今日全部请求汇总计算')} · {t.cacheHit}: {tokenK(data.summary.todayCacheReadInputTokens)}</p>
        </article>

        <article className="overview-card">
          <div className="overview-card-icon rose">
            <DollarSign size={20} />
          </div>
          <span>{t.balance}</span>
          <strong>{currency(data.summary.accountBalanceCents, currencyCode)}</strong>
          <p>{t.extraBalance}</p>
          <button type="button" className="primary-button" onClick={() => setIsRechargeOpen(true)}>
            <Plus size={17} />
            {t.recharge}
          </button>
        </article>
      </div>

      <section className="quick-access-panel">
        <div className="section-heading">
          <h2>{t.quickAccess}</h2>
        </div>
        <div className="quick-access-grid">
          {quickEntries.map((entry) => {
            const Icon = entry.icon;
            return (
              <button type="button" className="quick-access-card" key={entry.label} onClick={entry.onClick}>
                <Icon size={20} />
                <strong>{entry.label}</strong>
              </button>
            );
          })}
        </div>
      </section>

      {isRechargeOpen ? (
        <RechargeModal {...buildRechargeModalProps(t, () => setIsRechargeOpen(false))} />
      ) : null}
    </section>
  );
}

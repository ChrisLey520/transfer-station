import { Empty } from '../components/common.js';
import { RechargeModal } from '../components/RechargeModal.js';
import { buildRechargeModalProps } from '../components/toast.js';
import { Bootstrap, QuotaSnapshot } from '../types.js';
import { compact, currency, pct, usageColor } from '../utils/format.js';
import { buildAccountQuota } from '../utils/quota.js';
import { futureDateLabel } from '../utils/time.js';
import { Activity, BarChart3, CreditCard, Gauge, Plus } from 'lucide-react';
import React from 'react';

export function UsagePage({ data, t, onChangePlan }: { data: Bootstrap; t: Record<string, string>; onChangePlan: () => void }) {
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false);
  const primaryKey = data.keys.find((key) => key.status === 'active') || data.keys[0];
  const currentPlan =
    data.plans.find((plan) => plan.id === data.account.currentPlanId) ||
    data.plans.find((plan) => plan.id === 'free') ||
    data.plans[0];
  const quota = buildAccountQuota(data, currentPlan, primaryKey?.usage);
  const currentPlanName =
    data.account.currentPlanRank > 0 ? data.account.currentPlanName || currentPlan?.name : currentPlan?.name;
  const balance = currency(data.summary.accountBalanceCents, currentPlan?.currency || 'CNY');
  const todayAverage = data.summary.todayRequests
    ? Math.round(data.summary.todayCostCents / data.summary.todayRequests)
    : 0;
  const currencyCode = currentPlan?.currency || 'CNY';

  return (
    <section className="content-grid">
      <section className="overview-hero">
        <article className="plan-summary">
          <span>{t.currentPlan}</span>
          <div>
            <h2>{currentPlanName || '-'}</h2>
            <button type="button" className="secondary-button" onClick={onChangePlan}>
              <CreditCard size={16} />
              {t.changePlan}
            </button>
          </div>
          <p>{currentPlan?.description || t.noData}</p>
          <div className="plan-limit-pair">
            <span>
              {t.fiveHourLimit}: <strong>{currency(currentPlan?.fiveHourTokenLimit || 0, currencyCode)}</strong>
            </span>
            <span>
              {t.weeklyLimit}: <strong>{currency(currentPlan?.weeklyTokenLimit || 0, currencyCode)}</strong>
            </span>
          </div>
        </article>

        <article className="balance-summary">
          <span>{t.balance}</span>
          <strong>{balance}</strong>
          <p>{t.extraBalance}</p>
          <button type="button" className="primary-button" onClick={() => setIsRechargeOpen(true)}>
            <Plus size={17} />
            {t.recharge}
          </button>
        </article>
      </section>

      <div className="metric-grid overview-metrics">
        <article className="metric-tile teal">
          <Activity size={20} />
          <span>{t.todayUsage}</span>
          <strong>{currency(data.summary.todayCostCents, currencyCode)}</strong>
        </article>
        <article className="metric-tile blue">
          <BarChart3 size={20} />
          <span>{t.todayRequests}</span>
          <strong>{compact(data.summary.todayRequests)}</strong>
        </article>
        <article className="metric-tile amber">
          <Gauge size={20} />
          <span>{t.averageCost}</span>
          <strong>{currency(todayAverage, currencyCode)}</strong>
        </article>
      </div>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>{t.tokenUsage}</h2>
            <p>{t.quotaHint}</p>
          </div>
        </div>
        {quota ? <QuotaUsagePanel quota={quota} t={t} /> : <Empty t={t} />}
      </section>
      {isRechargeOpen ? (
        <RechargeModal {...buildRechargeModalProps(t, () => setIsRechargeOpen(false))} />
      ) : null}
    </section>
  );
}

export function QuotaUsagePanel({ quota, t }: { quota: QuotaSnapshot; t: Record<string, string> }) {
  const rows = [
    {
      label: t.fiveHourQuota,
      used: quota.fiveHourUsed,
      limit: quota.fiveHourLimit,
      remaining: quota.remainingFiveHour,
      resetAt: quota.fiveHourResetAt
    },
    {
      label: t.weeklyQuota,
      used: quota.weeklyUsed,
      limit: quota.weeklyLimit,
      remaining: quota.remainingWeekly,
      resetAt: quota.weeklyResetAt
    }
  ];

  return (
    <div className="quota-overview-list">
      {rows.map((row) => {
        const value = pct(row.used, row.limit);
        const resetLabel = futureDateLabel(row.resetAt);
        return (
          <article className="quota-overview-row" key={row.label}>
            <div className="quota-overview-head">
              <div>
                <strong>{row.label}</strong>
                <span>
                  {currency(row.used, 'USD')} / {currency(row.limit, 'USD')}
                </span>
              </div>
              <strong>{currency(row.remaining, 'USD')}</strong>
            </div>
            <div className="bar-track">
              <div style={{ width: `${Math.min(value, 100)}%`, background: usageColor(value) }} />
            </div>
            <div className="quota-overview-foot">
              <span>{Math.round(value)}%</span>
              <span>
                {t.remaining}: {currency(row.remaining, 'USD')}
                {resetLabel ? ` · ${t.nextReset}: ${resetLabel}` : ''}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

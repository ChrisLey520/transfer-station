import type { Bootstrap, PlanView, Tab } from '../../types.js';
import { AnnouncementsPanel } from '../AnnouncementsPanel.js';
import { ChannelsPanel } from '../ChannelsPanel.js';
import { GiftCardsPanel } from '../GiftCardsPanel.js';
import { GuidePage } from '../GuidePage.js';
import { KeysPanel } from '../KeysPanel.js';
import { LogsPanel } from '../LogsPanel.js';
import { OrdersPanel } from '../OrdersPanel.js';
import { OverviewPage } from '../OverviewPage.js';
import { PlansPanel } from '../PlansPanel.js';
import { ProductLinksPanel } from '../ProductLinksPanel.js';
import { UsagePage } from '../UsagePage.js';
import { UserDetailPanel, UsersCenterPanel } from '../UsersCenterPanel.js';

type AppContentProps = {
  activeTab: Tab;
  activeUserId: string | null;
  data: Bootstrap;
  headers: HeadersInit;
  onChangePlanView: (view: PlanView) => void;
  onNavigate: (tab: Tab, planView?: PlanView, userId?: string | null) => void;
  onOpenPlanChange: () => void;
  onRefresh: () => Promise<void>;
  planView: PlanView;
  refreshTick: number;
  reload: () => Promise<void>;
  t: Record<string, string>;
};

export function AppContent({
  activeTab,
  activeUserId,
  data,
  headers,
  onChangePlanView,
  onNavigate,
  onOpenPlanChange,
  onRefresh,
  planView,
  refreshTick,
  reload,
  t
}: AppContentProps) {
  const isAdmin = data.user.role === 'admin';

  return (
    <>
      {activeTab === 'dashboard' ? <OverviewPage data={data} t={t} onNavigate={onNavigate} onUpgradePlan={onOpenPlanChange} /> : null}
      {activeTab === 'keys' ? <KeysPanel data={data} headers={headers} reload={reload} t={t} /> : null}
      {activeTab === 'usage' ? <UsagePage data={data} t={t} onChangePlan={onOpenPlanChange} /> : null}
      {activeTab === 'plans' ? (
        <PlansPanel data={data} headers={headers} reload={reload} t={t} view={planView} setView={onChangePlanView} />
      ) : null}
      {activeTab === 'orders' ? <OrdersPanel headers={headers} refreshTick={refreshTick} t={t} /> : null}
      {activeTab === 'logs' ? <LogsPanel keys={data.keys} headers={headers} refreshTick={refreshTick} t={t} /> : null}
      {activeTab === 'gift-cards' && isAdmin ? <GiftCardsPanel headers={headers} plans={data.plans} refreshTick={refreshTick} t={t} /> : null}
      {activeTab === 'products' && isAdmin ? <ProductLinksPanel headers={headers} initialProductLinks={data.productLinks} refreshTick={refreshTick} t={t} /> : null}
      {activeTab === 'channels' && isAdmin ? <ChannelsPanel headers={headers} refreshTick={refreshTick} t={t} /> : null}
      {activeTab === 'announcements' && isAdmin ? <AnnouncementsPanel headers={headers} refreshTick={refreshTick} t={t} onSaved={onRefresh} /> : null}
      {activeTab === 'users' && isAdmin ? <UsersCenterPanel headers={headers} refreshTick={refreshTick} t={t} onOpenUser={(userId) => onNavigate('user-detail', 'billing', userId)} /> : null}
      {activeTab === 'user-detail' && isAdmin && activeUserId ? (
        <UserDetailPanel headers={headers} userId={activeUserId} onBack={() => onNavigate('users')} t={t} />
      ) : null}
      {activeTab === 'guide' ? <GuidePage t={t} /> : null}
    </>
  );
}

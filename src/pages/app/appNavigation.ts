import { GuideMenuIcon } from '../../config/guide.js';
import { tr } from '../../i18n.js';
import type { NavMenuItem, PlanView, Tab } from '../../types.js';
import { getPageTitle } from '../../components/layout.js';
import { Activity, BarChart3, Bell, CreditCard, Gift, KeyRound, LayoutDashboard, Route, ShoppingBag, UserRound } from 'lucide-react';

export function buildNav(t: Record<string, string>, isAdmin: boolean): NavMenuItem[] {
  return [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'keys', label: t.keys, icon: KeyRound },
    { id: 'usage', label: t.usage, icon: BarChart3 },
    { id: 'plans', label: t.plans, icon: CreditCard },
    { id: 'orders', label: tr(t, 'myOrders', '我的订单'), icon: ShoppingBag },
    { id: 'logs', label: t.logs, icon: Activity },
    ...(isAdmin ? [{ id: 'gift-cards' as const, label: tr(t, 'giftCards', '礼品码'), icon: Gift }] : []),
    ...(isAdmin ? [{ id: 'products' as const, label: tr(t, 'productManagement', '商品管理'), icon: ShoppingBag }] : []),
    ...(isAdmin ? [{ id: 'channels' as const, label: tr(t, 'channelManagement', '渠道管理'), icon: Route }] : []),
    ...(isAdmin ? [{ id: 'announcements' as const, label: '公告管理', icon: Bell }] : []),
    ...(isAdmin ? [{ id: 'users' as const, label: tr(t, 'userCenter', '用户中心'), icon: UserRound }] : []),
    { id: 'guide', label: t.guide, icon: GuideMenuIcon }
  ];
}

export function pageTitleFor(activeTab: Tab, planView: PlanView, t: Record<string, string>) {
  return activeTab === 'user-detail' ? tr(t, 'userDetail', '用户详情') : getPageTitle(activeTab, planView, t);
}

export function adminOnlyTab(activeTab: Tab) {
  return activeTab === 'channels' || activeTab === 'gift-cards' || activeTab === 'products' || activeTab === 'announcements' || activeTab === 'users' || activeTab === 'user-detail';
}

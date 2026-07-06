import { tr } from '../i18n.js';
import { NavMenuItem, PlanView, Tab } from '../types.js';
import { BrandMark, BrandSubtitle } from './brand.js';
import { Menu, X } from 'lucide-react';

export function getPageTitle(tab: Tab, planView: PlanView, t: Record<string, string>) {
  if (tab === 'plans') return planView === 'change' ? t.changePlanPage : t.plansAndBilling;

  const pageTitles: Record<Exclude<Tab, 'plans'>, string> = {
    dashboard: t.dashboard,
    keys: t.keyManagement,
    usage: t.usage,
    orders: tr(t, 'myOrders', '我的订单'),
    logs: t.usageLogs,
    'gift-cards': tr(t, 'giftCardManagement', '礼品码管理'),
    products: tr(t, 'productManagement', '商品管理'),
    channels: tr(t, 'channelManagement', '渠道管理'),
    announcements: '公告管理',
    users: tr(t, 'userCenter', '用户中心'),
    'user-detail': tr(t, 'userDetail', '用户详情'),
    guide: t.guideTitle
  };

  return pageTitles[tab];
}

export function MobileMenuButton({
  isOpen,
  label,
  onClick
}: {
  isOpen: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="mobile-menu-button icon-button"
      aria-controls="app-sidebar"
      aria-expanded={isOpen}
      aria-label={label}
      onClick={onClick}
    >
      <Menu size={18} />
    </button>
  );
}

export function AppSidebar({
  activeTab,
  brand,
  closeLabel,
  isOpen,
  nav,
  onClose,
  onNavigate,
  subtitle
}: {
  activeTab: Tab;
  brand: string;
  closeLabel: string;
  isOpen: boolean;
  nav: NavMenuItem[];
  onClose: () => void;
  onNavigate: (tab: Tab) => void;
  subtitle: string;
}) {
  return (
    <>
      <button
        type="button"
        className={isOpen ? 'sidebar-scrim is-open' : 'sidebar-scrim'}
        aria-hidden={!isOpen}
        aria-label={closeLabel}
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
      />
      <aside id="app-sidebar" className={isOpen ? 'sidebar is-open' : 'sidebar'}>
        <div className="sidebar-head">
          <div className="brand-block">
            <div className="brand-mark">
              <BrandMark />
            </div>
            <div>
              <h1>{brand}</h1>
              <BrandSubtitle subtitle={subtitle} />
            </div>
          </div>
          <button type="button" className="sidebar-close-button icon-button" aria-label={closeLabel} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <nav className="nav-list">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={activeTab === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

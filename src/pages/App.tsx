import { ButtonSpinner } from '../components/common.js';
import { AppSidebar, getPageTitle, MobileMenuButton } from '../components/layout.js';
import { AccountMenu, LanguageMenu, ThemeMenu } from '../components/menus.js';
import { showErrorToast } from '../components/toast.js';
import { defaultBootstrap } from '../config/defaults.js';
import { GuideMenuIcon } from '../config/guide.js';
import { dictionary, tr } from '../i18n.js';
import { AccentTheme, Announcement, Bootstrap, Language, NavMenuItem, PlanView, Tab, ThemeMode } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { readHistoryRoute, writeHistoryRoute } from '../utils/routing.js';
import { readAccentTheme, readThemeMode, resolveThemeMode } from '../utils/theme.js';
import { nextBootstrapRefreshDelay } from '../utils/time.js';
import { AnnouncementModal, AnnouncementsPanel } from './AnnouncementsPanel.js';
import { AuthPage } from './AuthPage.js';
import { ChannelsPanel } from './ChannelsPanel.js';
import { GiftCardsPanel } from './GiftCardsPanel.js';
import { GuidePage } from './GuidePage.js';
import { KeysPanel } from './KeysPanel.js';
import { LogsPanel } from './LogsPanel.js';
import { OrdersPanel } from './OrdersPanel.js';
import { OverviewPage } from './OverviewPage.js';
import { PlansPanel } from './PlansPanel.js';
import { ProductLinksPanel } from './ProductLinksPanel.js';
import { UsagePage } from './UsagePage.js';
import { UserDetailPanel, UsersCenterPanel } from './UsersCenterPanel.js';
import { Activity, ArrowLeft, BarChart3, Bell, CreditCard, Gift, KeyRound, LayoutDashboard, RefreshCcw, Route, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react';
import React from 'react';

export function App() {
  const initialRoute = React.useMemo(() => readHistoryRoute(), []);
  const [language, setLanguage] = React.useState<Language>('zh-CN');
  const [activeTab, setActiveTab] = React.useState<Tab>(initialRoute.tab);
  const [planView, setPlanView] = React.useState<PlanView>(initialRoute.planView);
  const [activeUserId, setActiveUserId] = React.useState<string | null>(initialRoute.userId || null);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => readThemeMode());
  const [accentTheme, setAccentTheme] = React.useState<AccentTheme>(() => readAccentTheme());
  const [authToken, setAuthToken] = React.useState(localStorage.getItem('authToken') || '');
  const [data, setData] = React.useState<Bootstrap>(defaultBootstrap);
  const [announcementAction, setAnnouncementAction] = React.useState<'close' | 'closeToday' | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [isNavDrawerOpen, setIsNavDrawerOpen] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const t = dictionary[language];

  const headers = React.useMemo(() => {
    const value: HeadersInit = { 'content-type': 'application/json' };
    if (authToken) value.authorization = `Bearer ${authToken}`;
    return value;
  }, [authToken]);

  const load = React.useCallback(async () => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const bootstrapRes = await fetch('/api/bootstrap', { headers });
      if (bootstrapRes.status === 401) {
        localStorage.removeItem('authToken');
        setAuthToken('');
        setData(defaultBootstrap);
        setLoading(false);
        return;
      }
      const payload = await readJsonResponse(bootstrapRes);
      if (!bootstrapRes.ok) {
        throw new Error(responseErrorMessage(bootstrapRes, payload, t.requestFailed));
      }
      const bootstrap = payload as Bootstrap;
      setData(bootstrap);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [authToken, headers, t.requestFailed]);

  React.useEffect(() => {
    void load();
  }, [load, refreshTick]);

  React.useEffect(() => {
    writeHistoryRoute(activeTab, planView, true, activeUserId);

    function syncRouteFromHistory() {
      const nextRoute = readHistoryRoute();
      setActiveTab(nextRoute.tab);
      setPlanView(nextRoute.planView);
      setActiveUserId(nextRoute.userId || null);
      setIsNavDrawerOpen(false);
    }

    window.addEventListener('popstate', syncRouteFromHistory);
    return () => {
      window.removeEventListener('popstate', syncRouteFromHistory);
    };
  }, [activeTab, activeUserId, planView]);

  React.useEffect(() => {
    const applyThemeMode = () => {
      document.documentElement.dataset.themeMode = resolveThemeMode(themeMode);
    };

    applyThemeMode();
    document.documentElement.dataset.accent = accentTheme;
    localStorage.setItem('themeMode', themeMode);
    localStorage.setItem('accentTheme', accentTheme);

    if (themeMode !== 'system') return undefined;

    const applyWhenVisible = () => {
      if (document.visibilityState === 'visible') applyThemeMode();
    };
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');

    mediaQuery?.addEventListener('change', applyThemeMode);
    window.addEventListener('focus', applyThemeMode);
    document.addEventListener('visibilitychange', applyWhenVisible);

    return () => {
      mediaQuery?.removeEventListener('change', applyThemeMode);
      window.removeEventListener('focus', applyThemeMode);
      document.removeEventListener('visibilitychange', applyWhenVisible);
    };
  }, [accentTheme, themeMode]);

  React.useEffect(() => {
    if (!isNavDrawerOpen) return undefined;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsNavDrawerOpen(false);
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isNavDrawerOpen]);

  function changeThemeMode(nextThemeMode: ThemeMode) {
    setThemeMode(nextThemeMode);
    document.documentElement.dataset.themeMode = resolveThemeMode(nextThemeMode);
  }

  const handleRefresh = React.useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load();
      setRefreshTick((value) => value + 1);
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshing]);

  React.useEffect(() => {
    if (!authToken || !data.user.id) return undefined;

    const delay = nextBootstrapRefreshDelay(data);
    if (delay === null) return undefined;

    const timer = window.setTimeout(() => {
      void load();
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authToken, data, load]);

  function logout() {
    localStorage.removeItem('authToken');
    setAuthToken('');
    setData(defaultBootstrap);
    setIsNavDrawerOpen(false);
  }

  const isPlansPage = activeTab === 'plans';
  const pageTitle = activeTab === 'user-detail' ? tr(t, 'userDetail', '用户详情') : getPageTitle(activeTab, planView, t);
  const showPageBackButton = activeTab === 'user-detail' || (activeTab === 'plans' && planView === 'change');
  const isBootstrapReady = !authToken || Boolean(data.user.id);
  const isAdmin = isBootstrapReady && data.user.role === 'admin';
  const nav: NavMenuItem[] = [
    { id: 'dashboard' as const, label: t.dashboard, icon: LayoutDashboard },
    { id: 'keys' as const, label: t.keys, icon: KeyRound },
    { id: 'usage' as const, label: t.usage, icon: BarChart3 },
    { id: 'plans' as const, label: t.plans, icon: CreditCard },
    { id: 'orders' as const, label: tr(t, 'myOrders', '我的订单'), icon: ShoppingBag },
    { id: 'logs' as const, label: t.logs, icon: Activity },
    ...(isAdmin ? [{ id: 'gift-cards' as const, label: tr(t, 'giftCards', '礼品码'), icon: Gift }] : []),
    ...(isAdmin ? [{ id: 'products' as const, label: tr(t, 'productManagement', '商品管理'), icon: ShoppingBag }] : []),
    ...(isAdmin ? [{ id: 'channels' as const, label: tr(t, 'channelManagement', '渠道管理'), icon: Route }] : []),
    ...(isAdmin ? [{ id: 'announcements' as const, label: '公告管理', icon: Bell }] : []),
    ...(isAdmin ? [{ id: 'users' as const, label: tr(t, 'userCenter', '用户中心'), icon: UserRound }] : []),
    { id: 'guide' as const, label: t.guide, icon: GuideMenuIcon }
  ];
  const openMenuLabel = t.openMenu;
  const closeMenuLabel = t.closeMenu;

  React.useEffect(() => {
    if (!isBootstrapReady) return;
    if ((activeTab === 'channels' || activeTab === 'gift-cards' || activeTab === 'products' || activeTab === 'announcements' || activeTab === 'users' || activeTab === 'user-detail') && !isAdmin) {
      navigate('dashboard');
    }
  }, [activeTab, isAdmin, isBootstrapReady]);

  async function dismissAnnouncement(action: 'close' | 'closeToday') {
    if (!authToken || announcementAction) return;
    setAnnouncementAction(action);
    try {
      const response = await fetch('/api/announcement/dismiss', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(responseErrorMessage(response, payload, t.requestFailed));
      }
      setData((current) => ({ ...current, announcement: (payload as { announcement: Announcement | null }).announcement }));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setAnnouncementAction(null);
    }
  }

  function navigate(tab: Tab, nextPlanView: PlanView = 'billing', userId?: string | null) {
    setActiveTab(tab);
    setActiveUserId(userId || null);
    setPlanView(tab === 'plans' ? nextPlanView : 'billing');
    setIsNavDrawerOpen(false);
    writeHistoryRoute(tab, tab === 'plans' ? nextPlanView : 'billing', false, userId);
  }

  function openPlanChange() {
    navigate('plans', 'change');
  }

  function changePlanView(nextPlanView: PlanView) {
    setPlanView(nextPlanView);
    writeHistoryRoute('plans', nextPlanView);
  }

  if (!authToken && activeTab === 'guide') {
    return (
      <div className="app-shell public-guide-shell">
        <AppSidebar
          activeTab={activeTab}
          brand={t.brand}
          closeLabel={closeMenuLabel}
          isOpen={isNavDrawerOpen}
          nav={[{ id: 'guide', label: t.guide, icon: GuideMenuIcon }]}
          onClose={() => setIsNavDrawerOpen(false)}
          onNavigate={navigate}
          subtitle={t.subtitle}
        />

        <main className="main-panel">
          <header className="topbar">
            <div className="topbar-title-row">
              <MobileMenuButton
                isOpen={isNavDrawerOpen}
                label={isNavDrawerOpen ? closeMenuLabel : openMenuLabel}
                onClick={() => setIsNavDrawerOpen((isOpen) => !isOpen)}
              />
              <div className="topbar-title">
                <h1>{t.guideTitle}</h1>
              </div>
            </div>
            <div className="topbar-actions">
              <LanguageMenu language={language} setLanguage={setLanguage} />
              <ThemeMenu
                themeMode={themeMode}
                setThemeMode={changeThemeMode}
                accentTheme={accentTheme}
                setAccentTheme={setAccentTheme}
                t={t}
              />
              <button type="button" className="secondary-button" onClick={() => navigate('dashboard')}>
                {t.login}
              </button>
            </div>
          </header>
          <GuidePage t={t} />
        </main>
      </div>
    );
  }

  if (!authToken) {
    return (
      <AuthPage
        t={t}
        language={language}
        setLanguage={setLanguage}
        themeMode={themeMode}
        setThemeMode={changeThemeMode}
        accentTheme={accentTheme}
        setAccentTheme={setAccentTheme}
        onAuthenticated={(session) => {
          localStorage.setItem('authToken', session.token);
          setAuthToken(session.token);
          setData({ ...defaultBootstrap, user: session.user });
        }}
      />
    );
  }

  if (!isBootstrapReady) {
    return (
      <div className="app-shell app-bootstrap-shell">
        <AppSidebar
          activeTab={activeTab}
          brand={t.brand}
          closeLabel={closeMenuLabel}
          isOpen={isNavDrawerOpen}
          nav={[]}
          onClose={() => setIsNavDrawerOpen(false)}
          onNavigate={navigate}
          subtitle={t.subtitle}
        />

        <main className="main-panel">
          <header className="topbar">
            <div className="topbar-title-row">
              <MobileMenuButton
                isOpen={isNavDrawerOpen}
                label={isNavDrawerOpen ? closeMenuLabel : openMenuLabel}
                onClick={() => setIsNavDrawerOpen((isOpen) => !isOpen)}
              />
              <div className="topbar-title">
                <h1>{pageTitle}</h1>
              </div>
            </div>
            <div className="topbar-actions">
              <LanguageMenu language={language} setLanguage={setLanguage} />
              <ThemeMenu
                themeMode={themeMode}
                setThemeMode={changeThemeMode}
                accentTheme={accentTheme}
                setAccentTheme={setAccentTheme}
                t={t}
              />
              <button type="button" className="icon-button" onClick={() => void handleRefresh()} title={t.refresh} disabled={refreshing}>
                {refreshing ? <ButtonSpinner size={17} /> : <RefreshCcw size={17} />}
              </button>
            </div>
          </header>
          {loading ? <div className="loading-line" /> : null}
          <section className="bootstrap-status" aria-live="polite">
            <ShieldCheck size={22} />
            <p>{loading ? tr(t, 'loadingWorkspace', '正在加载工作台...') : t.requestFailed}</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppSidebar
        activeTab={activeTab}
        brand={t.brand}
        closeLabel={closeMenuLabel}
        isOpen={isNavDrawerOpen}
        nav={nav}
        onClose={() => setIsNavDrawerOpen(false)}
        onNavigate={navigate}
        subtitle={t.subtitle}
      />

      <main className={activeTab === 'announcements' ? 'main-panel announcement-main-panel' : isPlansPage ? 'main-panel plans-main-panel' : 'main-panel'}>
        <header className="topbar">
          <div className="topbar-title-row">
            <MobileMenuButton
              isOpen={isNavDrawerOpen}
              label={isNavDrawerOpen ? closeMenuLabel : openMenuLabel}
              onClick={() => setIsNavDrawerOpen((isOpen) => !isOpen)}
            />
              <div className="topbar-title">
                {showPageBackButton ? (
                  <button
                    type="button"
                    className="page-back-button"
                    onClick={() => {
                      if (activeTab === 'user-detail') {
                        navigate('users');
                        return;
                      }
                      navigate('plans', 'billing');
                    }}
                    aria-label={activeTab === 'user-detail' ? '返回用户列表' : t.returnBilling}
                  >
                    <ArrowLeft size={16} />
                  </button>
                ) : null}
                <h1>{pageTitle}</h1>
              </div>
          </div>
          <div className="topbar-actions">
            <LanguageMenu language={language} setLanguage={setLanguage} />
            <ThemeMenu
              themeMode={themeMode}
              setThemeMode={changeThemeMode}
              accentTheme={accentTheme}
              setAccentTheme={setAccentTheme}
              t={t}
            />
            <button type="button" className="icon-button" onClick={() => void handleRefresh()} title={t.refresh} disabled={refreshing}>
              {refreshing ? <ButtonSpinner size={17} /> : <RefreshCcw size={17} />}
            </button>
            <AccountMenu user={data.user} t={t} onLogout={logout} />
          </div>
        </header>
        {loading ? <div className="loading-line" /> : null}

        {activeTab === 'dashboard' ? (
          <OverviewPage data={data} t={t} onNavigate={navigate} onUpgradePlan={openPlanChange} />
        ) : null}
        {activeTab === 'keys' ? <KeysPanel data={data} headers={headers} reload={load} t={t} /> : null}
        {activeTab === 'usage' ? <UsagePage data={data} t={t} onChangePlan={openPlanChange} /> : null}
        {activeTab === 'plans' ? (
          <PlansPanel
            data={data}
            headers={headers}
            reload={load}
            t={t}
            view={planView}
            setView={changePlanView}
          />
        ) : null}
        {activeTab === 'orders' ? <OrdersPanel headers={headers} refreshTick={refreshTick} t={t} /> : null}
        {activeTab === 'logs' ? <LogsPanel keys={data.keys} headers={headers} refreshTick={refreshTick} t={t} /> : null}
        {activeTab === 'gift-cards' && data.user.role === 'admin' ? (
          <GiftCardsPanel headers={headers} plans={data.plans} refreshTick={refreshTick} t={t} />
        ) : null}
        {activeTab === 'products' && data.user.role === 'admin' ? (
          <ProductLinksPanel headers={headers} initialProductLinks={data.productLinks} refreshTick={refreshTick} t={t} />
        ) : null}
        {activeTab === 'channels' && data.user.role === 'admin' ? <ChannelsPanel headers={headers} refreshTick={refreshTick} t={t} /> : null}
        {activeTab === 'announcements' && data.user.role === 'admin' ? <AnnouncementsPanel headers={headers} refreshTick={refreshTick} t={t} onSaved={handleRefresh} /> : null}
        {activeTab === 'users' && data.user.role === 'admin' ? <UsersCenterPanel headers={headers} refreshTick={refreshTick} t={t} onOpenUser={(userId) => navigate('user-detail', 'billing', userId)} /> : null}
        {activeTab === 'user-detail' && data.user.role === 'admin' && activeUserId ? <UserDetailPanel headers={headers} userId={activeUserId} onBack={() => navigate('users')} t={t} /> : null}
        {activeTab === 'guide' ? <GuidePage t={t} /> : null}
      </main>
      {data.announcement?.shouldShow ? (
        <AnnouncementModal
          announcement={data.announcement}
          busyAction={announcementAction}
          onClose={() => void dismissAnnouncement('close')}
          onCloseToday={() => void dismissAnnouncement('closeToday')}
        />
      ) : null}
    </div>
  );
}

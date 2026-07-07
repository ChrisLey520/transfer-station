import React from 'react';
import { showErrorToast } from '../../components/toast.js';
import { defaultBootstrap } from '../../config/defaults.js';
import { dictionary } from '../../i18n.js';
import type { AccentTheme, AuthSession, Bootstrap, Language, PlanView, Tab, ThemeMode } from '../../types.js';
import { unknownErrorMessage } from '../../utils/api.js';
import { isPublicGuideRoute, isPublicHomeRoute, readHistoryRoute, writeHistoryRoute } from '../../utils/routing.js';
import { readAccentTheme, readThemeMode, resolveThemeMode } from '../../utils/theme.js';
import { nextBootstrapRefreshDelay } from '../../utils/time.js';
import { adminOnlyTab, buildNav, pageTitleFor } from './appNavigation.js';
import { dismissAnnouncementRequest, fetchBootstrap } from './appApi.js';

export function useAppController() {
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
      const result = await fetchBootstrap(headers, t.requestFailed);
      if (result.unauthorized) {
        localStorage.removeItem('authToken');
        setAuthToken('');
        setData(defaultBootstrap);
        setLoading(false);
        return;
      }
      setData(result.bootstrap);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [authToken, headers, t.requestFailed]);

  function navigate(tab: Tab, nextPlanView: PlanView = 'billing', userId?: string | null) {
    const resolvedPlanView = tab === 'plans' ? nextPlanView : 'billing';
    setActiveTab(tab);
    setActiveUserId(userId || null);
    setPlanView(resolvedPlanView);
    setIsNavDrawerOpen(false);
    writeHistoryRoute(tab, resolvedPlanView, false, userId);
  }

  React.useEffect(() => {
    void load();
  }, [load, refreshTick]);

  React.useEffect(() => {
    const shouldPreservePublicRoute = !authToken && (isPublicHomeRoute() || isPublicGuideRoute());
    if (!shouldPreservePublicRoute) {
      writeHistoryRoute(activeTab, planView, true, activeUserId);
    }

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
  }, [activeTab, activeUserId, authToken, planView]);

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

  const isBootstrapReady = !authToken || Boolean(data.user.id);
  const isAdmin = isBootstrapReady && data.user.role === 'admin';

  React.useEffect(() => {
    if (!isBootstrapReady) return;
    if (adminOnlyTab(activeTab) && !isAdmin) {
      navigate('dashboard');
    }
  }, [activeTab, isAdmin, isBootstrapReady]);

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

  function logout() {
    localStorage.removeItem('authToken');
    setAuthToken('');
    setData(defaultBootstrap);
    setIsNavDrawerOpen(false);
  }

  function authenticate(session: AuthSession) {
    localStorage.setItem('authToken', session.token);
    setAuthToken(session.token);
    setData({ ...defaultBootstrap, user: session.user });
  }

  async function dismissAnnouncement(action: 'close' | 'closeToday') {
    if (!authToken || announcementAction) return;
    setAnnouncementAction(action);
    try {
      const announcement = await dismissAnnouncementRequest(action, headers, t.requestFailed);
      setData((current) => ({ ...current, announcement }));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setAnnouncementAction(null);
    }
  }

  function openPlanChange() {
    navigate('plans', 'change');
  }

  function changePlanView(nextPlanView: PlanView) {
    setPlanView(nextPlanView);
    writeHistoryRoute('plans', nextPlanView);
  }

  return {
    accentTheme,
    activeTab,
    activeUserId,
    announcementAction,
    authenticate,
    authToken,
    changePlanView,
    changeThemeMode,
    closeMenuLabel: t.closeMenu,
    data,
    dismissAnnouncement,
    handleRefresh,
    headers,
    isAdmin,
    isBootstrapReady,
    isNavDrawerOpen,
    isPublicGuide: !authToken && isPublicGuideRoute(),
    isPublicHome: !authToken && isPublicHomeRoute(),
    language,
    load,
    loading,
    logout,
    nav: buildNav(t, isAdmin),
    navigate,
    openMenuLabel: t.openMenu,
    openPlanChange,
    pageTitle: pageTitleFor(activeTab, planView, t),
    planView,
    refreshTick,
    refreshing,
    setAccentTheme,
    setIsNavDrawerOpen,
    setLanguage,
    t,
    themeMode
  };
}

import { PlanView, Tab } from '../types.js';

export const routeTabSegments: Record<Tab, string> = {
  dashboard: 'dashboard',
  keys: 'keys',
  usage: 'usage',
  plans: 'plans',
  orders: 'orders',
  logs: 'logs',
  'gift-cards': 'gift-cards',
  products: 'products',
  channels: 'channels',
  announcements: 'announcements',
  users: 'users',
  'user-detail': 'users',
  guide: 'app/guide'
};

export const routeSegmentTabs = Object.entries(routeTabSegments).reduce<Record<string, Tab>>((map, [tab, segment]) => {
  map[segment] = tab as Tab;
  return map;
}, {});

export function resolveRoute(route: string): { tab: Tab; planView: PlanView; userId?: string } {
  const normalizedRoute = route.replace(/^\/+/, '').replace(/\/+$/, '');
  const [segment = '', viewSegment = ''] = normalizedRoute.split('/');
  if (normalizedRoute === 'app/guide') {
    return { tab: 'guide', planView: 'billing' };
  }
  if (segment === 'taobao-claim' || segment === 'claim-code') {
    return { tab: 'orders', planView: 'billing' };
  }
  if (segment === 'users' && viewSegment) {
    return { tab: 'user-detail', planView: 'billing', userId: decodeURIComponent(viewSegment) };
  }
  const tab = routeSegmentTabs[segment] || 'dashboard';
  return {
    tab,
    planView: tab === 'plans' && viewSegment === 'change' ? 'change' : 'billing'
  };
}

export function readHistoryRoute(): { tab: Tab; planView: PlanView; userId?: string } {
  const legacyHashRoute = window.location.hash.match(/^#\/(.+)/)?.[1];
  if (legacyHashRoute) return resolveRoute(legacyHashRoute);
  return resolveRoute(window.location.pathname);
}

export function isPublicHomeRoute() {
  return !window.location.hash && window.location.pathname === '/';
}

export function isPublicGuideRoute() {
  return !window.location.hash && (window.location.pathname === '/guide' || window.location.pathname === '/guide/' || window.location.pathname.startsWith('/guide/'));
}

export function routeToPath(tab: Tab, planView: PlanView, userId?: string | null) {
  if (tab === 'user-detail' && userId) {
    return `/users/${encodeURIComponent(userId)}`;
  }
  const segment = routeTabSegments[tab];
  return tab === 'plans' && planView === 'change' ? `/${segment}/change` : `/${segment}`;
}

export function writeHistoryRoute(tab: Tab, planView: PlanView, replace = false, userId?: string | null) {
  const nextPath = routeToPath(tab, planView, userId);
  if (!window.location.hash && window.location.pathname === nextPath) return;
  const nextUrl = `${nextPath}${window.location.search}`;
  if (replace) {
    window.history.replaceState(null, '', nextUrl);
    return;
  }
  window.history.pushState(null, '', nextUrl);
}

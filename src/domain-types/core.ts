import type * as React from 'react';

export type Language = 'zh-CN' | 'zh-TW' | 'en';

export type AuthMode = 'login' | 'register';

export type Tab = 'dashboard' | 'keys' | 'usage' | 'plans' | 'orders' | 'logs' | 'gift-cards' | 'products' | 'channels' | 'announcements' | 'users' | 'user-detail' | 'guide';

export type PlanView = 'billing' | 'change';

export type PurchaseChannelId = 'taobao' | 'xianyu';

export type ProductItemType = 'plan' | 'credit';

export type GuideAgentId = 'claude-code' | 'codex';

export type UpstreamKeyAgentType = 'shared' | GuideAgentId;

export type GuideOsId = 'windows' | 'macos' | 'linux' | 'macos-linux';

export type ThemeMode = 'system' | 'light' | 'dark';

export type AccentTheme = 'sun-gold' | 'rose-pink' | 'pine-green' | 'violet' | 'bay-blue';

export type NavMenuItem = {
  id: Tab;
  label: string;
  icon: React.ElementType<{ size?: number }>;
};

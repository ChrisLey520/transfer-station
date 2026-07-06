import { ButtonSpinner } from '../../components/common.js';
import { AppSidebar, MobileMenuButton } from '../../components/layout.js';
import { AccountMenu, LanguageMenu, ThemeMenu } from '../../components/menus.js';
import type { AccentTheme, Bootstrap, Language, NavMenuItem, Tab, ThemeMode } from '../../types.js';
import { ArrowLeft, RefreshCcw } from 'lucide-react';
import type React from 'react';

type AppFrameProps = {
  activeTab: Tab;
  afterMain?: React.ReactNode;
  brand: string;
  children: React.ReactNode;
  closeLabel: string;
  isNavDrawerOpen: boolean;
  mainClassName?: string;
  nav: NavMenuItem[];
  onCloseNav: () => void;
  onNavigate: (tab: Tab) => void;
  shellClassName?: string;
  subtitle: string;
};

export function AppFrame({
  activeTab,
  afterMain,
  brand,
  children,
  closeLabel,
  isNavDrawerOpen,
  mainClassName = 'main-panel',
  nav,
  onCloseNav,
  onNavigate,
  shellClassName = 'app-shell',
  subtitle
}: AppFrameProps) {
  return (
    <div className={shellClassName}>
      <AppSidebar
        activeTab={activeTab}
        brand={brand}
        closeLabel={closeLabel}
        isOpen={isNavDrawerOpen}
        nav={nav}
        onClose={onCloseNav}
        onNavigate={onNavigate}
        subtitle={subtitle}
      />
      <main className={mainClassName}>{children}</main>
      {afterMain}
    </div>
  );
}

type AppTopbarProps = {
  accentTheme: AccentTheme;
  backButton?: {
    label: string;
    onClick: () => void;
  };
  children?: React.ReactNode;
  closeMenuLabel: string;
  isNavDrawerOpen: boolean;
  language: Language;
  onToggleNav: () => void;
  openMenuLabel: string;
  setAccentTheme: (accentTheme: AccentTheme) => void;
  setLanguage: (language: Language) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  t: Record<string, string>;
  themeMode: ThemeMode;
  title: string;
};

export function AppTopbar({
  accentTheme,
  backButton,
  children,
  closeMenuLabel,
  isNavDrawerOpen,
  language,
  onToggleNav,
  openMenuLabel,
  setAccentTheme,
  setLanguage,
  setThemeMode,
  t,
  themeMode,
  title
}: AppTopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-title-row">
        <MobileMenuButton isOpen={isNavDrawerOpen} label={isNavDrawerOpen ? closeMenuLabel : openMenuLabel} onClick={onToggleNav} />
        <div className="topbar-title">
          {backButton ? (
            <button type="button" className="page-back-button" onClick={backButton.onClick} aria-label={backButton.label}>
              <ArrowLeft size={16} />
            </button>
          ) : null}
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <LanguageMenu language={language} setLanguage={setLanguage} />
        <ThemeMenu themeMode={themeMode} setThemeMode={setThemeMode} accentTheme={accentTheme} setAccentTheme={setAccentTheme} t={t} />
        {children}
      </div>
    </header>
  );
}

type RefreshButtonProps = {
  disabled: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  title: string;
};

export function RefreshButton({ disabled, onRefresh, refreshing, title }: RefreshButtonProps) {
  return (
    <button type="button" className="icon-button" onClick={onRefresh} title={title} disabled={disabled}>
      {refreshing ? <ButtonSpinner size={17} /> : <RefreshCcw size={17} />}
    </button>
  );
}

type AccountActionsProps = {
  data: Bootstrap;
  disabled: boolean;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  t: Record<string, string>;
};

export function AccountActions({ data, disabled, onLogout, onRefresh, refreshing, t }: AccountActionsProps) {
  return (
    <>
      <RefreshButton disabled={disabled} onRefresh={onRefresh} refreshing={refreshing} title={t.refresh} />
      <AccountMenu user={data.user} t={t} onLogout={onLogout} />
    </>
  );
}

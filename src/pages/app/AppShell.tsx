import { ButtonSpinner } from '../../components/common.js';
import { AppSidebar, MobileMenuButton } from '../../components/layout.js';
import { AccountMenu, LanguageMenu, ThemeMenu } from '../../components/menus.js';
import { PasswordDialog } from '../../components/PasswordDialog.js';
import { showErrorToast, showSuccessToast } from '../../components/toast.js';
import { tr } from '../../i18n.js';
import type { AccentTheme, Bootstrap, Language, NavMenuItem, Tab, ThemeMode } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';
import { ArrowLeft, RefreshCcw } from 'lucide-react';
import React from 'react';

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
  headers: HeadersInit;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  t: Record<string, string>;
};

export function AccountActions({ data, disabled, headers, onLogout, onRefresh, refreshing, t }: AccountActionsProps) {
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  async function changePassword(values: { currentPassword?: string; newPassword: string }) {
    if (!values.currentPassword || isChangingPassword) return;
    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      showSuccessToast(tr(t, 'passwordChanged', '密码已修改。'));
      setIsPasswordDialogOpen(false);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <>
      <RefreshButton disabled={disabled} onRefresh={onRefresh} refreshing={refreshing} title={t.refresh} />
      <AccountMenu user={data.user} t={t} onChangePassword={() => setIsPasswordDialogOpen(true)} onLogout={onLogout} />
      {isPasswordDialogOpen ? (
        <PasswordDialog
          busy={isChangingPassword}
          onClose={() => setIsPasswordDialogOpen(false)}
          onSubmit={changePassword}
          submitLabel={tr(t, 'savePassword', '保存密码')}
          subtitle={tr(t, 'changePasswordHint', '输入当前密码并设置新的登录密码。')}
          t={t}
          title={tr(t, 'changePassword', '修改密码')}
        />
      ) : null}
    </>
  );
}

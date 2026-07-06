import { accentThemeOptions, themeModeOptions } from '../config/themeOptions.js';
import { AccentTheme, Language, ThemeMode, UserProfile } from '../types.js';
import { autoUpdate, flip, FloatingPortal, offset, shift, useDismiss, useFloating, useInteractions, useRole } from '@floating-ui/react';
import { ChevronDown, Globe2, LogOut, Palette, UserRound } from 'lucide-react';
import React from 'react';

export function LanguageMenu(props: { language: Language; setLanguage: (language: Language) => void }) {
  return (
    <div className="select-shell">
      <Globe2 size={16} />
      <select value={props.language} onChange={(event) => props.setLanguage(event.target.value as Language)}>
        <option value="zh-CN">简体中文</option>
        <option value="zh-TW">繁體中文</option>
        <option value="en">English</option>
      </select>
      <ChevronDown size={14} />
    </div>
  );
}

export function ThemeMenu({
  themeMode,
  setThemeMode,
  accentTheme,
  setAccentTheme,
  t
}: {
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (accentTheme: AccentTheme) => void;
  t: Record<string, string>;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-end',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })]
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'menu' });
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  return (
    <div className="theme-menu">
      <button
        ref={refs.setReference}
        {...getReferenceProps({
          type: 'button',
          className: 'icon-button',
          onClick: () => setIsOpen((value) => !value),
          'aria-expanded': isOpen,
          'aria-haspopup': 'menu',
          title: t.theme
        })}
      >
        <Palette size={17} />
      </button>
      {isOpen ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            className="theme-menu-panel"
            style={floatingStyles}
            aria-label={t.theme}
            {...getFloatingProps()}
          >
            <div className="theme-menu-section">
              <span>{t.themeMode}</span>
              <div className="theme-mode-control">
                {themeModeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      type="button"
                      className={themeMode === option.id ? 'theme-mode-button active' : 'theme-mode-button'}
                      key={option.id}
                      onClick={() => setThemeMode(option.id)}
                      title={t[option.labelKey]}
                    >
                      <Icon size={15} />
                      <span>{t[option.labelKey]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="theme-menu-section">
              <span>{t.themeColor}</span>
              <div className="accent-grid">
                {accentThemeOptions.map((option) => (
                  <button
                    type="button"
                    className={accentTheme === option.id ? 'accent-swatch active' : 'accent-swatch'}
                    data-accent-option={option.id}
                    key={option.id}
                    onClick={() => setAccentTheme(option.id)}
                    title={t[option.labelKey]}
                    aria-label={t[option.labelKey]}
                  >
                    <span />
                    <strong>{t[option.labelKey]}</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FloatingPortal>
      ) : null}
    </div>
  );
}

export function AccountMenu({
  user,
  t,
  onLogout
}: {
  user: UserProfile;
  t: Record<string, string>;
  onLogout: () => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const roleLabel = user.role === 'admin' ? t.adminRole : t.memberRole;
  const userName = user.displayName?.trim() || user.email.split('@')[0] || '-';

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-menu-trigger"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={t.accountMenu}
      >
        <UserRound size={16} />
      </button>
      {isOpen ? (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-profile">
            <div className="account-menu-profile-row">
              <span>{t.displayName}</span>
              <strong>{userName}</strong>
            </div>
            <div className="account-menu-profile-row">
              <span>{t.email}</span>
              <strong>{user.email || '-'}</strong>
            </div>
            <div className="account-menu-profile-row">
              <span>{t.role}</span>
              <strong>{roleLabel}</strong>
            </div>
          </div>
          <button
            type="button"
            className="account-menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
          >
            <LogOut size={15} />
            {t.logout}
          </button>
        </div>
      ) : null}
    </div>
  );
}

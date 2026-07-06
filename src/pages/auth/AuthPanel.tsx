import { BrandMark } from '../../components/brand.js';
import { LoadingContent } from '../../components/common.js';
import { LanguageMenu, ThemeMenu } from '../../components/menus.js';
import { tr } from '../../i18n.js';
import type { AccentTheme, AuthMode, Language, ThemeMode } from '../../types.js';
import { Eye, EyeOff } from 'lucide-react';
import type React from 'react';

type AuthPanelProps = {
  accentTheme: AccentTheme;
  displayName: string;
  email: string;
  isPasswordVisible: boolean;
  language: Language;
  mode: AuthMode;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onSwitchMode: (mode: AuthMode) => void;
  onTogglePassword: () => void;
  password: string;
  setAccentTheme: (accentTheme: AccentTheme) => void;
  setLanguage: (language: Language) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  submitting: boolean;
  t: Record<string, string>;
  themeMode: ThemeMode;
};

export function AuthPanel({
  accentTheme,
  displayName,
  email,
  isPasswordVisible,
  language,
  mode,
  onDisplayNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onSwitchMode,
  onTogglePassword,
  password,
  setAccentTheme,
  setLanguage,
  setThemeMode,
  submitting,
  t,
  themeMode
}: AuthPanelProps) {
  return (
    <section className="auth-panel">
      <div className="auth-brand">
        <div className="brand-mark">
          <BrandMark />
        </div>
        <div>
          <h1 className="auth-title">
            <span>{mode === 'login' ? t.loginTitle : t.registerTitle}</span>
            <span className="auth-title-brand">{t.brand}</span>
          </h1>
          <p>{t.authHint}</p>
        </div>
      </div>
      <form className="auth-form" onSubmit={onSubmit} autoComplete="on">
        <label>
          {t.email}
          <input
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            type="email"
            name="email"
            autoComplete={mode === 'login' ? 'username' : 'email'}
            inputMode="email"
            required
            autoFocus
          />
        </label>
        {mode === 'register' ? (
          <label>
            {t.displayName}
            <input value={displayName} onChange={(event) => onDisplayNameChange(event.target.value)} name="name" autoComplete="name" />
          </label>
        ) : null}
        <label>
          {t.password}
          <span className="password-input-shell">
            <input
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              type={isPasswordVisible ? 'text' : 'password'}
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              required
            />
            <button
              type="button"
              className="password-visibility-button"
              onClick={onTogglePassword}
              aria-label={isPasswordVisible ? t.hidePassword : t.showPassword}
              title={isPasswordVisible ? t.hidePassword : t.showPassword}
            >
              {isPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>
        <button type="submit" className="primary-button" disabled={submitting}>
          <LoadingContent loading={submitting} loadingLabel={mode === 'login' ? tr(t, 'loggingIn', '登录中...') : tr(t, 'registering', '注册中...')}>
            {mode === 'login' ? t.login : t.register}
          </LoadingContent>
        </button>
      </form>
      <div className="auth-footer">
        <button type="button" className="upgrade-link-button" onClick={() => onSwitchMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? t.noAccount : t.haveAccount}
        </button>
        <div className="auth-footer-actions">
          <LanguageMenu language={language} setLanguage={setLanguage} />
          <ThemeMenu themeMode={themeMode} setThemeMode={setThemeMode} accentTheme={accentTheme} setAccentTheme={setAccentTheme} t={t} />
        </div>
      </div>
    </section>
  );
}

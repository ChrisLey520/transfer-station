import { BrandMark } from '../components/brand.js';
import { ButtonSpinner, LoadingContent } from '../components/common.js';
import { LanguageMenu, ThemeMenu } from '../components/menus.js';
import { showErrorToast } from '../components/toast.js';
import { tr } from '../i18n.js';
import { AccentTheme, AuthMode, AuthSession, Language, SliderChallenge, ThemeMode } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { Eye, EyeOff, RefreshCcw, ShieldCheck } from 'lucide-react';
import React from 'react';

export function AuthPage({
  t,
  language,
  setLanguage,
  themeMode,
  setThemeMode,
  accentTheme,
  setAccentTheme,
  onAuthenticated
}: {
  t: Record<string, string>;
  language: Language;
  setLanguage: (language: Language) => void;
  themeMode: ThemeMode;
  setThemeMode: (themeMode: ThemeMode) => void;
  accentTheme: AccentTheme;
  setAccentTheme: (accentTheme: AccentTheme) => void;
  onAuthenticated: (session: AuthSession) => void;
}) {
  const [mode, setMode] = React.useState<AuthMode>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [captchaToken, setCaptchaToken] = React.useState('');
  const [verificationResetKey, setVerificationResetKey] = React.useState(0);
  const [isVerificationOpen, setIsVerificationOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function authenticate(verifiedToken: string) {
    setSubmitting(true);
    try {
      const response = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          captchaToken: verifiedToken,
          ...(mode === 'register' ? { displayName } : {})
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        setCaptchaToken('');
        setVerificationResetKey((value) => value + 1);
        return;
      }
      onAuthenticated(payload as AuthSession);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
      setCaptchaToken('');
      setVerificationResetKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!captchaToken) {
      setIsVerificationOpen(true);
      return;
    }
    await authenticate(captchaToken);
  }

  function handleVerificationToken(token: string) {
    setCaptchaToken(token);
    if (token) {
      setIsVerificationOpen(false);
      void authenticate(token);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setCaptchaToken('');
    setVerificationResetKey((value) => value + 1);
    setIsVerificationOpen(false);
    setIsPasswordVisible(false);
  }

  return (
    <main className="auth-page">
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
        <form className="auth-form" onSubmit={submit} autoComplete="on">
          <label>
            {t.email}
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                name="name"
                autoComplete="name"
              />
            </label>
          ) : null}
          <label>
            {t.password}
            <span className="password-input-shell">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={isPasswordVisible ? 'text' : 'password'}
                name="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 8 : undefined}
                required
              />
              <button
                type="button"
                className="password-visibility-button"
                onClick={() => setIsPasswordVisible((value) => !value)}
                aria-label={isPasswordVisible ? t.hidePassword : t.showPassword}
                title={isPasswordVisible ? t.hidePassword : t.showPassword}
              >
                {isPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          <button type="submit" className="primary-button" disabled={submitting}>
            <LoadingContent
              loading={submitting}
              loadingLabel={mode === 'login' ? tr(t, 'loggingIn', '登录中...') : tr(t, 'registering', '注册中...')}
            >
              {mode === 'login' ? t.login : t.register}
            </LoadingContent>
          </button>
        </form>
        <div className="auth-footer">
          <button type="button" className="upgrade-link-button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? t.noAccount : t.haveAccount}
          </button>
          <div className="auth-footer-actions">
            <LanguageMenu language={language} setLanguage={setLanguage} />
            <ThemeMenu
              themeMode={themeMode}
              setThemeMode={setThemeMode}
              accentTheme={accentTheme}
              setAccentTheme={setAccentTheme}
              t={t}
            />
          </div>
        </div>
      </section>
      {isVerificationOpen ? (
        <div className="modal-backdrop" onClick={() => setIsVerificationOpen(false)}>
          <section
            className="modal-panel auth-verification-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.slideVerify}
            onClick={(event) => event.stopPropagation()}
          >
            <SliderVerification
              key={`${mode}-${verificationResetKey}`}
              mode={mode}
              t={t}
              onTokenChange={handleVerificationToken}
            />
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setIsVerificationOpen(false)}>
                {t.cancel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export function SliderVerification({
  mode,
  t,
  onTokenChange
}: {
  mode: AuthMode;
  t: Record<string, string>;
  onTokenChange: (token: string) => void;
}) {
  const [challenge, setChallenge] = React.useState<SliderChallenge | null>(null);
  const [value, setValue] = React.useState(0);
  const [status, setStatus] = React.useState(t.slideToVerify);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isVerified, setIsVerified] = React.useState(false);

  const loadChallenge = React.useCallback(async () => {
    onTokenChange('');
    setChallenge(null);
    setValue(0);
    setIsVerified(false);
    setIsLoading(true);
    setStatus(t.slideToVerify);

    try {
      const response = await fetch('/api/auth/slider-challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ purpose: mode })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.verificationFailed));
        return;
      }
      setChallenge(payload as SliderChallenge);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.verificationFailed));
    } finally {
      setIsLoading(false);
    }
  }, [mode, onTokenChange, t.slideToVerify, t.verificationFailed]);

  React.useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  async function verify(nextValue: number) {
    if (!challenge || isVerifying || isVerified) return;
    setIsVerifying(true);
    setStatus(t.verifying);
    try {
      const response = await fetch('/api/auth/slider-verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          purpose: mode,
          positionPct: nextValue
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.verificationFailed));
        setStatus(t.slideToVerify);
        setValue(0);
        onTokenChange('');
        void loadChallenge();
        return;
      }
      setIsVerified(true);
      setValue(nextValue);
      setStatus(t.verified);
      onTokenChange((payload as { captchaToken?: string }).captchaToken || '');
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.verificationFailed));
      setStatus(t.slideToVerify);
      setValue(0);
      onTokenChange('');
      void loadChallenge();
    } finally {
      setIsVerifying(false);
    }
  }

  function updateSlider(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = Number(event.target.value);
    setValue(nextValue);
  }

  function releaseSlider() {
    if (!disabled) {
      void verify(value);
    }
  }

  const disabled = isLoading || isVerifying || isVerified || !challenge;
  const pieceLeftPct = challenge ? (value / 100) * (100 - challenge.pieceWidthPct) : 0;
  const trackStyle = {
    '--slider-progress': `${value}%`,
    '--piece-left': `${pieceLeftPct}%`,
    '--piece-top': `${challenge?.pieceTopPct ?? 34}%`,
    '--piece-width': `${challenge?.pieceWidthPct ?? 13.75}%`,
    '--piece-height': `${challenge?.pieceHeightPct ?? 29.33}%`
  } as React.CSSProperties;

  return (
    <div className={isVerified ? 'slider-verify verified' : 'slider-verify'}>
      <div className="slider-verify-head">
        <span>
          <ShieldCheck size={14} />
          {t.slideVerify}
        </span>
        <button type="button" onClick={() => void loadChallenge()} disabled={isLoading || isVerifying}>
          {isLoading ? <ButtonSpinner size={13} /> : <RefreshCcw size={13} />}
        </button>
      </div>
      <div className="puzzle-board" style={trackStyle}>
        {challenge ? (
          <>
            <img className="puzzle-image" src={challenge.backgroundImage} alt="" draggable={false} />
            <img className="puzzle-piece" src={challenge.pieceImage} alt="" draggable={false} />
          </>
        ) : (
          <span className="puzzle-loading">{t.verifying}</span>
        )}
      </div>
      <div className="slider-track" style={trackStyle}>
        <span className="slider-fill" />
        <span className="slider-thumb" />
        <span className="slider-copy">{isVerified ? t.verified : t.slideToVerify}</span>
        <input
          aria-label={t.slideVerify}
          type="range"
          min="0"
          max="100"
          step="1"
          value={value}
          onChange={updateSlider}
          onPointerUp={releaseSlider}
          onKeyUp={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              releaseSlider();
            }
          }}
          disabled={disabled}
        />
      </div>
      <span className="slider-status">{status}</span>
    </div>
  );
}

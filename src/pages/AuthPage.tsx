import { showErrorToast } from '../components/toast.js';
import { AccentTheme, AuthMode, AuthSession, Language, ThemeMode } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { AuthPanel } from './auth/AuthPanel.js';
import { SliderVerification } from './auth/SliderVerification.js';
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
      <AuthPanel
        accentTheme={accentTheme}
        displayName={displayName}
        email={email}
        isPasswordVisible={isPasswordVisible}
        language={language}
        mode={mode}
        onDisplayNameChange={setDisplayName}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={submit}
        onSwitchMode={switchMode}
        onTogglePassword={() => setIsPasswordVisible((value) => !value)}
        password={password}
        setAccentTheme={setAccentTheme}
        setLanguage={setLanguage}
        setThemeMode={setThemeMode}
        submitting={submitting}
        t={t}
        themeMode={themeMode}
      />
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

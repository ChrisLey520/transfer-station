import { ButtonSpinner } from '../../components/common.js';
import { showErrorToast } from '../../components/toast.js';
import type { AuthMode, SliderChallenge } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';
import { RefreshCcw, ShieldCheck } from 'lucide-react';
import React from 'react';

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

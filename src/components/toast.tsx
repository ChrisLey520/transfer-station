import { officialQqGroupNumber, officialQqGroupQrSrc } from '../config/purchase.js';
import { tr } from '../i18n.js';
import { ToastItem, ToastListener, ToastVariant } from '../types.js';
import { copyTextToClipboard } from '../utils/clipboard.js';
import { Activity, Ban, Check, X } from 'lucide-react';
import React from 'react';

export const toastListeners = new Set<ToastListener>();

export let nextToastId = 0;

export function showToast(message: string, variant: ToastVariant = 'info') {
  const text = message.trim();
  if (!text) return;

  const toast: ToastItem = {
    id: Date.now() + nextToastId,
    message: text,
    variant
  };
  nextToastId += 1;
  toastListeners.forEach((listener) => listener(toast));
}

export function showErrorToast(message: string) {
  showToast(message, 'error');
}

export function showSuccessToast(message: string) {
  showToast(message, 'success');
}

export function buildRechargeModalProps(t: Record<string, string>, onClose: () => void) {
  return {
    onClose,
    t,
    officialQqGroupNumber,
    officialQqGroupQrSrc,
    onCopyGroupNumber: async () => {
      await copyTextToClipboard(officialQqGroupNumber);
      showSuccessToast(`${tr(t, 'officialQQGroupNumber', '群号')}已复制`);
    }
  };
}

export function ToastViewport() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const listener: ToastListener = (toast) => {
      setToasts((current) => [...current, toast].slice(-4));
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 4200);
    };

    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.variant}`} role={toast.variant === 'error' ? 'alert' : 'status'} key={toast.id}>
          <span className="toast-mark">
            {toast.variant === 'success' ? <Check size={14} /> : toast.variant === 'error' ? <Ban size={14} /> : <Activity size={14} />}
          </span>
          <p>{toast.message}</p>
          <button type="button" className="toast-close-button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Close notification">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

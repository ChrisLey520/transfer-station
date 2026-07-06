import React from 'react';
import { showErrorToast, showSuccessToast } from '../../components/toast.js';
import type { GiftCardPreview, UpgradePlan } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';

type UsePlansPanelArgs = {
  headers: HeadersInit;
  reload: () => Promise<void>;
  t: Record<string, string>;
};

export function usePlansPanel({ headers, reload, t }: UsePlansPanelArgs) {
  const [redeemCode, setRedeemCode] = React.useState('');
  const [giftPreview, setGiftPreview] = React.useState<GiftCardPreview | null>(null);
  const [isRedeeming, setIsRedeeming] = React.useState(false);
  const [purchaseTarget, setPurchaseTarget] = React.useState<UpgradePlan | null>(null);
  const [isRechargeOpen, setIsRechargeOpen] = React.useState(false);

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    const code = redeemCode.trim();
    if (!code) return;
    if (isRedeeming) return;
    setIsRedeeming(true);
    try {
      const response = await fetch('/api/user/gift-cards/preview', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const result = payload as GiftCardPreview;
      if (result.requiresConfirmation) {
        setGiftPreview(result);
        return;
      }
      await redeemCreditGiftCard(code);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRedeeming(false);
    }
  }

  async function redeemCreditGiftCard(code: string) {
    try {
      const response = await fetch('/api/user/gift-cards/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      showSuccessToast((payload as { message?: string }).message || t.redeem);
      setRedeemCode('');
      await reload();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function confirmGiftCard() {
    if (!giftPreview) return;
    if (isRedeeming) return;
    setIsRedeeming(true);
    try {
      const response = await fetch('/api/user/gift-cards/redeem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: giftPreview.card.code, confirm: true })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setGiftPreview(null);
      setRedeemCode('');
      showSuccessToast((payload as { message?: string }).message || t.redeem);
      await reload();
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRedeeming(false);
    }
  }

  return {
    confirmGiftCard,
    giftPreview,
    isRechargeOpen,
    isRedeeming,
    purchaseTarget,
    redeem,
    redeemCode,
    setGiftPreview,
    setIsRechargeOpen,
    setPurchaseTarget,
    setRedeemCode
  };
}

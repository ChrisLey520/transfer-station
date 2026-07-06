import { showErrorToast, showSuccessToast } from '../../components/toast.js';
import { giftPlanProductOptions } from '../../config/purchase.js';
import { tr } from '../../i18n.js';
import type { AdminGiftCard, GiftCardFormType, GiftCardPage, Plan } from '../../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../../utils/api.js';
import { copyTextToClipboard } from '../../utils/clipboard.js';
import React from 'react';

const EMPTY_GIFT_CARD_PAGE: GiftCardPage = {
  giftCards: [],
  total: 0,
  typeCounts: { plan: 0, credit: 0 },
  page: 1,
  pageSize: 20
};

export function useGiftCardsPanel({
  headers,
  plans,
  refreshTick,
  t
}: {
  headers: HeadersInit;
  plans: Plan[];
  refreshTick: number;
  t: Record<string, string>;
}) {
  const eligiblePlans = React.useMemo(() => giftPlanProductOptions(plans), [plans]);
  const defaultPlanId = eligiblePlans[0]?.itemId || '';
  const [giftCardPage, setGiftCardPage] = React.useState<GiftCardPage>(EMPTY_GIFT_CARD_PAGE);
  const [generatedCards, setGeneratedCards] = React.useState<AdminGiftCard[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [giftCardFilterAction, setGiftCardFilterAction] = React.useState<GiftCardFormType | null>(null);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState('');
  const [revokeTarget, setRevokeTarget] = React.useState<AdminGiftCard | null>(null);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [isCreatingGiftCards, setIsCreatingGiftCards] = React.useState(false);
  const [isGiftCardManagementExpanded, setIsGiftCardManagementExpanded] = React.useState(true);
  const [activeGiftCardType, setActiveGiftCardType] = React.useState<GiftCardFormType>('plan');
  const [giftCardPageNumber, setGiftCardPageNumber] = React.useState(1);
  const [formType, setFormType] = React.useState<GiftCardFormType>('plan');
  const [planId, setPlanId] = React.useState(defaultPlanId);
  const [amountYuan, setAmountYuan] = React.useState('100');
  const [durationMonths, setDurationMonths] = React.useState(1);
  const [quantity, setQuantity] = React.useState(1);
  const [prefix, setPrefix] = React.useState('RH');

  React.useEffect(() => {
    if (!planId && defaultPlanId) setPlanId(defaultPlanId);
  }, [defaultPlanId, planId]);

  const loadGiftCards = React.useCallback(
    async (nextPage = giftCardPageNumber, nextType = activeGiftCardType) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          type: nextType,
          page: String(nextPage),
          pageSize: '20'
        });
        const response = await fetch(`/api/gift-cards?${params.toString()}`, { headers });
        const payload = await readJsonResponse(response);
        if (!response.ok) {
          showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
          return;
        }
        const result = payload as GiftCardPage;
        setGiftCardPage({
          giftCards: result.giftCards || [],
          total: result.total || 0,
          typeCounts: result.typeCounts || { plan: 0, credit: 0 },
          page: result.page || nextPage,
          pageSize: result.pageSize || 20
        });
      } catch (error) {
        showErrorToast(unknownErrorMessage(error, t.requestFailed));
      } finally {
        setLoading(false);
        setGiftCardFilterAction(null);
      }
    },
    [activeGiftCardType, giftCardPageNumber, headers, t.requestFailed]
  );

  React.useEffect(() => {
    void loadGiftCards();
  }, [loadGiftCards, refreshTick]);

  function openCreate(nextType: GiftCardFormType = formType) {
    setFormType(nextType);
    setPlanId((current) => current || defaultPlanId);
    setGeneratedCards([]);
    setIsCreateOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isCreatingGiftCards) return;
    setIsCreatingGiftCards(true);
    const body =
      formType === 'credit'
        ? {
            type: 'credit',
            amountCents: Math.max(1, Math.round(Number(amountYuan || 0) * 100)),
            quantity,
            prefix
          }
        : {
            type: 'plan',
            planId,
            durationMonths,
            quantity,
            prefix
          };

    try {
      const response = await fetch('/api/gift-cards', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const result = payload as { giftCards: AdminGiftCard[] };
      setGeneratedCards(result.giftCards || []);
      setActiveGiftCardType(formType);
      setGiftCardPageNumber(1);
      await loadGiftCards(1, formType);
      showSuccessToast(tr(t, 'giftCardsCreated', '礼品码已生成。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsCreatingGiftCards(false);
    }
  }

  async function copyCode(code: string) {
    await copyTextToClipboard(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(''), 1400);
  }

  async function copyGeneratedCodes() {
    if (!generatedCards.length) return;
    await copyTextToClipboard(generatedCards.map((card) => card.code).join('\n'));
    setCopiedCode('__generated__');
    window.setTimeout(() => setCopiedCode(''), 1400);
  }

  async function revokeGiftCard(card: AdminGiftCard) {
    if (isRevoking) return;
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/gift-cards/${encodeURIComponent(card.code)}/revoke`, {
        method: 'PATCH',
        headers
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setRevokeTarget(null);
      await loadGiftCards();
      showSuccessToast(tr(t, 'giftCardRevoked', '兑换码已撤销。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setIsRevoking(false);
    }
  }

  function changeGiftCardType(nextType: GiftCardFormType) {
    if (loading || nextType === activeGiftCardType) return;
    setGiftCardFilterAction(nextType);
    setActiveGiftCardType(nextType);
    setGiftCardPageNumber(1);
  }

  return {
    activeGiftCardType,
    amountYuan,
    changeGiftCardType,
    copiedCode,
    copyCode,
    copyGeneratedCodes,
    durationMonths,
    eligiblePlans,
    formType,
    generatedCards,
    giftCardFilterAction,
    giftCardPage,
    isCreateOpen,
    isCreatingGiftCards,
    isGiftCardManagementExpanded,
    isRevoking,
    loading,
    openCreate,
    planId,
    prefix,
    quantity,
    revokeGiftCard,
    revokeTarget,
    setAmountYuan,
    setDurationMonths,
    setFormType,
    setGiftCardPageNumber,
    setIsCreateOpen,
    setIsGiftCardManagementExpanded,
    setPlanId,
    setPrefix,
    setQuantity,
    setRevokeTarget,
    submit
  };
}

import type { Plan } from '../types.js';
import { TaobaoAutomationPanel } from './TaobaoAutomationPanel.js';
import { GiftCardManagementPanel } from './gift-cards/GiftCardManagementPanel.js';
import { CreateGiftCardModal, RevokeGiftCardModal } from './gift-cards/GiftCardModals.js';
import { useGiftCardsPanel } from './gift-cards/useGiftCardsPanel.js';

export function GiftCardsPanel({ headers, plans, refreshTick, t }: { headers: HeadersInit; plans: Plan[]; refreshTick: number; t: Record<string, string> }) {
  const giftCards = useGiftCardsPanel({ headers, plans, refreshTick, t });

  return (
    <section className="content-grid">
      <GiftCardManagementPanel
        activeGiftCardType={giftCards.activeGiftCardType}
        copiedCode={giftCards.copiedCode}
        giftCardFilterAction={giftCards.giftCardFilterAction}
        giftCardPage={giftCards.giftCardPage}
        isExpanded={giftCards.isGiftCardManagementExpanded}
        loading={giftCards.loading}
        onChangeGiftCardType={giftCards.changeGiftCardType}
        onCopyCode={giftCards.copyCode}
        onOpenCreate={() => giftCards.openCreate()}
        onPageChange={giftCards.setGiftCardPageNumber}
        onRequestRevoke={giftCards.setRevokeTarget}
        onToggleExpanded={() => giftCards.setIsGiftCardManagementExpanded((value) => !value)}
        t={t}
      />
      <TaobaoAutomationPanel headers={headers} plans={giftCards.eligiblePlans} refreshTick={refreshTick} t={t} />

      {giftCards.isCreateOpen ? (
        <CreateGiftCardModal
          amountYuan={giftCards.amountYuan}
          copiedCode={giftCards.copiedCode}
          durationMonths={giftCards.durationMonths}
          eligiblePlans={giftCards.eligiblePlans}
          formType={giftCards.formType}
          generatedCards={giftCards.generatedCards}
          isCreatingGiftCards={giftCards.isCreatingGiftCards}
          planId={giftCards.planId}
          prefix={giftCards.prefix}
          quantity={giftCards.quantity}
          setAmountYuan={giftCards.setAmountYuan}
          setDurationMonths={giftCards.setDurationMonths}
          setFormType={giftCards.setFormType}
          setPlanId={giftCards.setPlanId}
          setPrefix={giftCards.setPrefix}
          setQuantity={giftCards.setQuantity}
          onCancel={() => giftCards.setIsCreateOpen(false)}
          onCopyGeneratedCodes={giftCards.copyGeneratedCodes}
          onSubmit={giftCards.submit}
          t={t}
        />
      ) : null}
      {giftCards.revokeTarget ? (
        <RevokeGiftCardModal
          isRevoking={giftCards.isRevoking}
          revokeTarget={giftCards.revokeTarget}
          onCancel={() => giftCards.setRevokeTarget(null)}
          onRevoke={giftCards.revokeGiftCard}
          t={t}
        />
      ) : null}
    </section>
  );
}

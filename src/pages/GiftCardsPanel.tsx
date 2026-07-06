import { Empty, LoadingContent } from '../components/common.js';
import { showErrorToast, showSuccessToast } from '../components/toast.js';
import { giftPlanProductOptions, planProductOptionLabel } from '../config/purchase.js';
import { tr } from '../i18n.js';
import { AdminGiftCard, GiftCardCard, GiftCardFormType, GiftCardPage, GiftCardPreview, Plan } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { copyTextToClipboard } from '../utils/clipboard.js';
import { compact, currency } from '../utils/format.js';
import { formatDateTime, fullDate } from '../utils/time.js';
import { PaginationBar } from './PaginationBar.js';
import { TaobaoAutomationPanel } from './TaobaoAutomationPanel.js';
import { Ban, Check, ChevronDown, Copy, Gift, Plus } from 'lucide-react';
import React from 'react';

export function GiftCardsPanel({ headers, plans, refreshTick, t }: { headers: HeadersInit; plans: Plan[]; refreshTick: number; t: Record<string, string> }) {
  const eligiblePlans = React.useMemo(() => giftPlanProductOptions(plans), [plans]);
  const defaultPlanId = eligiblePlans[0]?.itemId || '';
  const [giftCardPage, setGiftCardPage] = React.useState<GiftCardPage>({
    giftCards: [],
    total: 0,
    typeCounts: { plan: 0, credit: 0 },
    page: 1,
    pageSize: 20
  });
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

  const loadGiftCards = React.useCallback(async (nextPage = giftCardPageNumber, nextType = activeGiftCardType) => {
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
  }, [activeGiftCardType, giftCardPageNumber, headers, t.requestFailed]);

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

  const planGiftCardCount = giftCardPage.typeCounts.plan || 0;
  const creditGiftCardCount = giftCardPage.typeCounts.credit || 0;

  function changeGiftCardType(nextType: GiftCardFormType) {
    if (loading || nextType === activeGiftCardType) return;
    setGiftCardFilterAction(nextType);
    setActiveGiftCardType(nextType);
    setGiftCardPageNumber(1);
  }

  return (
    <section className="content-grid">
      <section className="table-panel collapsible-panel">
        <div className="section-heading">
          <div>
            <div className="channel-title-row">
              <button
                type="button"
                className="channel-toggle-button"
                onClick={() => setIsGiftCardManagementExpanded((value) => !value)}
                aria-expanded={isGiftCardManagementExpanded}
                title={isGiftCardManagementExpanded ? t.collapse : t.expand}
              >
                <ChevronDown size={16} className={isGiftCardManagementExpanded ? 'rotate-icon open' : 'rotate-icon'} />
              </button>
              <h2>{tr(t, 'giftCardManagement', '礼品码管理')}</h2>
            </div>
            <p>{tr(t, 'giftCardManagementHint', '创建套餐卡或余额卡，复制生成的卡密后发放给用户兑换。')}</p>
          </div>
          <button type="button" className="primary-button" onClick={() => openCreate()}>
            <Plus size={17} />
            {tr(t, 'createGiftCard', '生成礼品码')}
          </button>
        </div>
        {isGiftCardManagementExpanded ? (
          <div className="collapsible-panel-body">
            {loading ? <div className="loading-line" /> : null}
            <div className="gift-card-tabs" role="tablist" aria-label={tr(t, 'giftCardType', '礼品卡类型')}>
              <button
                type="button"
                className={activeGiftCardType === 'plan' ? 'gift-card-tab active' : 'gift-card-tab'}
                onClick={() => changeGiftCardType('plan')}
                disabled={loading}
              >
                <LoadingContent loading={giftCardFilterAction === 'plan'} loadingLabel={tr(t, 'giftCardPlanType', '套餐')}>
                  {tr(t, 'giftCardPlanType', '套餐')}
                </LoadingContent>
                <span>{planGiftCardCount}</span>
              </button>
              <button
                type="button"
                className={activeGiftCardType === 'credit' ? 'gift-card-tab active' : 'gift-card-tab'}
                onClick={() => changeGiftCardType('credit')}
                disabled={loading}
              >
                <LoadingContent loading={giftCardFilterAction === 'credit'} loadingLabel={tr(t, 'giftCardCreditType', '余额')}>
                  {tr(t, 'giftCardCreditType', '余额')}
                </LoadingContent>
                <span>{creditGiftCardCount}</span>
              </button>
            </div>
            <GiftCardRows
              giftCards={giftCardPage.giftCards}
              copiedCode={copiedCode}
              onCopy={copyCode}
              onRequestRevoke={setRevokeTarget}
              t={t}
            />
            <PaginationBar
              page={giftCardPage.page}
              pageSize={giftCardPage.pageSize}
              total={giftCardPage.total}
              onPageChange={setGiftCardPageNumber}
              loading={loading}
              t={t}
              totalLabel={tr(t, 'giftCardTotal', '共 {total} 个礼品码').replace('{total}', String(giftCardPage.total))}
            />
          </div>
        ) : null}
      </section>
      <TaobaoAutomationPanel headers={headers} plans={eligiblePlans} refreshTick={refreshTick} t={t} />

      {isCreateOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-panel gift-card-create-panel" onSubmit={submit}>
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'createGiftCard', '生成礼品码')}</h2>
                <p>{formType === 'plan' ? tr(t, 'giftCardPlanType', '套餐') : tr(t, 'giftCardCreditType', '余额')}</p>
              </div>
            </div>
            <label>
              {tr(t, 'giftCardType', '礼品卡类型')}
              <div className="agent-options gift-card-type-options" role="radiogroup" aria-label={tr(t, 'giftCardType', '礼品卡类型')}>
                <button
                  type="button"
                  className={formType === 'plan' ? 'agent-option active' : 'agent-option'}
                  onClick={() => setFormType('plan')}
                >
                  {tr(t, 'giftCardPlanType', '套餐')}
                </button>
                <button
                  type="button"
                  className={formType === 'credit' ? 'agent-option active' : 'agent-option'}
                  onClick={() => setFormType('credit')}
                >
                  {tr(t, 'giftCardCreditType', '余额')}
                </button>
              </div>
            </label>
            {formType === 'plan' ? (
              <>
                <label>
                  {t.plan}
                  <select value={planId} onChange={(event) => setPlanId(event.target.value)} required>
                    {eligiblePlans.map((plan) => (
                      <option value={plan.itemId} key={plan.itemId}>
                        {planProductOptionLabel(plan)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr(t, 'giftCardDuration', '有效月份')}
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={durationMonths}
                    onChange={(event) => setDurationMonths(Number(event.target.value))}
                    required
                  />
                </label>
              </>
            ) : (
              <label>
                {tr(t, 'giftCardAmount', '余额金额')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountYuan}
                  onChange={(event) => setAmountYuan(event.target.value)}
                  required
                />
              </label>
            )}
            <div className="gift-card-form-grid">
              <label>
                {tr(t, 'giftCardQuantity', '生成数量')}
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  required
                />
              </label>
              <label>
                {tr(t, 'giftCardPrefix', '卡密前缀')}
                <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="RH" />
              </label>
            </div>
            {generatedCards.length ? (
              <div className="generated-gift-cards">
                <div className="generated-gift-cards-head">
                  <strong>{tr(t, 'generatedGiftCards', '本次生成')}</strong>
                  <button type="button" className="secondary-button" onClick={copyGeneratedCodes}>
                    {copiedCode === '__generated__' ? <Check size={15} /> : <Copy size={15} />}
                    {t.copy}
                  </button>
                </div>
                <div className="generated-code-list">
                  {generatedCards.map((card) => (
                    <code key={card.code}>{card.code}</code>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setIsCreateOpen(false)} disabled={isCreatingGiftCards}>
                {t.cancel}
              </button>
              <button type="submit" className="primary-button" disabled={isCreatingGiftCards || (formType === 'plan' && !eligiblePlans.length)}>
                <LoadingContent loading={isCreatingGiftCards} icon={<Gift size={16} />} loadingLabel={tr(t, 'creating', '生成中...')}>
                  {tr(t, 'createGiftCard', '生成礼品码')}
                </LoadingContent>
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {revokeTarget ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel">
            <div className="section-heading">
              <div>
                <h2>{tr(t, 'revokeGiftCard', '撤销兑换码')}</h2>
                <p>{revokeTarget.code}</p>
              </div>
            </div>
            <p className="modal-copy">{tr(t, 'revokeGiftCardConfirm', '确认撤销这个未使用的兑换码？撤销后用户将无法兑换。')}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setRevokeTarget(null)} disabled={isRevoking}>
                {t.cancel}
              </button>
              <button type="button" className="danger-button" onClick={() => revokeGiftCard(revokeTarget)} disabled={isRevoking}>
                <LoadingContent loading={isRevoking} icon={<Ban size={16} />} loadingLabel={tr(t, 'revoking', '撤销中...')}>
                  {tr(t, 'revokeGiftCard', '撤销兑换码')}
                </LoadingContent>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function GiftCardRows({
  giftCards,
  copiedCode,
  onCopy,
  onRequestRevoke,
  t
}: {
  giftCards: AdminGiftCard[];
  copiedCode: string;
  onCopy: (code: string) => Promise<void>;
  onRequestRevoke: (card: AdminGiftCard) => void;
  t: Record<string, string>;
}) {
  if (!giftCards.length) return <Empty t={t} />;

  return (
    <div className="gift-card-table">
      <div className="gift-card-table-head">
        <span>{t.keyValue}</span>
        <span>{tr(t, 'giftCardType', '礼品卡类型')}</span>
        <span>{t.plan}</span>
        <span>{tr(t, 'giftCardAmount', '余额金额')}</span>
        <span>{t.status}</span>
        <span>{tr(t, 'createdBy', '创建人')}</span>
        <span>{tr(t, 'redeemedBy', '使用人')}</span>
        <span>{t.createdAt}</span>
        <span>{t.action}</span>
      </div>
      {giftCards.map((card) => (
        <article className="gift-card-row" key={card.code}>
          <div className="key-secret-cell">
            <code>{card.code}</code>
            <button type="button" className="icon-button compact" onClick={() => onCopy(card.code)} title={t.copy}>
              {copiedCode === card.code ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <span>{card.type === 'plan' ? tr(t, 'giftCardPlanType', '套餐') : tr(t, 'giftCardCreditType', '余额')}</span>
          <div className="gift-card-plan-cell">
            <strong>{card.planName || '-'}</strong>
            {card.type === 'plan' ? (
              <small>
                {card.durationMonths} {tr(t, 'giftCardDuration', '有效月份')} · {currency(card.fiveHourTokenLimit, 'USD')} / 5h
              </small>
            ) : null}
          </div>
          <span>{card.type === 'credit' ? currency(card.amountCents, 'CNY') : '-'}</span>
          <div className="gift-card-status-cell">
            <span className={card.revokedAt ? 'status-pill danger' : card.redeemedAt ? 'status-pill warn' : 'status-pill'}>
              {card.revokedAt ? tr(t, 'revoked', '已撤销') : card.redeemedAt ? tr(t, 'redeemed', '已兑换') : tr(t, 'unredeemed', '未兑换')}
            </span>
            {card.revokedAt ? (
              <small>
                {tr(t, 'revokedBy', '撤销人')}: {card.revokedByEmail || card.revokedByUserId || '-'}
              </small>
            ) : null}
          </div>
          <span>{card.createdByEmail || card.createdByUserId || '-'}</span>
          <span>{card.redeemedByEmail || card.redeemedByUserId || '-'}</span>
          <span>{card.createdAt ? fullDate(card.createdAt) : '-'}</span>
          <div className="row-actions">
            <button type="button" className="icon-button compact" onClick={() => onCopy(card.code)} title={t.copy} aria-label={t.copy}>
              {copiedCode === card.code ? <Check size={15} /> : <Copy size={15} />}
            </button>
            {!card.redeemedAt && !card.revokedAt ? (
              <button
                type="button"
                className="icon-button danger compact"
                onClick={() => onRequestRevoke(card)}
                title={tr(t, 'revokeGiftCard', '撤销兑换码')}
                aria-label={tr(t, 'revokeGiftCard', '撤销兑换码')}
              >
                <Ban size={15} />
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function GiftCardConfirmModal({
  preview,
  t,
  disabled,
  onConfirm,
  onClose
}: {
  preview: GiftCardPreview;
  t: Record<string, string>;
  disabled: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal-panel gift-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-card-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <h2 id="gift-card-confirm-title">{t.redeemCard}</h2>
            <p>{preview.message}</p>
          </div>
        </div>
        <div className="gift-card-summary">
          <div>
            <span>{t.plan}</span>
            <strong>{preview.card.planName || '-'}</strong>
          </div>
          <div>
            <span>{t.fiveHourQuota}</span>
            <strong>{currency(preview.card.fiveHourTokenLimit, 'USD')}</strong>
          </div>
          <div>
            <span>{t.weeklyQuota}</span>
            <strong>{currency(preview.card.weeklyTokenLimit, 'USD')}</strong>
          </div>
        </div>
        <p className="gift-card-warning">
          {preview.consequence === 'extend'
            ? '同级套餐将延长一个月。'
            : '立即使用后，此前更低级的套餐将被覆盖且无法恢复。'}
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={disabled}>
            {t.cancel}
          </button>
          <button type="button" className="primary-button" onClick={onConfirm} disabled={disabled}>
            <LoadingContent loading={disabled} loadingLabel={tr(t, 'redeeming', '兑换中...')}>
              {t.redeem}
            </LoadingContent>
          </button>
        </div>
      </section>
    </div>
  );
}

export function GiftRedemptionTable({ giftCards }: { giftCards: GiftCardCard[] }) {
  if (!giftCards.length) return <div className="table-empty">暂无记录</div>;
  return (
    <div className="gift-card-table">
      <div className="gift-card-table-head">
        <span>兑换码</span>
        <span>类型</span>
        <span>套餐/额度</span>
        <span>兑换用户</span>
        <span>兑换时间</span>
      </div>
      {giftCards.map((card) => (
        <article className="gift-card-row" key={card.code}>
          <code>{card.code}</code>
          <span>{card.type === 'plan' ? '套餐' : '余额'}</span>
          <span>{card.type === 'plan' ? `${card.planName || '-'} / ${card.durationMonths}月` : currency(card.amountCents, 'USD')}</span>
          <span>{card.redeemedByEmail || card.redeemedByUserId || '-'}</span>
          <span>{card.redeemedAt ? formatDateTime(card.redeemedAt) : '-'}</span>
        </article>
      ))}
    </div>
  );
}

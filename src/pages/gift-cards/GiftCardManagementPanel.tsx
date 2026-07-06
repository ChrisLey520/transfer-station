import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { AdminGiftCard, GiftCardFormType, GiftCardPage } from '../../types.js';
import { PaginationBar } from '../PaginationBar.js';
import { ChevronDown, Plus } from 'lucide-react';
import { GiftCardRows } from './GiftCardTables.js';

export function GiftCardManagementPanel({
  activeGiftCardType,
  copiedCode,
  giftCardFilterAction,
  giftCardPage,
  isExpanded,
  loading,
  onChangeGiftCardType,
  onCopyCode,
  onOpenCreate,
  onPageChange,
  onRequestRevoke,
  onToggleExpanded,
  t
}: {
  activeGiftCardType: GiftCardFormType;
  copiedCode: string;
  giftCardFilterAction: GiftCardFormType | null;
  giftCardPage: GiftCardPage;
  isExpanded: boolean;
  loading: boolean;
  onChangeGiftCardType: (type: GiftCardFormType) => void;
  onCopyCode: (code: string) => Promise<void>;
  onOpenCreate: () => void;
  onPageChange: (page: number) => void;
  onRequestRevoke: (card: AdminGiftCard) => void;
  onToggleExpanded: () => void;
  t: Record<string, string>;
}) {
  const planGiftCardCount = giftCardPage.typeCounts.plan || 0;
  const creditGiftCardCount = giftCardPage.typeCounts.credit || 0;

  return (
    <section className="table-panel collapsible-panel">
      <div className="section-heading">
        <div>
          <div className="channel-title-row">
            <button
              type="button"
              className="channel-toggle-button"
              onClick={onToggleExpanded}
              aria-expanded={isExpanded}
              title={isExpanded ? t.collapse : t.expand}
            >
              <ChevronDown size={16} className={isExpanded ? 'rotate-icon open' : 'rotate-icon'} />
            </button>
            <h2>{tr(t, 'giftCardManagement', '礼品码管理')}</h2>
          </div>
          <p>{tr(t, 'giftCardManagementHint', '创建套餐卡或余额卡，复制生成的卡密后发放给用户兑换。')}</p>
        </div>
        <button type="button" className="primary-button" onClick={onOpenCreate}>
          <Plus size={17} />
          {tr(t, 'createGiftCard', '生成礼品码')}
        </button>
      </div>
      {isExpanded ? (
        <div className="collapsible-panel-body">
          {loading ? <div className="loading-line" /> : null}
          <div className="gift-card-tabs" role="tablist" aria-label={tr(t, 'giftCardType', '礼品卡类型')}>
            <button
              type="button"
              className={activeGiftCardType === 'plan' ? 'gift-card-tab active' : 'gift-card-tab'}
              onClick={() => onChangeGiftCardType('plan')}
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
              onClick={() => onChangeGiftCardType('credit')}
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
            onCopy={onCopyCode}
            onRequestRevoke={onRequestRevoke}
            t={t}
          />
          <PaginationBar
            page={giftCardPage.page}
            pageSize={giftCardPage.pageSize}
            total={giftCardPage.total}
            onPageChange={onPageChange}
            loading={loading}
            t={t}
            totalLabel={tr(t, 'giftCardTotal', '共 {total} 个礼品码').replace('{total}', String(giftCardPage.total))}
          />
        </div>
      ) : null}
    </section>
  );
}

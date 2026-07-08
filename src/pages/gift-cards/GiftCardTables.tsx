import { Empty } from '../../components/common.js';
import { DataTable } from '../../components/DataTable.js';
import { tr } from '../../i18n.js';
import type { AdminGiftCard, GiftCardCard } from '../../types.js';
import { currency } from '../../utils/format.js';
import { formatDateTime, fullDate } from '../../utils/time.js';
import { Ban, Check, Copy } from 'lucide-react';

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
  return (
    <DataTable
      className="gift-card-table"
      headClassName="gift-card-table-head"
      rowClassName="gift-card-row"
      headers={[t.keyValue, tr(t, 'giftCardType', '礼品卡类型'), t.plan, tr(t, 'giftCardAmount', '余额金额'), t.status, tr(t, 'createdBy', '创建人'), tr(t, 'redeemedBy', '使用人'), t.createdAt, t.action]}
      items={giftCards}
      getItemKey={(card) => card.code}
      empty={<Empty t={t} />}
      renderRow={(card) => (
        <>
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
        </>
      )}
    />
  );
}

export function GiftRedemptionTable({ giftCards, className }: { giftCards: GiftCardCard[]; className?: string }) {
  const tableClassName = className ? `gift-card-table ${className}` : 'gift-card-table';
  const emptyClassName = className ? `table-empty ${className}` : 'table-empty';

  return (
    <DataTable
      className={tableClassName}
      headClassName="gift-card-table-head"
      rowClassName="gift-card-row"
      headers={['兑换码', '类型', '套餐/额度', '兑换用户', '兑换时间']}
      items={giftCards}
      getItemKey={(card) => card.code}
      empty={<div className={emptyClassName}>暂无记录</div>}
      renderRow={(card) => (
        <>
          <code>{card.code}</code>
          <span>{card.type === 'plan' ? '套餐' : '余额'}</span>
          <span>{card.type === 'plan' ? `${card.planName || '-'} / ${card.durationMonths}月` : currency(card.amountCents, 'USD')}</span>
          <span>{card.redeemedByEmail || card.redeemedByUserId || '-'}</span>
          <span>{card.redeemedAt ? formatDateTime(card.redeemedAt) : '-'}</span>
        </>
      )}
    />
  );
}

import { Empty } from '../../components/common.js';
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

export function GiftRedemptionTable({ giftCards, className }: { giftCards: GiftCardCard[]; className?: string }) {
  if (!giftCards.length) return <div className={className ? `table-empty ${className}` : 'table-empty'}>暂无记录</div>;
  return (
    <div className={className ? `gift-card-table ${className}` : 'gift-card-table'}>
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

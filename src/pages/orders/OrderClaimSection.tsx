import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { ClaimedOrder } from '../../types.js';
import { Check, Copy } from 'lucide-react';
import type React from 'react';
import { orderKey } from './orderUtils.js';

export function OrderClaimSection({
  claimResult,
  copiedKey,
  isClaiming,
  onClaim,
  onCopyCodes,
  onOrderIdChange,
  orderId,
  t
}: {
  claimResult: ClaimedOrder[];
  copiedKey: string;
  isClaiming: boolean;
  onClaim: (event: React.FormEvent) => void;
  onCopyCodes: (orders: ClaimedOrder[], key: string) => Promise<void>;
  onOrderIdChange: (value: string) => void;
  orderId: string;
  t: Record<string, string>;
}) {
  return (
    <section className="table-panel">
      <div className="section-heading">
        <div>
          <h2>{tr(t, 'claimOrderTitle', '订单取码')}</h2>
          <p>{tr(t, 'claimOrderHint', '输入已付款订单号，领取系统自动生成的兑换码。')}</p>
        </div>
      </div>
      <form className="claim-form" onSubmit={onClaim}>
        <input
          value={orderId}
          onChange={(event) => onOrderIdChange(event.target.value)}
          placeholder={tr(t, 'orderNumberPlaceholder', '请输入订单号')}
          aria-label={tr(t, 'orderNumber', '订单号')}
          required
        />
        <button type="submit" className="primary-button" disabled={isClaiming || !orderId.trim()}>
          <LoadingContent loading={isClaiming} loadingLabel={tr(t, 'verifying', '验证中...')}>
            {tr(t, 'claimOrderCode', '领取兑换码')}
          </LoadingContent>
        </button>
      </form>
      {claimResult.length ? (
        <div className="claim-result">
          <div className="generated-gift-cards-head">
            <strong>{tr(t, 'giftCards', '礼品码')}</strong>
            <button type="button" className="secondary-button" onClick={() => void onCopyCodes(claimResult, 'claim-result')}>
              {copiedKey === 'claim-result' ? <Check size={15} /> : <Copy size={15} />}
              {copiedKey === 'claim-result' ? tr(t, 'copiedCodes', '已复制兑换码') : tr(t, 'copyCodes', '复制兑换码')}
            </button>
          </div>
          {claimResult.map((order) => (
            <article className="claim-code-row" key={orderKey(order)}>
              <span>{order.title || order.subOrderId}</span>
              <code>{order.giftCardCode}</code>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

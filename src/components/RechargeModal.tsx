import React from 'react';
import { Copy, Download } from 'lucide-react';

type RechargeModalProps = {
  onClose: () => void;
  t: Record<string, string>;
  officialQqGroupNumber: string;
  officialQqGroupQrSrc: string;
  onCopyGroupNumber: () => Promise<void>;
};

function tr(t: Record<string, string>, key: string, fallback: string) {
  return t[key] || fallback;
}

export function RechargeModal({
  onClose,
  t,
  officialQqGroupNumber,
  officialQqGroupQrSrc,
  onCopyGroupNumber
}: RechargeModalProps) {
  function handleDownloadQr() {
    const link = document.createElement('a');
    link.href = officialQqGroupQrSrc;
    link.download = 'relayhub-qq-group-2.jpg';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal-panel purchase-suspended-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-suspended-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <h2 id="purchase-suspended-title">{tr(t, 'purchaseSuspendedTitle', '购买渠道暂停通知')}</h2>
            <p>{tr(t, 'purchaseSuspendedDescription', '由于淘宝和闲鱼禁止上架 GPT 和 Claude Code 商品，现已暂停该购买渠道，请加入官方 QQ 交流群找群主进行购买。')}</p>
          </div>
        </div>
        <div className="purchase-suspended-content">
          <div className="purchase-suspended-card purchase-suspended-notice purchase-group-card-centered">
            <strong>{tr(t, 'officialQQGroup', '官方 QQ 交流群')}</strong>
            <div className="purchase-suspended-group-row">
              <span>{tr(t, 'officialQQGroupNumber', '群号')}：{officialQqGroupNumber}</span>
              <button
                type="button"
                className="icon-button compact"
                onClick={() => void onCopyGroupNumber()}
                title={t.copy}
                aria-label={t.copy}
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
          <div className="purchase-suspended-card purchase-suspended-qr-wrap">
            <img className="purchase-suspended-qr" src={officialQqGroupQrSrc} alt={tr(t, 'officialQQGroup', '官方 QQ 交流群')} />
            <button type="button" className="secondary-button purchase-suspended-download" onClick={handleDownloadQr}>
              <Download size={16} />
              下载二维码
            </button>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            关闭
          </button>
        </div>
      </section>
    </div>
  );
}

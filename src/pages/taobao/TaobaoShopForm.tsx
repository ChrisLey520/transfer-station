import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import { KeyRound } from 'lucide-react';
import type React from 'react';

type TaobaoShopFormProps = {
  authorizingTaobao: boolean;
  onShopIdChange: (value: string) => void;
  onShopNickChange: (value: string) => void;
  onSessionExpiresAtChange: (value: string) => void;
  onSessionKeyChange: (value: string) => void;
  onStartOauth: () => void;
  onSubmit: (event: React.FormEvent) => void;
  savingShop: boolean;
  sessionExpiresAt: string;
  sessionKey: string;
  shopId: string;
  shopNick: string;
  t: Record<string, string>;
};

export function TaobaoShopForm({
  authorizingTaobao,
  onShopIdChange,
  onShopNickChange,
  onSessionExpiresAtChange,
  onSessionKeyChange,
  onStartOauth,
  onSubmit,
  savingShop,
  sessionExpiresAt,
  sessionKey,
  shopId,
  shopNick,
  t
}: TaobaoShopFormProps) {
  return (
    <form className="taobao-mapping-form taobao-shop-form" onSubmit={onSubmit}>
      <div className="taobao-permit-panel taobao-oauth-panel">
        <div>
          <h3>授权淘宝店铺</h3>
          <p>推荐直接跳转淘宝授权，系统会自动写入 SessionKey 和过期时间。</p>
        </div>
        <button type="button" className="secondary-button taobao-oauth-button" onClick={onStartOauth} disabled={authorizingTaobao}>
          <LoadingContent loading={authorizingTaobao} icon={<KeyRound size={16} />} loadingLabel="等待淘宝授权...">
            点击授权淘宝店铺
          </LoadingContent>
        </button>
      </div>
      <label>
        店铺 ID
        <input value={shopId} onChange={(event) => onShopIdChange(event.target.value)} required />
      </label>
      <label>
        店铺昵称
        <input value={shopNick} onChange={(event) => onShopNickChange(event.target.value)} placeholder={tr(t, 'optional', '可选')} />
      </label>
      <label>
        Session Key
        <input value={sessionKey} onChange={(event) => onSessionKeyChange(event.target.value)} required />
      </label>
      <label>
        过期时间
        <input type="datetime-local" value={sessionExpiresAt} onChange={(event) => onSessionExpiresAtChange(event.target.value)} />
      </label>
      <button type="submit" className="primary-button" disabled={savingShop}>
        <LoadingContent loading={savingShop} icon={<KeyRound size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
          保存授权
        </LoadingContent>
      </button>
    </form>
  );
}

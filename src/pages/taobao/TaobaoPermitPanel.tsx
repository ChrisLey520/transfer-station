import { LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { TaobaoShop } from '../../types.js';
import { ShieldCheck } from 'lucide-react';

type TaobaoPermitPanelProps = {
  onPermit: () => void;
  onPermitShopIdChange: (value: string) => void;
  permitShopId: string;
  permittingShopId: string;
  shops: TaobaoShop[];
  t: Record<string, string>;
};

export function TaobaoPermitPanel({ onPermit, onPermitShopIdChange, permitShopId, permittingShopId, shops, t }: TaobaoPermitPanelProps) {
  return (
    <div className="taobao-permit-panel">
      <div>
        <h3>{tr(t, 'taobaoShopPermit', '店铺消息服务')}</h3>
        <p>{tr(t, 'taobaoShopPermitHint', '保存店铺 Session 后开通 TMC，淘宝付款消息会触发自动生成兑换码。')}</p>
      </div>
      <div className="taobao-permit-row">
        <select value={permitShopId} onChange={(event) => onPermitShopIdChange(event.target.value)}>
          <option value="">{tr(t, 'selectShop', '选择店铺')}</option>
          {shops.map((shop) => (
            <option value={shop.id} key={shop.id}>
              {shop.nick || shop.id}
            </option>
          ))}
        </select>
        <button type="button" className="secondary-button" disabled={!permitShopId || Boolean(permittingShopId)} onClick={onPermit}>
          <LoadingContent loading={permittingShopId === permitShopId} icon={<ShieldCheck size={16} />} loadingLabel="开通中...">
            开通 TMC
          </LoadingContent>
        </button>
      </div>
    </div>
  );
}

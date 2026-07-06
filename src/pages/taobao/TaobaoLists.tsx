import { ButtonSpinner, Empty, LoadingContent } from '../../components/common.js';
import { tr } from '../../i18n.js';
import type { PlatformOrder, TaobaoProductMapping, TaobaoShop } from '../../types.js';
import { fullDate } from '../../utils/time.js';
import { ShieldCheck, Trash2 } from 'lucide-react';

type TaobaoListsProps = {
  deletingMappingId: string;
  mappings: TaobaoProductMapping[];
  mappingProductLabel: (mapping: TaobaoProductMapping) => string;
  onDeleteMapping: (mapping: TaobaoProductMapping) => void;
  onPermitMessages: (shopId: string) => void;
  orders: PlatformOrder[];
  permittingShopId: string;
  shops: TaobaoShop[];
  t: Record<string, string>;
};

export function TaobaoLists({
  deletingMappingId,
  mappings,
  mappingProductLabel,
  onDeleteMapping,
  onPermitMessages,
  orders,
  permittingShopId,
  shops,
  t
}: TaobaoListsProps) {
  return (
    <>
      <div className="taobao-split-grid">
        <div>
          <h3>{tr(t, 'taobaoShops', '已授权店铺')}</h3>
          <div className="taobao-mini-list">
            {shops.length ? (
              shops.map((shop) => (
                <article className="taobao-mini-row taobao-shop-row" key={shop.id}>
                  <div>
                    <strong>{shop.nick || shop.id}</strong>
                    <span>{shop.id}</span>
                  </div>
                  <span>{shop.sessionExpiresAt ? fullDate(shop.sessionExpiresAt) : '-'}</span>
                  <span className={shop.messagePermittedAt ? 'status-code ok' : 'status-code error'}>{shop.messagePermittedAt ? 'TMC' : '未开通'}</span>
                  <button type="button" className="secondary-button" onClick={() => onPermitMessages(shop.id)} disabled={Boolean(permittingShopId)}>
                    <LoadingContent loading={permittingShopId === shop.id} icon={<ShieldCheck size={15} />} loadingLabel="开通中...">
                      TMC
                    </LoadingContent>
                  </button>
                </article>
              ))
            ) : (
              <Empty t={t} />
            )}
          </div>
        </div>
        <div>
          <h3>{tr(t, 'taobaoMappings', '商品映射')}</h3>
          <div className="taobao-mini-list">
            {mappings.length ? (
              mappings.map((mapping) => (
                <article className="taobao-mini-row" key={mapping.id}>
                  <div>
                    <strong>{mapping.title || mappingProductLabel(mapping)}</strong>
                    <span>
                      淘宝商品 {mapping.numIid}
                      {mapping.skuId ? ` / SKU ${mapping.skuId}` : ''}
                    </span>
                  </div>
                  <span>{mappingProductLabel(mapping)}</span>
                  <button type="button" className="icon-button danger" onClick={() => onDeleteMapping(mapping)} title={t.delete} disabled={Boolean(deletingMappingId)}>
                    {deletingMappingId === mapping.id ? <ButtonSpinner size={15} /> : <Trash2 size={15} />}
                  </button>
                </article>
              ))
            ) : (
              <Empty t={t} />
            )}
          </div>
        </div>
      </div>

      <div className="taobao-split-grid">
        <div>
          <h3>{tr(t, 'taobaoRecentOrders', '最近订单')}</h3>
          <div className="taobao-mini-list">
            {orders.length ? (
              orders.map((order) => (
                <article className="taobao-mini-row" key={order.id}>
                  <div>
                    <strong>{order.orderId}</strong>
                    <span>{order.title || order.itemId}</span>
                  </div>
                  <span className={order.deliveryStatus === 'ready' || order.deliveryStatus === 'claimed' ? 'status-code ok' : 'status-code error'}>
                    {order.deliveryStatus}
                  </span>
                  <code>{order.giftCardCode || '-'}</code>
                </article>
              ))
            ) : (
              <Empty t={t} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

import { ButtonSpinner, Empty, LoadingContent } from '../components/common.js';
import { showErrorToast, showSuccessToast } from '../components/toast.js';
import { creditProductOptions, planProductOptionLabel } from '../config/purchase.js';
import { tr } from '../i18n.js';
import { GiftCardFormType, PlanProductOption, PlatformOrder, PurchaseProductOption, TaobaoProductMapping, TaobaoShop } from '../types.js';
import { readJsonResponse, responseErrorMessage, unknownErrorMessage } from '../utils/api.js';
import { currency } from '../utils/format.js';
import { fullDate } from '../utils/time.js';
import { ChevronDown, KeyRound, Plus, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react';
import React from 'react';

export function TaobaoAutomationPanel({ headers, plans, refreshTick, t }: { headers: HeadersInit; plans: PlanProductOption[]; refreshTick: number; t: Record<string, string> }) {
  const [shops, setShops] = React.useState<TaobaoShop[]>([]);
  const [mappings, setMappings] = React.useState<TaobaoProductMapping[]>([]);
  const [orders, setOrders] = React.useState<PlatformOrder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [shopId, setShopId] = React.useState('');
  const [shopNick, setShopNick] = React.useState('');
  const [sessionKey, setSessionKey] = React.useState('');
  const [sessionExpiresAt, setSessionExpiresAt] = React.useState('');
  const [permitShopId, setPermitShopId] = React.useState('');
  const [authorizingTaobao, setAuthorizingTaobao] = React.useState(false);
  const [savingShop, setSavingShop] = React.useState(false);
  const [permittingShopId, setPermittingShopId] = React.useState('');
  const [savingMapping, setSavingMapping] = React.useState(false);
  const [deletingMappingId, setDeletingMappingId] = React.useState('');
  const taobaoProducts = React.useMemo<PurchaseProductOption[]>(() => [...plans, ...creditProductOptions()], [plans]);
  const [selectedProductKey, setSelectedProductKey] = React.useState(() => {
    const first = plans[0] || creditProductOptions()[0];
    return first ? `${first.itemType}:${first.itemId}` : '';
  });
  const [giftType, setGiftType] = React.useState<GiftCardFormType>('plan');
  const [numIid, setNumIid] = React.useState('');
  const [skuId, setSkuId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [planId, setPlanId] = React.useState(plans[0]?.itemId || '');
  const [amountYuan, setAmountYuan] = React.useState('100');
  const [durationMonths, setDurationMonths] = React.useState(1);
  const [quantity, setQuantity] = React.useState(1);

  React.useEffect(() => {
    if (!planId && plans[0]?.itemId) setPlanId(plans[0].itemId);
  }, [planId, plans]);

  const selectedProduct = taobaoProducts.find((product) => `${product.itemType}:${product.itemId}` === selectedProductKey) || taobaoProducts[0];

  React.useEffect(() => {
    if (!selectedProduct && taobaoProducts[0]) {
      setSelectedProductKey(`${taobaoProducts[0].itemType}:${taobaoProducts[0].itemId}`);
      return;
    }
    if (!selectedProduct) return;
    setGiftType(selectedProduct.itemType);
    if (selectedProduct.itemType === 'plan') {
      setPlanId(selectedProduct.itemId);
    } else {
      setAmountYuan(selectedProduct.itemId);
    }
    setTitle((current) => current || selectedProduct.name);
  }, [selectedProduct, taobaoProducts]);

  function selectTaobaoProduct(product: PurchaseProductOption) {
    setSelectedProductKey(`${product.itemType}:${product.itemId}`);
    setGiftType(product.itemType);
    setTitle(product.name);
    if (product.itemType === 'plan') {
      setPlanId(product.itemId);
    } else {
      setAmountYuan(product.itemId);
    }
  }

  function mappingProductLabel(mapping: TaobaoProductMapping) {
    if (mapping.giftType === 'plan') {
      const option = plans.find((plan) => plan.itemId === mapping.planId);
      return option ? option.name : mapping.planId || '-';
    }
    return currency(mapping.amountCents, 'CNY');
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [shopRes, mappingRes, orderRes] = await Promise.all([
        fetch('/api/taobao/shops', { headers }),
        fetch('/api/taobao/product-mappings', { headers }),
        fetch('/api/taobao/orders?limit=50', { headers })
      ]);
      const shopPayload = await readJsonResponse(shopRes);
      const mappingPayload = await readJsonResponse(mappingRes);
      const orderPayload = await readJsonResponse(orderRes);
      if (!shopRes.ok) throw new Error(responseErrorMessage(shopRes, shopPayload, t.requestFailed));
      if (!mappingRes.ok) throw new Error(responseErrorMessage(mappingRes, mappingPayload, t.requestFailed));
      if (!orderRes.ok) throw new Error(responseErrorMessage(orderRes, orderPayload, t.requestFailed));
      const nextShops = (shopPayload as { shops: TaobaoShop[] }).shops || [];
      setShops(nextShops);
      setPermitShopId((current) => current || nextShops[0]?.id || '');
      setMappings((mappingPayload as { mappings: TaobaoProductMapping[] }).mappings || []);
      setOrders((orderPayload as { orders: PlatformOrder[] }).orders || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [headers, t.requestFailed]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    function handleTaobaoOauthMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || typeof payload !== 'object' || payload.type !== 'taobao-oauth-complete') return;
      setAuthorizingTaobao(false);
      if (payload.ok) {
        showSuccessToast(typeof payload.title === 'string' ? payload.title : '淘宝店铺授权已保存。');
        void load();
        return;
      }
      showErrorToast(typeof payload.detail === 'string' ? payload.detail : '淘宝授权失败。');
    }

    window.addEventListener('message', handleTaobaoOauthMessage);
    return () => window.removeEventListener('message', handleTaobaoOauthMessage);
  }, [load]);

  async function saveShop(event: React.FormEvent) {
    event.preventDefault();
    if (savingShop) return;
    setSavingShop(true);
    try {
      const response = await fetch('/api/taobao/shops', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: shopId,
          nick: shopNick,
          sessionKey,
          sessionExpiresAt: sessionExpiresAt || null
        })
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      const nextShops = (payload as { shops: TaobaoShop[] }).shops || [];
      setShops(nextShops);
      setPermitShopId(shopId || nextShops[0]?.id || '');
      setShopId('');
      setShopNick('');
      setSessionKey('');
      setSessionExpiresAt('');
      showSuccessToast(tr(t, 'taobaoShopSaved', '淘宝店铺授权已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setSavingShop(false);
    }
  }

  async function startTaobaoOauth() {
    if (authorizingTaobao) return;
    try {
      setAuthorizingTaobao(true);
      const response = await fetch('/api/taobao/oauth/start', { headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        setAuthorizingTaobao(false);
        return;
      }
      const authorizeUrl = (payload as { authorizeUrl?: string }).authorizeUrl;
      if (!authorizeUrl) throw new Error('获取淘宝授权链接失败。');
      const popup = window.open(authorizeUrl, 'taobao-oauth', 'width=720,height=760');
      if (!popup) throw new Error('浏览器拦截了授权窗口，请允许弹窗后重试。');
      const popupTimer = window.setInterval(() => {
        if (!popup.closed) return;
        window.clearInterval(popupTimer);
        setAuthorizingTaobao(false);
      }, 700);
    } catch (error) {
      setAuthorizingTaobao(false);
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    }
  }

  async function permitMessages(targetShopId = permitShopId) {
    if (!targetShopId) return;
    if (permittingShopId) return;
    setPermittingShopId(targetShopId);
    try {
      const response = await fetch(`/api/taobao/shops/${encodeURIComponent(targetShopId)}/permit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setShops((payload as { shops: TaobaoShop[] }).shops || []);
      showSuccessToast(tr(t, 'taobaoPermitSaved', '淘宝 TMC 消息服务已开通。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setPermittingShopId('');
    }
  }

  async function saveMapping(event: React.FormEvent) {
    event.preventDefault();
    if (savingMapping) return;
    setSavingMapping(true);
    const body =
      giftType === 'credit'
        ? {
            numIid,
            skuId: skuId || null,
            title,
            giftType: 'credit',
            amountCents: Math.max(1, Math.round(Number(amountYuan || 0) * 100)),
            quantity,
            isActive: true
          }
        : {
            numIid,
            skuId: skuId || null,
            title,
            giftType: 'plan',
            planId,
            durationMonths,
            quantity,
            isActive: true
          };
    try {
      const response = await fetch('/api/taobao/product-mappings', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setMappings((payload as { mappings: TaobaoProductMapping[] }).mappings || []);
      setNumIid('');
      setSkuId('');
      setTitle('');
      showSuccessToast(tr(t, 'taobaoMappingSaved', '淘宝商品映射已保存。'));
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setSavingMapping(false);
    }
  }

  async function deleteMapping(mapping: TaobaoProductMapping) {
    if (deletingMappingId) return;
    setDeletingMappingId(mapping.id);
    try {
      const response = await fetch(`/api/taobao/product-mappings/${mapping.id}`, { method: 'DELETE', headers });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        showErrorToast(responseErrorMessage(response, payload, t.requestFailed));
        return;
      }
      setMappings((payload as { mappings: TaobaoProductMapping[] }).mappings || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setDeletingMappingId('');
    }
  }

  return (
    <section className="table-panel taobao-automation-panel collapsible-panel">
      <div className="section-heading">
        <div>
          <div className="channel-title-row">
            <button
              type="button"
              className="channel-toggle-button"
              onClick={() => setIsExpanded((value) => !value)}
              aria-expanded={isExpanded}
              title={isExpanded ? t.collapse : t.expand}
            >
              <ChevronDown size={16} className={isExpanded ? 'rotate-icon open' : 'rotate-icon'} />
            </button>
            <h2>{tr(t, 'taobaoAutomation', '淘宝自动发码')}</h2>
          </div>
          <p>{tr(t, 'taobaoAutomationHint', 'TMC 消息触发后按商品/SKU 映射自动生成兑换码，买家登录后可到「我的订单」自助领取。')}</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}>
          <LoadingContent loading={loading} icon={<RefreshCcw size={16} />} loadingLabel={tr(t, 'refreshing', '刷新中...')}>
            {t.refresh}
          </LoadingContent>
        </button>
      </div>
      {isExpanded ? (
        <div className="collapsible-panel-body">
          {loading ? <div className="loading-line" /> : null}
          <div className="taobao-split-grid">
            <form className="taobao-mapping-form taobao-shop-form" onSubmit={saveShop}>
              <div className="taobao-permit-panel taobao-oauth-panel">
                <div>
                  <h3>授权淘宝店铺</h3>
                  <p>推荐直接跳转淘宝授权，系统会自动写入 SessionKey 和过期时间。</p>
                </div>
                <button type="button" className="secondary-button taobao-oauth-button" onClick={() => void startTaobaoOauth()} disabled={authorizingTaobao}>
                  <LoadingContent loading={authorizingTaobao} icon={<KeyRound size={16} />} loadingLabel="等待淘宝授权...">
                    点击授权淘宝店铺
                  </LoadingContent>
                </button>
              </div>
              <label>
                店铺 ID
                <input value={shopId} onChange={(event) => setShopId(event.target.value)} required />
              </label>
              <label>
                店铺昵称
                <input value={shopNick} onChange={(event) => setShopNick(event.target.value)} placeholder={tr(t, 'optional', '可选')} />
              </label>
              <label>
                Session Key
                <input value={sessionKey} onChange={(event) => setSessionKey(event.target.value)} required />
              </label>
              <label>
                过期时间
                <input type="datetime-local" value={sessionExpiresAt} onChange={(event) => setSessionExpiresAt(event.target.value)} />
              </label>
              <button type="submit" className="primary-button" disabled={savingShop}>
                <LoadingContent loading={savingShop} icon={<KeyRound size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
                  保存授权
                </LoadingContent>
              </button>
            </form>

            <div className="taobao-permit-panel">
              <div>
                <h3>{tr(t, 'taobaoShopPermit', '店铺消息服务')}</h3>
                <p>{tr(t, 'taobaoShopPermitHint', '保存店铺 Session 后开通 TMC，淘宝付款消息会触发自动生成兑换码。')}</p>
              </div>
              <div className="taobao-permit-row">
                <select value={permitShopId} onChange={(event) => setPermitShopId(event.target.value)}>
                  <option value="">{tr(t, 'selectShop', '选择店铺')}</option>
                  {shops.map((shop) => (
                    <option value={shop.id} key={shop.id}>
                      {shop.nick || shop.id}
                    </option>
                  ))}
                </select>
                <button type="button" className="secondary-button" disabled={!permitShopId || Boolean(permittingShopId)} onClick={() => void permitMessages()}>
                  <LoadingContent loading={permittingShopId === permitShopId} icon={<ShieldCheck size={16} />} loadingLabel="开通中...">
                    开通 TMC
                  </LoadingContent>
                </button>
              </div>
            </div>
          </div>
          <form className="taobao-mapping-form" onSubmit={saveMapping}>
            <div className="taobao-product-picker">
              <span>{tr(t, 'purchaseProductTitle', '选择商品')}</span>
              <div className="taobao-product-grid">
                {taobaoProducts.map((product) => {
                  const productKey = `${product.itemType}:${product.itemId}`;
                  return (
                    <button
                      type="button"
                      className={selectedProductKey === productKey ? 'taobao-product-card active' : 'taobao-product-card'}
                      key={productKey}
                      onClick={() => selectTaobaoProduct(product)}
                    >
                      <strong>{product.name}</strong>
                      <span>{product.itemType === 'plan' ? tr(t, 'giftCardPlanType', '套餐') : tr(t, 'giftCardCreditType', '余额')}</span>
                      <small>{product.description || product.priceLabel}</small>
                    </button>
                  );
                })}
              </div>
            </div>
            <label>
              淘宝商品 ID
              <input value={numIid} onChange={(event) => setNumIid(event.target.value)} required />
            </label>
            <label>
              SKU ID
              <input value={skuId} onChange={(event) => setSkuId(event.target.value)} placeholder={tr(t, 'optional', '可选')} />
            </label>
            <label>
              {t.description}
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              {tr(t, 'giftCardType', '礼品卡类型')}
              <select value={giftType} onChange={(event) => setGiftType(event.target.value as GiftCardFormType)}>
                <option value="plan">{tr(t, 'giftCardPlanType', '套餐')}</option>
                <option value="credit">{tr(t, 'giftCardCreditType', '余额')}</option>
              </select>
            </label>
            {giftType === 'plan' ? (
              <>
                <label>
                  {t.plan}
                  <select value={planId} onChange={(event) => setPlanId(event.target.value)} required>
                    {plans.map((plan) => (
                      <option value={plan.itemId} key={plan.itemId}>
                        {planProductOptionLabel(plan)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr(t, 'giftCardDuration', '有效月份')}
                  <input type="number" min="1" max="36" value={durationMonths} onChange={(event) => setDurationMonths(Number(event.target.value))} />
                </label>
              </>
            ) : (
              <label>
                {tr(t, 'giftCardAmount', '余额金额')}
                <input type="number" min="0.01" step="0.01" value={amountYuan} onChange={(event) => setAmountYuan(event.target.value)} />
              </label>
            )}
            <label>
              {tr(t, 'giftCardQuantity', '生成数量')}
              <input type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <button type="submit" className="primary-button" disabled={savingMapping}>
              <LoadingContent loading={savingMapping} icon={<Plus size={16} />} loadingLabel={tr(t, 'saving', '保存中...')}>
                {tr(t, 'saveMapping', '保存映射')}
              </LoadingContent>
            </button>
          </form>

          <div className="taobao-split-grid">
            <div>
              <h3>{tr(t, 'taobaoShops', '已授权店铺')}</h3>
              <div className="taobao-mini-list">
                {shops.length ? shops.map((shop) => (
                  <article className="taobao-mini-row taobao-shop-row" key={shop.id}>
                    <div>
                      <strong>{shop.nick || shop.id}</strong>
                      <span>{shop.id}</span>
                    </div>
                    <span>{shop.sessionExpiresAt ? fullDate(shop.sessionExpiresAt) : '-'}</span>
                    <span className={shop.messagePermittedAt ? 'status-code ok' : 'status-code error'}>
                      {shop.messagePermittedAt ? 'TMC' : '未开通'}
                    </span>
                    <button type="button" className="secondary-button" onClick={() => void permitMessages(shop.id)} disabled={Boolean(permittingShopId)}>
                      <LoadingContent loading={permittingShopId === shop.id} icon={<ShieldCheck size={15} />} loadingLabel="开通中...">
                        TMC
                      </LoadingContent>
                    </button>
                  </article>
                )) : <Empty t={t} />}
              </div>
            </div>
            <div>
              <h3>{tr(t, 'taobaoMappings', '商品映射')}</h3>
              <div className="taobao-mini-list">
                {mappings.length ? mappings.map((mapping) => (
                  <article className="taobao-mini-row" key={mapping.id}>
                    <div>
                      <strong>{mapping.title || mappingProductLabel(mapping)}</strong>
                      <span>淘宝商品 {mapping.numIid}{mapping.skuId ? ` / SKU ${mapping.skuId}` : ''}</span>
                    </div>
                    <span>{mappingProductLabel(mapping)}</span>
                    <button type="button" className="icon-button danger" onClick={() => deleteMapping(mapping)} title={t.delete} disabled={Boolean(deletingMappingId)}>
                      {deletingMappingId === mapping.id ? <ButtonSpinner size={15} /> : <Trash2 size={15} />}
                    </button>
                  </article>
                )) : <Empty t={t} />}
              </div>
            </div>
          </div>

          <div className="taobao-split-grid">
            <div>
              <h3>{tr(t, 'taobaoRecentOrders', '最近订单')}</h3>
              <div className="taobao-mini-list">
                {orders.length ? orders.map((order) => (
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
                )) : <Empty t={t} />}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

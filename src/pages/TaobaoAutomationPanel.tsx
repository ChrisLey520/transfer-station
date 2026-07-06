import { LoadingContent } from '../components/common.js';
import { tr } from '../i18n.js';
import type { PlanProductOption } from '../types.js';
import { TaobaoLists } from './taobao/TaobaoLists.js';
import { TaobaoMappingForm } from './taobao/TaobaoMappingForm.js';
import { TaobaoPermitPanel } from './taobao/TaobaoPermitPanel.js';
import { TaobaoShopForm } from './taobao/TaobaoShopForm.js';
import { taobaoMappingProductLabel } from './taobao/taobaoUtils.js';
import { useTaobaoAutomationPanel } from './taobao/useTaobaoAutomationPanel.js';
import { ChevronDown, RefreshCcw } from 'lucide-react';

export function TaobaoAutomationPanel({ headers, plans, refreshTick, t }: { headers: HeadersInit; plans: PlanProductOption[]; refreshTick: number; t: Record<string, string> }) {
  const panel = useTaobaoAutomationPanel({ headers, plans, refreshTick, t });

  return (
    <section className="table-panel taobao-automation-panel collapsible-panel">
      <div className="section-heading">
        <div>
          <div className="channel-title-row">
            <button
              type="button"
              className="channel-toggle-button"
              onClick={() => panel.setIsExpanded((value) => !value)}
              aria-expanded={panel.isExpanded}
              title={panel.isExpanded ? t.collapse : t.expand}
            >
              <ChevronDown size={16} className={panel.isExpanded ? 'rotate-icon open' : 'rotate-icon'} />
            </button>
            <h2>{tr(t, 'taobaoAutomation', '淘宝自动发码')}</h2>
          </div>
          <p>{tr(t, 'taobaoAutomationHint', 'TMC 消息触发后按商品/SKU 映射自动生成兑换码，买家登录后可到「我的订单」自助领取。')}</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void panel.load()} disabled={panel.loading}>
          <LoadingContent loading={panel.loading} icon={<RefreshCcw size={16} />} loadingLabel={tr(t, 'refreshing', '刷新中...')}>
            {t.refresh}
          </LoadingContent>
        </button>
      </div>
      {panel.isExpanded ? (
        <div className="collapsible-panel-body">
          {panel.loading ? <div className="loading-line" /> : null}
          <div className="taobao-split-grid">
            <TaobaoShopForm
              authorizingTaobao={panel.authorizingTaobao}
              onShopIdChange={panel.setShopId}
              onShopNickChange={panel.setShopNick}
              onSessionExpiresAtChange={panel.setSessionExpiresAt}
              onSessionKeyChange={panel.setSessionKey}
              onStartOauth={() => void panel.startTaobaoOauth()}
              onSubmit={panel.saveShop}
              savingShop={panel.savingShop}
              sessionExpiresAt={panel.sessionExpiresAt}
              sessionKey={panel.sessionKey}
              shopId={panel.shopId}
              shopNick={panel.shopNick}
              t={t}
            />
            <TaobaoPermitPanel
              onPermit={() => void panel.permitMessages()}
              onPermitShopIdChange={panel.setPermitShopId}
              permitShopId={panel.permitShopId}
              permittingShopId={panel.permittingShopId}
              shops={panel.shops}
              t={t}
            />
          </div>
          <TaobaoMappingForm
            amountYuan={panel.amountYuan}
            durationMonths={panel.durationMonths}
            giftType={panel.giftType}
            numIid={panel.numIid}
            onAmountYuanChange={panel.setAmountYuan}
            onDurationMonthsChange={panel.setDurationMonths}
            onGiftTypeChange={panel.setGiftType}
            onNumIidChange={panel.setNumIid}
            onPlanIdChange={panel.setPlanId}
            onQuantityChange={panel.setQuantity}
            onSelectProduct={panel.selectTaobaoProduct}
            onSkuIdChange={panel.setSkuId}
            onSubmit={panel.saveMapping}
            onTitleChange={panel.setTitle}
            planId={panel.planId}
            plans={plans}
            quantity={panel.quantity}
            savingMapping={panel.savingMapping}
            selectedProductKey={panel.selectedProductKey}
            skuId={panel.skuId}
            t={t}
            taobaoProducts={panel.taobaoProducts}
            title={panel.title}
          />
          <TaobaoLists
            deletingMappingId={panel.deletingMappingId}
            mappings={panel.mappings}
            mappingProductLabel={(mapping) => taobaoMappingProductLabel(mapping, plans)}
            onDeleteMapping={(mapping) => void panel.deleteMapping(mapping)}
            onPermitMessages={(shopId) => void panel.permitMessages(shopId)}
            orders={panel.orders}
            permittingShopId={panel.permittingShopId}
            shops={panel.shops}
            t={t}
          />
        </div>
      ) : null}
    </section>
  );
}

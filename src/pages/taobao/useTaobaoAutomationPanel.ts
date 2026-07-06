import React from 'react';
import { showErrorToast, showSuccessToast } from '../../components/toast.js';
import { tr } from '../../i18n.js';
import type { PlanProductOption, PlatformOrder, TaobaoProductMapping, TaobaoShop } from '../../types.js';
import { unknownErrorMessage } from '../../utils/api.js';
import {
  fetchTaobaoAutomation,
  permitTaobaoMessages,
  removeTaobaoMapping,
  saveTaobaoMapping,
  saveTaobaoShop,
  startTaobaoOauthSession
} from './taobaoApi.js';
import { useTaobaoMappingForm } from './useTaobaoMappingForm.js';

type UseTaobaoAutomationPanelArgs = {
  headers: HeadersInit;
  plans: PlanProductOption[];
  refreshTick: number;
  t: Record<string, string>;
};

export function useTaobaoAutomationPanel({ headers, plans, refreshTick, t }: UseTaobaoAutomationPanelArgs) {
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
  const mappingForm = useTaobaoMappingForm(plans);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchTaobaoAutomation(headers, t.requestFailed);
      setShops(payload.shops);
      setPermitShopId((current) => current || payload.shops[0]?.id || '');
      setMappings(payload.mappings);
      setOrders(payload.orders);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setLoading(false);
    }
  }, [headers, t.requestFailed]);

  React.useEffect(() => {
    void load();
  }, [load, refreshTick]);

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
      const payload = await saveTaobaoShop({ headers, requestFailed: t.requestFailed, sessionExpiresAt, sessionKey, shopId, shopNick });
      const nextShops = payload.shops || [];
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
      const payload = await startTaobaoOauthSession(headers, t.requestFailed);
      if (!payload.authorizeUrl) throw new Error('获取淘宝授权链接失败。');
      const popup = window.open(payload.authorizeUrl, 'taobao-oauth', 'width=720,height=760');
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
      const payload = await permitTaobaoMessages(targetShopId, headers, t.requestFailed);
      setShops(payload.shops || []);
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
    try {
      const payload = await saveTaobaoMapping(mappingForm.buildMappingPayload(), headers, t.requestFailed);
      setMappings(payload.mappings || []);
      mappingForm.resetMappingIdentity();
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
      const payload = await removeTaobaoMapping(mapping, headers, t.requestFailed);
      setMappings(payload.mappings || []);
    } catch (error) {
      showErrorToast(unknownErrorMessage(error, t.requestFailed));
    } finally {
      setDeletingMappingId('');
    }
  }

  return {
    authorizingTaobao,
    deleteMapping,
    deletingMappingId,
    isExpanded,
    load,
    loading,
    mappings,
    orders,
    permitMessages,
    permitShopId,
    permittingShopId,
    saveMapping,
    saveShop,
    savingMapping,
    savingShop,
    sessionExpiresAt,
    sessionKey,
    setIsExpanded,
    setPermitShopId,
    setSessionExpiresAt,
    setSessionKey,
    setShopId,
    setShopNick,
    shopId,
    shopNick,
    shops,
    startTaobaoOauth,
    ...mappingForm
  };
}

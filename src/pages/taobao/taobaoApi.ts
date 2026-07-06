import type { PlatformOrder, TaobaoProductMapping, TaobaoShop } from '../../types.js';
import { readJsonResponse, responseErrorMessage } from '../../utils/api.js';

export type TaobaoMappingPayload =
  | {
      numIid: string;
      skuId: string | null;
      title: string;
      giftType: 'credit';
      amountCents: number;
      quantity: number;
      isActive: boolean;
    }
  | {
      numIid: string;
      skuId: string | null;
      title: string;
      giftType: 'plan';
      planId: string;
      durationMonths: number;
      quantity: number;
      isActive: boolean;
    };

async function readTaobaoPayload<T>(response: Response, requestFailed: string): Promise<T> {
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(responseErrorMessage(response, payload, requestFailed));
  }
  return payload as T;
}

export async function fetchTaobaoAutomation(headers: HeadersInit, requestFailed: string) {
  const [shopRes, mappingRes, orderRes] = await Promise.all([
    fetch('/api/taobao/shops', { headers }),
    fetch('/api/taobao/product-mappings', { headers }),
    fetch('/api/taobao/orders?limit=50', { headers })
  ]);

  const shopPayload = await readTaobaoPayload<{ shops: TaobaoShop[] }>(shopRes, requestFailed);
  const mappingPayload = await readTaobaoPayload<{ mappings: TaobaoProductMapping[] }>(mappingRes, requestFailed);
  const orderPayload = await readTaobaoPayload<{ orders: PlatformOrder[] }>(orderRes, requestFailed);

  return {
    mappings: mappingPayload.mappings || [],
    orders: orderPayload.orders || [],
    shops: shopPayload.shops || []
  };
}

export async function saveTaobaoShop({
  headers,
  requestFailed,
  sessionExpiresAt,
  sessionKey,
  shopId,
  shopNick
}: {
  headers: HeadersInit;
  requestFailed: string;
  sessionExpiresAt: string;
  sessionKey: string;
  shopId: string;
  shopNick: string;
}) {
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
  return readTaobaoPayload<{ shops: TaobaoShop[] }>(response, requestFailed);
}

export async function startTaobaoOauthSession(headers: HeadersInit, requestFailed: string) {
  const response = await fetch('/api/taobao/oauth/start', { headers });
  return readTaobaoPayload<{ authorizeUrl?: string }>(response, requestFailed);
}

export async function permitTaobaoMessages(targetShopId: string, headers: HeadersInit, requestFailed: string) {
  const response = await fetch(`/api/taobao/shops/${encodeURIComponent(targetShopId)}/permit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  return readTaobaoPayload<{ shops: TaobaoShop[] }>(response, requestFailed);
}

export async function saveTaobaoMapping(body: TaobaoMappingPayload, headers: HeadersInit, requestFailed: string) {
  const response = await fetch('/api/taobao/product-mappings', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  return readTaobaoPayload<{ mappings: TaobaoProductMapping[] }>(response, requestFailed);
}

export async function removeTaobaoMapping(mapping: TaobaoProductMapping, headers: HeadersInit, requestFailed: string) {
  const response = await fetch(`/api/taobao/product-mappings/${mapping.id}`, { method: 'DELETE', headers });
  return readTaobaoPayload<{ mappings: TaobaoProductMapping[] }>(response, requestFailed);
}

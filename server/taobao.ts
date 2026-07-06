import crypto from 'node:crypto';

const topEndpoint = process.env.TAOBAO_TOP_ENDPOINT || 'https://eco.taobao.com/router/rest';
const tokenEndpoint = process.env.TAOBAO_TOKEN_ENDPOINT || 'https://oauth.taobao.com/token';
const taobaoApiTimeoutMs = Math.max(1_000, Number(process.env.TAOBAO_API_TIMEOUT_MS || 15_000));

type TopOptions = {
  session?: string;
  fields?: Record<string, string | number | boolean | undefined | null>;
};

export type TaobaoTopConfig = {
  appKey: string;
  appSecret: string;
};

export type TaobaoTmcMessage = {
  id: string;
  topic: string;
  content: string;
  raw: unknown;
};

export type TaobaoOrderLine = {
  tid: string;
  oid: string;
  status: string;
  numIid: string;
  skuId: string | null;
  title: string;
  buyerNick: string;
  raw: unknown;
};

export function getTaobaoConfig(): TaobaoTopConfig {
  const appKey = process.env.TAOBAO_APP_KEY || '';
  const appSecret = process.env.TAOBAO_APP_SECRET || '';
  if (!appKey || !appSecret) {
    throw new Error('TAOBAO_APP_KEY 和 TAOBAO_APP_SECRET 必须配置。');
  }
  return { appKey, appSecret };
}

function formatTopTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function signTopParams(params: Record<string, string>, appSecret: string) {
  const sorted = Object.keys(params).sort();
  const base = `${appSecret}${sorted.map((key) => `${key}${params[key]}`).join('')}${appSecret}`;
  return crypto.createHash('md5').update(base, 'utf8').digest('hex').toUpperCase();
}

function normalizeTopPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return payload;
  const record = payload as Record<string, unknown>;
  if ('error_response' in record) {
    const error = record.error_response as Record<string, unknown>;
    throw new Error(String(error.sub_msg || error.msg || '淘宝接口调用失败。'));
  }
  return payload;
}

async function postForm(endpoint: string, body: URLSearchParams) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), taobaoApiTimeoutMs);
  try {
    return await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`淘宝接口请求超时（${taobaoApiTimeoutMs}ms）。`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function callTaobaoTop<T = any>(method: string, options: TopOptions = {}): Promise<T> {
  const config = getTaobaoConfig();
  const params: Record<string, string> = {
    app_key: config.appKey,
    method,
    timestamp: formatTopTimestamp(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5'
  };
  if (options.session) params.session = options.session;
  for (const [key, value] of Object.entries(options.fields || {})) {
    if (value !== undefined && value !== null && value !== '') params[key] = String(value);
  }
  params.sign = signTopParams(params, config.appSecret);

  const body = new URLSearchParams(params);
  const response = await postForm(topEndpoint, body);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`淘宝接口 HTTP ${response.status}`);
  }
  return normalizeTopPayload(payload) as T;
}

export async function exchangeTaobaoAuthCode(code: string, redirectUri?: string) {
  const config = getTaobaoConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.appKey,
    client_secret: config.appSecret
  });
  if (redirectUri) body.set('redirect_uri', redirectUri);
  const response = await postForm(tokenEndpoint, body);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (payload && typeof payload === 'object' && 'error' in payload)) {
    throw new Error(String((payload as any).error_description || (payload as any).error || '淘宝授权失败。'));
  }
  return payload as {
    access_token: string;
    expires_in?: number;
    taobao_user_id?: string | number;
    taobao_user_nick?: string;
  };
}

export async function permitTaobaoTmcUser(session: string, topics?: string[]) {
  const payload = await callTaobaoTop<any>('taobao.tmc.user.permit', {
    session,
    fields: topics?.length ? { topics: topics.join(';') } : undefined
  });
  const success = payload?.tmc_user_permit_response?.is_success;
  if (success === true || success === 'true') return true;
  throw new Error('淘宝 TMC 开通未返回成功状态。');
}

function unwrapMessageList(payload: any): unknown[] {
  const response = payload?.tmc_messages_consume_response;
  const messages = response?.messages?.tmc_message || response?.messages?.tmc_messages || response?.messages || [];
  return Array.isArray(messages) ? messages : [messages].filter(Boolean);
}

export async function consumeTaobaoTmcMessages(groupName: string, quantity = 20) {
  const payload = await callTaobaoTop<any>('taobao.tmc.messages.consume', {
    fields: {
      group_name: groupName,
      quantity: Math.max(1, Math.min(200, quantity))
    }
  });
  return unwrapMessageList(payload).map((message: any): TaobaoTmcMessage => ({
    id: String(message.id || message.msg_id || message.message_id || ''),
    topic: String(message.topic || ''),
    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content || {}),
    raw: message
  })).filter((message) => message.id);
}

export async function confirmTaobaoTmcMessages(groupName: string, successIds: string[], _failedIds: string[] = []) {
  if (!successIds.length) return;
  await callTaobaoTop('taobao.tmc.messages.confirm', {
    fields: {
      group_name: groupName,
      s_message_ids: successIds.join(',')
    }
  });
}

function parseTopList(value: unknown, childKey: string) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    const child = (value as Record<string, unknown>)[childKey];
    if (Array.isArray(child)) return child;
    if (child) return [child];
  }
  return [];
}

export async function getTaobaoTradeFullInfo(session: string, tid: string) {
  const payload = await callTaobaoTop<any>('taobao.trade.fullinfo.get', {
    session,
    fields: {
      fields: [
        'tid',
        'status',
        'buyer_nick',
        'payment',
        'created',
        'pay_time',
        'orders.oid',
        'orders.status',
        'orders.num_iid',
        'orders.sku_id',
        'orders.title',
        'orders.payment'
      ].join(','),
      tid
    }
  });
  const trade = payload?.trade_fullinfo_get_response?.trade || payload?.trade || {};
  const orders = parseTopList(trade.orders, 'order');
  return {
    tid: String(trade.tid || tid),
    status: String(trade.status || ''),
    buyerNick: String(trade.buyer_nick || ''),
    raw: trade,
    orders: orders.map((order: any): TaobaoOrderLine => ({
      tid: String(trade.tid || tid),
      oid: String(order.oid || trade.tid || tid),
      status: String(order.status || trade.status || ''),
      numIid: String(order.num_iid || ''),
      skuId: order.sku_id ? String(order.sku_id) : null,
      title: String(order.title || ''),
      buyerNick: String(trade.buyer_nick || ''),
      raw: order
    }))
  };
}

export function extractTidFromTmcMessage(content: string) {
  try {
    const parsed = JSON.parse(content);
    const candidates = [parsed.tid, parsed.tid_str, parsed.trade_id, parsed.order_id, parsed.biz_id, parsed.id];
    const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim());
    return found ? String(found) : '';
  } catch {
    const match = content.match(/(?:tid|trade_id|order_id)["'=:\s]+(\d{6,})/i);
    return match?.[1] || '';
  }
}

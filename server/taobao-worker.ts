import 'dotenv/config';
import { initDb } from './db.js';
import { decryptKey } from './crypto.js';
import {
  listTaobaoShops,
  processTaobaoPaidOrderLine,
  recordTaobaoTmcMessage,
  seedDefaults
} from './store.js';
import {
  confirmTaobaoTmcMessages,
  consumeTaobaoTmcMessages,
  extractTidFromTmcMessage,
  getTaobaoTradeFullInfo,
  type TaobaoTmcMessage
} from './taobao.js';

const groupName = process.env.TAOBAO_TMC_GROUP || process.env.TAOBAO_APP_KEY || '';
const intervalMs = Math.max(1000, Number(process.env.TAOBAO_TMC_INTERVAL_MS || 3000));
const quantity = Math.max(1, Math.min(200, Number(process.env.TAOBAO_TMC_QUANTITY || 20)));
const concurrency = Math.max(1, Math.min(quantity, Number(process.env.TAOBAO_TMC_CONCURRENCY || 4)));
const seedOnStart = process.env.SEED_ON_START === '1' || (process.env.NODE_ENV !== 'production' && process.env.SEED_ON_START !== '0');
const paidStatuses = new Set(['WAIT_SELLER_SEND_GOODS', 'WAIT_BUYER_CONFIRM_GOODS', 'TRADE_BUYER_SIGNED', 'TRADE_FINISHED']);
const terminalUnpaidStatuses = new Set(['TRADE_CLOSED', 'TRADE_CLOSED_BY_TAOBAO']);
const activeTradeIds = new Set<string>();

initDb();
if (seedOnStart) {
  seedDefaults();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeMessageContent(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function shopIdFromContent(content: string) {
  const parsed = decodeMessageContent(content) as Record<string, unknown>;
  const candidates = [
    parsed.seller_id,
    parsed.sellerId,
    parsed.seller_nick,
    parsed.sellerNick,
    parsed.user_id,
    parsed.userId
  ];
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim());
  return found ? String(found) : '';
}

function statusHintFromContent(content: string) {
  const parsed = decodeMessageContent(content) as Record<string, unknown>;
  const candidates = [
    parsed.status,
    parsed.trade_status,
    parsed.tradeStatus,
    parsed.order_status,
    parsed.orderStatus,
    parsed.new_status,
    parsed.newStatus
  ];
  const found = candidates.find((value) => value !== undefined && value !== null && String(value).trim());
  return found ? String(found) : '';
}

function isPaymentRelatedTopic(topic: string) {
  return /buyerpay|seller(ship|send)|tradesuccess|tradefinished|buyersigned|confirmgoods/i.test(topic);
}

function isTradeTopic(topic: string) {
  return /trade/i.test(topic);
}

function shouldRetryWithoutPaidLines(message: { topic: string; content: string }, tradeStatus: string) {
  const hintedStatus = statusHintFromContent(message.content);
  const statuses = [tradeStatus, hintedStatus].filter(Boolean);
  if (statuses.some((status) => terminalUnpaidStatuses.has(status))) return false;
  if (statuses.some((status) => paidStatuses.has(status))) return true;
  return isPaymentRelatedTopic(message.topic);
}

function candidateShopsFromContent(content: string) {
  const explicitShopId = shopIdFromContent(content);
  const shops = listTaobaoShops();
  if (!explicitShopId) return shops;

  const matched = shops.filter((shop) => shop.id === explicitShopId || shop.nick === explicitShopId);
  return matched.length ? matched : shops;
}

async function handleTradeMessage(message: { id: string; topic: string; content: string }) {
  recordTaobaoTmcMessage({ id: message.id, topic: message.topic, content: message.content, status: 'received' });
  const tid = extractTidFromTmcMessage(message.content);
  if (!tid) {
    recordTaobaoTmcMessage({ id: message.id, topic: message.topic, content: message.content, status: 'failed', errorMessage: '消息缺少 tid。' });
    throw new Error('消息缺少 tid。');
  }

  const shops = candidateShopsFromContent(message.content);
  if (!shops.length) {
    throw new Error('未配置淘宝店铺授权。');
  }

  let handled = false;
  let lastError: Error | null = null;
  for (const shop of shops) {
    const session = decryptKey(shop.sessionCiphertext);
    if (!session) continue;
    try {
      const trade = await getTaobaoTradeFullInfo(session, tid);
      const paidLines = trade.orders.filter((line) => paidStatuses.has(line.status || trade.status));
      if (!paidLines.length) {
        if (shouldRetryWithoutPaidLines(message, trade.status)) {
          throw new Error(`订单 ${tid} 尚未进入可发码付款状态，等待淘宝订单状态更新。`);
        }
        recordTaobaoTmcMessage({
          id: message.id,
          topic: message.topic,
          content: message.content,
          status: 'ignored',
          errorMessage: `订单状态 ${trade.status || statusHintFromContent(message.content) || 'unknown'} 未触发发码。`
        });
        return;
      }
      for (const line of paidLines) {
        processTaobaoPaidOrderLine({
          shopId: shop.id,
          orderId: trade.tid,
          subOrderId: line.oid,
          buyerNick: trade.buyerNick || line.buyerNick,
          itemId: line.numIid,
          skuId: line.skuId,
          title: line.title,
          status: line.status || trade.status,
          rawPayload: { trade: trade.raw, order: line.raw, message },
          lastEventAt: new Date().toISOString()
        });
      }
      handled = true;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('淘宝订单处理失败。');
    }
  }

  if (!handled) {
    throw lastError || new Error('淘宝订单处理失败。');
  }

  recordTaobaoTmcMessage({ id: message.id, topic: message.topic, content: message.content, status: 'processed' });
}

async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function processMessage(message: TaobaoTmcMessage, batchTradeIds: Set<string>) {
  if (!isTradeTopic(message.topic)) {
    recordTaobaoTmcMessage({ id: message.id, topic: message.topic, content: message.content, status: 'ignored' });
    return 'success' as const;
  }

  const tid = extractTidFromTmcMessage(message.content);
  if (tid && batchTradeIds.has(tid)) {
    recordTaobaoTmcMessage({
      id: message.id,
      topic: message.topic,
      content: message.content,
      status: 'ignored',
      errorMessage: `订单 ${tid} 已在当前批次处理中。`
    });
    return 'success' as const;
  }

  if (tid) {
    if (activeTradeIds.has(tid)) {
      throw new Error(`订单 ${tid} 正在处理中，等待下次重试。`);
    }
    batchTradeIds.add(tid);
    activeTradeIds.add(tid);
  }

  try {
    await handleTradeMessage(message);
    return 'success' as const;
  } finally {
    if (tid) activeTradeIds.delete(tid);
  }
}

async function pollOnce() {
  if (!groupName) throw new Error('TAOBAO_TMC_GROUP 或 TAOBAO_APP_KEY 必须配置。');
  const messages = await consumeTaobaoTmcMessages(groupName, quantity);
  if (!messages.length) return;

  const successIds: string[] = [];
  const failedIds: string[] = [];
  const batchTradeIds = new Set<string>();
  await runLimited(messages, concurrency, async (message) => {
    try {
      const result = await processMessage(message, batchTradeIds);
      if (result === 'success') successIds.push(message.id);
    } catch (error) {
      failedIds.push(message.id);
      recordTaobaoTmcMessage({
        id: message.id,
        topic: message.topic,
        content: message.content,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '淘宝消息处理失败。'
      });
      console.error('[taobao-tmc] message failed', message.id, error);
    }
  });

  await confirmTaobaoTmcMessages(groupName, successIds, failedIds);
}

async function main() {
  console.log(`[taobao-tmc] worker started group=${groupName || '(missing)'} concurrency=${concurrency}`);
  while (true) {
    try {
      await pollOnce();
    } catch (error) {
      console.error('[taobao-tmc] poll failed', error);
    }
    await sleep(intervalMs);
  }
}

void main();

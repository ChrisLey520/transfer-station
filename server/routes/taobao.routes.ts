import type { Express } from 'express';
import { z } from 'zod';
import { adminGuard, authUser } from '../auth.js';
import { decryptKey, encryptKey } from '../crypto.js';
import { routeParam } from '../http.js';
import {
  claimTaobaoOrderGiftCards,
  deleteTaobaoProductMapping,
  getTaobaoShop,
  listClaimedPlatformOrdersForUser,
  listPlatformOrders,
  listTaobaoProductMappings,
  listTaobaoShops,
  markTaobaoShopMessagePermitted,
  saveTaobaoShop,
  upsertTaobaoProductMapping
} from '../store.js';
import { exchangeTaobaoAuthCode, permitTaobaoTmcUser } from '../taobao.js';

export function registerTaobaoRoutes(app: Express) {
  app.get('/api/taobao/shops', adminGuard, (_req, res) => {
    res.json({ shops: listTaobaoShops() });
  });

  app.post('/api/taobao/shops', adminGuard, (req, res) => {
    const schema = z.object({
      id: z.string().min(1),
      nick: z.string().optional(),
      sessionKey: z.string().min(1),
      sessionExpiresAt: z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const shop = saveTaobaoShop({
      id: parsed.data.id,
      nick: parsed.data.nick,
      sessionCiphertext: encryptKey(parsed.data.sessionKey),
      sessionExpiresAt: parsed.data.sessionExpiresAt || null
    });
    res.status(201).json({ shop, shops: listTaobaoShops() });
  });

  app.get('/api/taobao/oauth/start', adminGuard, (_req, res) => {
    const appKey = process.env.TAOBAO_APP_KEY?.trim();
    const redirectUri = process.env.TAOBAO_REDIRECT_URI?.trim();
    const state = (process.env.TAOBAO_OAUTH_STATE || process.env.ADMIN_TOKEN || '').trim();

    if (!appKey || !redirectUri || !state) {
      res.status(400).json({ error: '缺少淘宝 OAuth 配置，请检查 TAOBAO_APP_KEY、TAOBAO_REDIRECT_URI、TAOBAO_OAUTH_STATE。' });
      return;
    }

    const authorizeUrl = new URL('https://oauth.taobao.com/authorize');
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', appKey);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);

    res.json({ authorizeUrl: authorizeUrl.toString() });
  });

  app.get('/api/taobao/oauth/callback', async (req, res) => {
    const schema = z.object({
      code: z.string().min(1),
      state: z.string().optional()
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const expectedState = process.env.TAOBAO_OAUTH_STATE || process.env.ADMIN_TOKEN || '';
    if (!expectedState || parsed.data.state !== expectedState) {
      res.status(403).json({ error: '淘宝授权 state 不匹配。' });
      return;
    }

    try {
      const token = await exchangeTaobaoAuthCode(parsed.data.code, process.env.TAOBAO_REDIRECT_URI);
      const savedShop = saveTaobaoShop({
        id: String(token.taobao_user_id || token.taobao_user_nick || 'default'),
        nick: token.taobao_user_nick || '',
        sessionCiphertext: encryptKey(token.access_token),
        sessionExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null
      });
      const title = encodeURIComponent('淘宝店铺授权成功');
      const savedShopLabel = savedShop ? (savedShop.nick || savedShop.id) : String(token.taobao_user_nick || token.taobao_user_id || 'default');
      const detail = encodeURIComponent(`已保存店铺 ${savedShopLabel} 的授权信息，请返回管理台刷新查看。`);
      res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>淘宝授权成功</title><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><script>try{window.opener?.postMessage({type:'taobao-oauth-complete',ok:true,title:decodeURIComponent('${title}'),detail:decodeURIComponent('${detail}')},window.location.origin);}catch(e){}window.close();</script><p>淘宝授权成功，正在返回管理台...</p></body></html>`);
    } catch (error) {
      const message = encodeURIComponent(error instanceof Error ? error.message : '淘宝授权失败。');
      res.status(400).type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>淘宝授权失败</title><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><script>try{window.opener?.postMessage({type:'taobao-oauth-complete',ok:false,title:'淘宝店铺授权失败',detail:decodeURIComponent('${message}')},window.location.origin);}catch(e){}window.close();</script><p>淘宝授权失败，请返回管理台重试。</p></body></html>`);
    }
  });

  app.post('/api/taobao/shops/:id/permit', adminGuard, async (req, res) => {
    const shop = getTaobaoShop(routeParam(req.params.id));
    const session = shop ? decryptKey(shop.sessionCiphertext) : null;
    if (!shop || !session) {
      res.status(404).json({ error: '淘宝店铺授权不存在或不可解密。' });
      return;
    }

    const schema = z.object({
      topics: z.array(z.string().min(1)).optional()
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const permitted = await permitTaobaoTmcUser(session, parsed.data.topics);
      if (!permitted) throw new Error('淘宝 TMC 开通未返回成功状态。');
      res.json({ shop: markTaobaoShopMessagePermitted(shop.id), shops: listTaobaoShops() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : '淘宝消息开通失败。' });
    }
  });

  app.get('/api/taobao/product-mappings', adminGuard, (_req, res) => {
    res.json({ mappings: listTaobaoProductMappings() });
  });

  app.post('/api/taobao/product-mappings', adminGuard, (req, res) => {
    const schema = z.discriminatedUnion('giftType', [
      z.object({
        id: z.string().optional(),
        numIid: z.string().min(1),
        skuId: z.string().nullable().optional(),
        title: z.string().optional(),
        giftType: z.literal('credit'),
        amountCents: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(20).default(1),
        isActive: z.boolean().optional()
      }),
      z.object({
        id: z.string().optional(),
        numIid: z.string().min(1),
        skuId: z.string().nullable().optional(),
        title: z.string().optional(),
        giftType: z.literal('plan'),
        planId: z.string().min(1),
        durationMonths: z.coerce.number().int().min(1).max(36).default(1),
        quantity: z.coerce.number().int().min(1).max(20).default(1),
        isActive: z.boolean().optional()
      })
    ]);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.status(201).json({ mappings: upsertTaobaoProductMapping(parsed.data) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : '保存淘宝商品映射失败。' });
    }
  });

  app.delete('/api/taobao/product-mappings/:id', adminGuard, (req, res) => {
    const mapping = deleteTaobaoProductMapping(routeParam(req.params.id));
    if (!mapping) {
      res.status(404).json({ error: '淘宝商品映射不存在。' });
      return;
    }
    res.json({ mapping, mappings: listTaobaoProductMappings() });
  });

  app.get('/api/taobao/orders', adminGuard, (req, res) => {
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20)
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    res.json(listPlatformOrders(parsed.data));
  });

  app.post('/api/user/orders/claim', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    const schema = z.object({ orderId: z.string().min(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const orders = claimTaobaoOrderGiftCards(parsed.data.orderId, user.id);
      if (!orders.length) {
        res.status(404).json({ error: '订单未找到或兑换码尚未生成，请确认付款后稍后再试。' });
        return;
      }

      res.json({
        orders: orders.map((order) => ({
          orderId: order.orderId,
          subOrderId: order.subOrderId,
          platform: order.platform,
          title: order.title,
          giftCardCode: order.giftCardCode,
          deliveryStatus: order.deliveryStatus,
          claimedAt: order.claimedAt,
          updatedAt: order.updatedAt
        }))
      });
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        res.status((error as any).statusCode || 400).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error instanceof Error ? error.message : '领取兑换码失败。' });
    }
  });

  app.get('/api/user/orders/claims', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    const schema = z.object({
      days: z.coerce.number().int().positive().max(30).default(30),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20),
      giftCardType: z.enum(['all', 'credit', 'plan']).default('all'),
      giftCardCode: z.string().optional()
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    res.json(
      listClaimedPlatformOrdersForUser(
        user.id,
        parsed.data.days,
        parsed.data.page,
        parsed.data.pageSize,
        parsed.data.giftCardType,
        parsed.data.giftCardCode || ''
      )
    );
  });
}

import type { Express } from 'express';
import { z } from 'zod';
import { adminGuard, authUser } from '../auth.js';
import { routeParam } from '../http.js';
import {
  getAccountState,
  getUserDetail,
  listClaimedPlatformOrdersForUser,
  listKeys,
  listRedeemedGiftCards,
  listUsageLogs,
  listUsers,
  resetUserPassword,
  usageSummaryForUser
} from '../store.js';

export function registerActivityRoutes(app: Express) {
  app.get('/api/logs', adminGuard, (req, res) => {
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20),
      status: z.enum(['all', 'success', 'failed']).default('all'),
      apiKeyId: z.string().optional(),
      range: z.enum(['24h', '3d', '7d', '30d']).default('24h')
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const apiKeyId = parsed.data.apiKeyId && parsed.data.apiKeyId !== 'all' ? parsed.data.apiKeyId : undefined;
    res.json(listUsageLogs({ ...parsed.data, apiKeyId }));
  });

  app.get('/api/user/logs', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20),
      status: z.enum(['all', 'success', 'failed']).default('all'),
      apiKeyId: z.string().optional(),
      range: z.enum(['24h', '3d', '7d', '30d']).default('24h')
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const apiKeyId = parsed.data.apiKeyId && parsed.data.apiKeyId !== 'all' ? parsed.data.apiKeyId : undefined;
    res.json(listUsageLogs({ ...parsed.data, apiKeyId, userId: user.id }));
  });

  app.get('/api/admin/users', adminGuard, (req, res) => {
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20),
      search: z.string().optional(),
      sortField: z.enum(['freeCreditCents', 'createdAt']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc')
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    res.json(listUsers(parsed.data));
  });

  app.get('/api/admin/users/:id', adminGuard, (req, res) => {
    const user = getUserDetail(routeParam(req.params.id));
    if (!user) {
      res.status(404).json({ error: '用户不存在。' });
      return;
    }
    res.json({ user });
  });

  app.patch('/api/admin/users/:id/password', adminGuard, (req, res) => {
    const targetUser = getUserDetail(routeParam(req.params.id));
    if (!targetUser) {
      res.status(404).json({ error: '用户不存在。' });
      return;
    }

    try {
      res.json(resetUserPassword(targetUser.id));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : '重置密码失败。' });
    }
  });

  app.get('/api/admin/users/:id/logs', adminGuard, (req, res) => {
    const targetUser = getUserDetail(routeParam(req.params.id));
    if (!targetUser) {
      res.status(404).json({ error: '用户不存在。' });
      return;
    }
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20),
      status: z.enum(['all', 'success', 'failed']).default('all'),
      apiKeyId: z.string().optional(),
      range: z.enum(['24h', '3d', '7d', '30d']).default('30d')
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const apiKeyId = parsed.data.apiKeyId && parsed.data.apiKeyId !== 'all' ? parsed.data.apiKeyId : undefined;
    res.json(listUsageLogs({ ...parsed.data, apiKeyId, userId: targetUser.id }));
  });

  app.get('/api/admin/users/:id/order-claims', adminGuard, (req, res) => {
    const targetUser = getUserDetail(routeParam(req.params.id));
    if (!targetUser) {
      res.status(404).json({ error: '用户不存在。' });
      return;
    }
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
        targetUser.id,
        parsed.data.days,
        parsed.data.page,
        parsed.data.pageSize,
        parsed.data.giftCardType,
        parsed.data.giftCardCode || ''
      )
    );
  });

  app.get('/api/admin/users/:id/gift-card-redemptions', adminGuard, (req, res) => {
    const targetUser = getUserDetail(routeParam(req.params.id));
    if (!targetUser) {
      res.status(404).json({ error: '用户不存在。' });
      return;
    }
    const schema = z.object({
      days: z.coerce.number().int().positive().max(30).default(30),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20),
      type: z.enum(['all', 'credit', 'plan']).default('all'),
      code: z.string().optional()
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    res.json(listRedeemedGiftCards({ userId: targetUser.id, ...parsed.data }));
  });

  app.get('/api/user/usage', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    res.json({ summary: usageSummaryForUser(user.id), keys: listKeys(user.id), account: getAccountState(user.id) });
  });

  app.get('/api/usage', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    res.json({ summary: usageSummaryForUser(user.id), keys: listKeys(user.id), account: getAccountState(user.id) });
  });
}

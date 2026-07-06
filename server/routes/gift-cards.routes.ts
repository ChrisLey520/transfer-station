import type { Express } from 'express';
import { z } from 'zod';
import { adminGuard, authUser } from '../auth.js';
import { routeParam } from '../http.js';
import {
  createGiftCards,
  listGiftCards,
  listRedeemedGiftCards,
  previewGiftCard,
  redeemGiftCard,
  revokeGiftCard
} from '../store.js';
import type { User } from '../types.js';

export function registerGiftCardRoutes(app: Express) {
  app.get('/api/user/gift-card-redemptions', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
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
    res.json(listRedeemedGiftCards({ userId: user.id, ...parsed.data }));
  });

  app.get('/api/admin/gift-card-redemptions', adminGuard, (req, res) => {
    const schema = z.object({
      days: z.coerce.number().int().positive().max(30).default(30),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20),
      userId: z.string().optional()
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    res.json(listRedeemedGiftCards(parsed.data));
  });

  app.get('/api/gift-cards', adminGuard, (req, res) => {
    const schema = z.object({
      type: z.enum(['plan', 'credit']).optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(100).default(20)
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    res.json(listGiftCards(parsed.data));
  });

  app.post('/api/gift-cards', adminGuard, (req, res) => {
    const schema = z.discriminatedUnion('type', [
      z.object({
        type: z.literal('credit'),
        amountCents: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(200).default(1),
        prefix: z.string().optional()
      }),
      z.object({
        type: z.literal('plan'),
        planId: z.string().min(1),
        durationMonths: z.coerce.number().int().min(1).max(36).default(1),
        quantity: z.coerce.number().int().min(1).max(200).default(1),
        prefix: z.string().optional()
      })
    ]);

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const adminUser = res.locals.adminUser as User | undefined;
      const giftCards = createGiftCards({
        ...parsed.data,
        createdByUserId: adminUser?.id || null
      });
      res.status(201).json({ giftCards });
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        res.status((error as any).statusCode || 400).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create gift cards' });
    }
  });

  app.patch('/api/gift-cards/:code/revoke', adminGuard, (req, res) => {
    try {
      const adminUser = res.locals.adminUser as User | undefined;
      const giftCard = revokeGiftCard(routeParam(req.params.code), adminUser?.id || null);
      res.json({ giftCard, giftCards: listGiftCards({ page: 1, pageSize: 20 }) });
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        res.status((error as any).statusCode || 400).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to revoke gift card' });
    }
  });

  app.post('/api/user/gift-cards/preview', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    const schema = z.object({ code: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(previewGiftCard(user.id, parsed.data.code));
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        res.status((error as any).statusCode || 400).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error instanceof Error ? error.message : '无法预览礼品卡。' });
    }
  });

  app.post('/api/user/gift-cards/redeem', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    const schema = z.object({ code: z.string().min(1), confirm: z.boolean().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(redeemGiftCard(user.id, parsed.data));
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        res.status((error as any).statusCode || 400).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error instanceof Error ? error.message : '无法兑换礼品卡。' });
    }
  });
}

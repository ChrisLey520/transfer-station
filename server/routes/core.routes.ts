import type { Express, RequestHandler } from 'express';
import { z } from 'zod';
import { adminGuard, authUser } from '../auth.js';
import {
  dismissAnnouncementForUser,
  getAccountState,
  getAnnouncementForUser,
  listKeys,
  listPlans,
  listProductLinks,
  loginUser,
  registerUser,
  saveAnnouncement,
  updateProductLinks,
  upsertPlan,
  usageSummaryForUser
} from '../store.js';
import type { User } from '../types.js';
import { createSliderChallenge, verifySliderChallenge, verifySliderToken } from '../slider-captcha.js';
import { upstreamConfigured } from '../proxy/status.js';

type SlidingWindowGuard = (scope: string, limit: number, windowMs: number) => RequestHandler;

export function registerCoreRoutes(app: Express, slidingWindowGuard: SlidingWindowGuard) {
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      upstreamConfigured: upstreamConfigured(),
      now: new Date().toISOString()
    });
  });

  app.post('/api/auth/slider-challenge', slidingWindowGuard('slider-challenge', 60, 60_000), (req, res) => {
    const schema = z.object({ purpose: z.enum(['login', 'register']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    res.json(createSliderChallenge(parsed.data.purpose));
  });

  app.post('/api/auth/slider-verify', slidingWindowGuard('slider-verify', 80, 60_000), (req, res) => {
    const schema = z.object({
      challengeId: z.string().min(1),
      purpose: z.enum(['login', 'register']),
      positionPct: z.coerce.number().min(0).max(100)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const result = verifySliderChallenge(parsed.data);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      captchaToken: result.captchaToken,
      expiresAt: result.expiresAt
    });
  });

  app.post('/api/auth/register', slidingWindowGuard('auth-register', 20, 10 * 60_000), (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      captchaToken: z.string().min(1),
      displayName: z.string().min(1).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    if (!verifySliderToken(parsed.data.captchaToken, 'register')) {
      res.status(400).json({ error: '请先完成拼图验证。' });
      return;
    }

    try {
      res.status(201).json(
        registerUser({
          email: parsed.data.email,
          password: parsed.data.password,
          displayName: parsed.data.displayName
        })
      );
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : '注册失败。' });
    }
  });

  app.post('/api/auth/login', slidingWindowGuard('auth-login', 40, 10 * 60_000), (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      captchaToken: z.string().min(1)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    if (!verifySliderToken(parsed.data.captchaToken, 'login')) {
      res.status(400).json({ error: '请先完成拼图验证。' });
      return;
    }

    try {
      res.json(loginUser({ email: parsed.data.email, password: parsed.data.password }));
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : '登录失败。' });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    res.json({ user, announcement: getAnnouncementForUser(user.id) });
  });

  app.get('/api/bootstrap', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    res.json({
      user,
      account: getAccountState(user.id),
      summary: usageSummaryForUser(user.id),
      plans: listPlans(),
      productLinks: listProductLinks(),
      keys: listKeys(user.id),
      announcement: getAnnouncementForUser(user.id)
    });
  });

  app.post('/api/announcement/dismiss', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;

    const parsed = z.object({ action: z.enum(['close', 'closeToday']) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const announcement = dismissAnnouncementForUser(user.id, parsed.data.action);
      res.json({ announcement });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : '关闭公告失败。' });
    }
  });

  app.get('/api/admin/announcement', adminGuard, (_req, res) => {
    const adminUser = res.locals.adminUser as User;
    res.json({ announcement: getAnnouncementForUser(adminUser.id) });
  });

  app.put('/api/admin/announcement', adminGuard, (req, res) => {
    const parsed = z.object({ content: z.string().trim().min(1).max(20000) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const announcement = saveAnnouncement(parsed.data.content);
      res.json({ announcement });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : '保存公告失败。' });
    }
  });

  app.get('/api/plans', adminGuard, (_req, res) => {
    res.json({ plans: listPlans() });
  });

  app.post('/api/plans', adminGuard, (req, res) => {
    const schema = z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      description: z.string().default(''),
      fiveHourTokenLimit: z.coerce.number().int().positive(),
      weeklyTokenLimit: z.coerce.number().int().positive(),
      priceCents: z.coerce.number().int().nonnegative(),
      currency: z.string().min(1).default('USD'),
      isActive: z.boolean().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    res.json({ plan: upsertPlan(parsed.data) });
  });

  app.get('/api/product-links', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    res.json({ productLinks: listProductLinks() });
  });

  app.patch('/api/product-links', adminGuard, (req, res) => {
    const schema = z.object({
      productLinks: z.array(
        z.object({
          itemType: z.enum(['plan', 'credit']),
          itemId: z.string().min(1),
          channel: z.enum(['taobao', 'xianyu']),
          url: z.string().url()
        })
      )
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json({ productLinks: updateProductLinks(parsed.data.productLinks) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save product links' });
    }
  });
}

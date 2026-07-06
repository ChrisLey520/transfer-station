import type { Express } from 'express';
import { z } from 'zod';
import { adminGuard, authUser } from '../auth.js';
import { routeParam } from '../http.js';
import {
  createKey,
  getRawKeyById,
  listKeys,
  listPlans,
  revokeKey,
  updateKey
} from '../store.js';
import type { User } from '../types.js';
import { buildCcSwitchProviderLink, requestAgentApiEndpoint } from '../proxy/status.js';

export function registerKeyRoutes(
  app: Express,
  options: { port: number; ccSwitchUsageAutoIntervalMinutes: number }
) {
  app.get('/api/keys', adminGuard, (_req, res) => {
    res.json({ keys: listKeys() });
  });

  app.get('/api/user/keys', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    res.json({ keys: listKeys(user.id) });
  });

  app.post('/api/keys', adminGuard, (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      ownerEmail: z.string().email().nullable().optional().or(z.literal('')),
      planId: z.string().min(1).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const planId = parsed.data.planId || listPlans().find((plan) => plan.isActive)?.id;
      if (!planId) {
        res.status(400).json({ error: 'No active plan is available' });
        return;
      }
      const adminUser = res.locals.adminUser as User | undefined;
      if (!adminUser) {
        res.status(401).json({ error: '未配置管理员用户。' });
        return;
      }

      const result = createKey({
        name: parsed.data.name,
        ownerEmail: parsed.data.ownerEmail || null,
        planId,
        userId: adminUser.id
      });
      res.status(201).json({ key: result.key, preview: result.preview, keys: listKeys() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create key' });
    }
  });

  app.post('/api/user/keys', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    const schema = z.object({
      name: z.string().min(1),
      ownerEmail: z.string().email().nullable().optional().or(z.literal(''))
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const result = createKey({
        name: parsed.data.name,
        ownerEmail: parsed.data.ownerEmail || null,
        userId: user.id
      });
      res.status(201).json({ key: result.key, preview: result.preview, keys: listKeys(user.id) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create key' });
    }
  });

  app.patch('/api/keys/:id', adminGuard, (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      ownerEmail: z.string().email().nullable().optional().or(z.literal('')),
      planId: z.string().optional(),
      status: z.enum(['active', 'paused', 'revoked']).optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const key = updateKey(routeParam(req.params.id), {
        ...parsed.data,
        ownerEmail: parsed.data.ownerEmail === '' ? null : parsed.data.ownerEmail
      });
      if (!key) {
        res.status(404).json({ error: 'Key not found' });
        return;
      }
      res.json({ key, keys: listKeys() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update key' });
    }
  });

  app.patch('/api/user/keys/:id', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    const schema = z.object({
      name: z.string().min(1).optional(),
      ownerEmail: z.string().email().nullable().optional().or(z.literal('')),
      planId: z.string().optional(),
      status: z.enum(['active', 'paused', 'revoked']).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const key = updateKey(
        routeParam(req.params.id),
        { ...parsed.data, ownerEmail: parsed.data.ownerEmail === '' ? null : parsed.data.ownerEmail },
        user.id
      );
      if (!key) {
        res.status(404).json({ error: 'Key not found' });
        return;
      }
      res.json({ key, keys: listKeys(user.id) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update key' });
    }
  });

  app.get('/api/keys/:id/secret', adminGuard, (req, res) => {
    const result = getRawKeyById(routeParam(req.params.id));
    if (!result) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }

    if (!result.rawKey) {
      res.status(409).json({ error: 'The full key is unavailable. This key was created before encrypted key storage was enabled.' });
      return;
    }

    res.json({
      key: result.rawKey,
      keyPreview: result.key.keyPreview,
      ccSwitch: buildCcSwitchLinks(req, result.rawKey, options)
    });
  });

  app.get('/api/user/keys/:id/secret', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    const result = getRawKeyById(routeParam(req.params.id), user.id);
    if (!result) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }
    if (!result.rawKey) {
      res.status(409).json({ error: 'The full key is unavailable. This key was created before encrypted key storage was enabled.' });
      return;
    }

    res.json({
      key: result.rawKey,
      keyPreview: result.key.keyPreview,
      ccSwitch: buildCcSwitchLinks(req, result.rawKey, options)
    });
  });

  app.delete('/api/keys/:id', adminGuard, (req, res) => {
    const key = revokeKey(routeParam(req.params.id));
    if (!key) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }
    res.json({ key, keys: listKeys() });
  });

  app.delete('/api/user/keys/:id', (req, res) => {
    const user = authUser(req, res);
    if (!user) return;
    const key = revokeKey(routeParam(req.params.id), user.id);
    if (!key) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }
    res.json({ key, keys: listKeys(user.id) });
  });
}

function buildCcSwitchLinks(
  req: Parameters<typeof requestAgentApiEndpoint>[0],
  apiKey: string,
  options: { port: number; ccSwitchUsageAutoIntervalMinutes: number }
) {
  return {
    codex: buildCcSwitchProviderLink({
      appName: 'codex',
      name: 'RelayHub Codex',
      endpoint: requestAgentApiEndpoint(req, options.port, 'codex'),
      apiKey,
      usageAutoIntervalMinutes: options.ccSwitchUsageAutoIntervalMinutes
    }),
    claude: buildCcSwitchProviderLink({
      appName: 'claude',
      name: 'RelayHub Claude Code',
      endpoint: requestAgentApiEndpoint(req, options.port, 'claude'),
      apiKey,
      usageAutoIntervalMinutes: options.ccSwitchUsageAutoIntervalMinutes
    })
  };
}

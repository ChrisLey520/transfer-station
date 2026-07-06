import type { Express } from 'express';
import { z } from 'zod';
import { adminGuard } from '../auth.js';
import { routeParam } from '../http.js';
import {
  addUpstreamChannelKey,
  cloneUpstreamChannel,
  deleteUpstreamChannel,
  deleteUpstreamChannelKey,
  deleteUpstreamModelRate,
  listUpstreamChannels,
  updateUpstreamChannelKey,
  updateUpstreamChannelStatus,
  upsertUpstreamChannel,
  upsertUpstreamModelRate
} from '../store.js';

const optionalUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.union([z.string().url(), z.literal('')]).optional()
);

const upstreamChannelSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  websiteUrl: optionalUrlSchema,
  status: z.enum(['active', 'paused', 'banned']).optional(),
  claudeApiUrl: z.string().url(),
  codexApiUrl: z.string().url(),
  useIndependentAgentKeys: z.boolean().optional(),
  inputRatePerMillion: z.coerce.number().nonnegative().optional(),
  outputRatePerMillion: z.coerce.number().nonnegative().optional(),
  cacheCreationRatePerMillion: z.coerce.number().nonnegative().optional(),
  cacheReadRatePerMillion: z.coerce.number().nonnegative().optional(),
  serverErrorRecoveryMinutes: z.coerce.number().int().min(5).max(300).optional(),
  displayUsageMultiplier: z.coerce.number().min(1).optional(),
  sortOrder: z.coerce.number().int().positive().optional()
});

const upstreamChannelStatusSchema = z.object({
  status: z.enum(['active', 'paused', 'banned'])
});

const upstreamChannelCloneSchema = z.object({
  includeKeys: z.boolean().optional()
});

const upstreamKeySchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  agentType: z.enum(['shared', 'claude-code', 'codex']).optional(),
  sortOrder: z.coerce.number().int().optional(),
  expiresAt: z.string().nullable().optional()
});

const upstreamModelRateSchema = z.object({
  id: z.string().min(1).optional(),
  agentType: z.enum(['claude-code', 'codex']),
  model: z.string().min(1),
  inputRatePerMillion: z.coerce.number().nonnegative().optional(),
  outputRatePerMillion: z.coerce.number().nonnegative().optional(),
  cacheCreationRatePerMillion: z.coerce.number().nonnegative().optional(),
  cacheReadRatePerMillion: z.coerce.number().nonnegative().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

export function registerUpstreamChannelRoutes(app: Express) {
  app.get('/api/upstream-channels', adminGuard, (_req, res) => {
    res.json({ channels: listUpstreamChannels() });
  });

  app.post('/api/upstream-channels', adminGuard, (req, res) => {
    const parsed = upstreamChannelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const channel = upsertUpstreamChannel(parsed.data);
      res.status(parsed.data.id ? 200 : 201).json({ channel, channels: listUpstreamChannels() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save upstream channel' });
    }
  });

  app.post('/api/upstream-channels/:id/clone', adminGuard, (req, res) => {
    const parsed = upstreamChannelCloneSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const channel = cloneUpstreamChannel(routeParam(req.params.id), { includeKeys: parsed.data.includeKeys });
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }
      res.status(201).json({ channel, channels: listUpstreamChannels() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to clone upstream channel' });
    }
  });

  app.patch('/api/upstream-channels/:id', adminGuard, (req, res) => {
    const parsed = upstreamChannelSchema
      .omit({ id: true })
      .partial()
      .required({ name: true, claudeApiUrl: true, codexApiUrl: true })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const channel = upsertUpstreamChannel({ id: routeParam(req.params.id), ...parsed.data });
      res.json({ channel, channels: listUpstreamChannels() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save upstream channel' });
    }
  });

  app.patch('/api/upstream-channels/:id/status', adminGuard, (req, res) => {
    const parsed = upstreamChannelStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const channel = updateUpstreamChannelStatus(routeParam(req.params.id), parsed.data.status);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.json({ channel, channels: listUpstreamChannels() });
  });

  app.delete('/api/upstream-channels/:id', adminGuard, (req, res) => {
    const channel = deleteUpstreamChannel(routeParam(req.params.id));
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    res.json({ channel, channels: listUpstreamChannels() });
  });

  app.post('/api/upstream-channels/:id/keys', adminGuard, (req, res) => {
    const parsed = upstreamKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const channel = addUpstreamChannelKey(routeParam(req.params.id), parsed.data);
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }
      res.status(201).json({ channel, channels: listUpstreamChannels() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to add upstream key' });
    }
  });

  app.patch('/api/upstream-channels/:id/keys/:keyId', adminGuard, (req, res) => {
    const parsed = upstreamKeySchema
      .extend({ key: z.string().optional() })
      .partial()
      .extend({
        status: z.enum(['active', 'paused', 'revoked', 'banned']).optional()
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const channel = updateUpstreamChannelKey(routeParam(req.params.id), routeParam(req.params.keyId), parsed.data);
      if (!channel) {
        res.status(404).json({ error: 'Key not found' });
        return;
      }
      res.json({ channel, channels: listUpstreamChannels() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update upstream key' });
    }
  });

  app.delete('/api/upstream-channels/:id/keys/:keyId', adminGuard, (req, res) => {
    const key = deleteUpstreamChannelKey(routeParam(req.params.id), routeParam(req.params.keyId));
    if (!key) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }
    res.json({ key, channels: listUpstreamChannels() });
  });

  app.post('/api/upstream-channels/:id/model-rates', adminGuard, (req, res) => {
    const parsed = upstreamModelRateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const channel = upsertUpstreamModelRate(routeParam(req.params.id), parsed.data);
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }
      res.status(201).json({ channel, channels: listUpstreamChannels() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save model rate' });
    }
  });

  app.patch('/api/upstream-channels/:id/model-rates/:rateId', adminGuard, (req, res) => {
    const parsed = upstreamModelRateSchema.partial().required({ agentType: true, model: true }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const channel = upsertUpstreamModelRate(routeParam(req.params.id), { id: routeParam(req.params.rateId), ...parsed.data });
      if (!channel) {
        res.status(404).json({ error: 'Rate not found' });
        return;
      }
      res.json({ channel, channels: listUpstreamChannels() });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to save model rate' });
    }
  });

  app.delete('/api/upstream-channels/:id/model-rates/:rateId', adminGuard, (req, res) => {
    const rate = deleteUpstreamModelRate(routeParam(req.params.id), routeParam(req.params.rateId));
    if (!rate) {
      res.status(404).json({ error: 'Rate not found' });
      return;
    }
    res.json({ rate, channels: listUpstreamChannels() });
  });
}

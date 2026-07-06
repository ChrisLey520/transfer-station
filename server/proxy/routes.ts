import type { Express, Request, Response } from 'express';
import crypto from 'node:crypto';
import { authProxyKey, authStatusKey } from '../auth.js';
import {
  assertQuota,
  createUsageLog,
  extractResetTime,
  listUpstreamSelectionCandidates,
  materializeUpstreamSelection,
  markUpstreamGroupFailure,
  markUpstreamKeyFailure,
  resetUpstreamKeyFailureState,
  resolveUpstreamRates,
  touchKey,
  touchUpstreamKey
} from '../store.js';
import type { AgentType } from '../types.js';
import { getTokenUsage, parseJsonText, rewriteJsonUsageText, withoutUsageCost } from '../usage.js';
import {
  hasUpstreamErrorPayload,
  isGroupLevelFailure,
  isKeyLevelFailure,
  recoveryUntilFromUpstream,
  upstreamErrorMessage
} from './failover.js';
import { buildUpstreamHeaders, routeToUpstreamPath } from './headers.js';
import { type HealthProbeOptions, probeKeyHealth } from './health.js';
import { writeProxyLog } from './logging.js';
import { streamSse } from './sse.js';
import { buildKeyBalance, buildKeyUsageStatus, upstreamConfigured } from './status.js';

export type ProxyRouteOptions = HealthProbeOptions & {
  proxyTimeoutMs: number;
};

async function handleProxyRequest(req: Request, res: Response, agent: AgentType, options: ProxyRouteOptions) {
  const startedAt = Date.now();
  const key = authProxyKey(req, res);
  if (!key) return;
  const upstreamPath = routeToUpstreamPath(req);

  const quotaCheck = assertQuota(key);
  if (!quotaCheck.ok) {
    createUsageLog({
      apiKeyId: key.id,
      channelGroupId: null,
      channelNumber: null,
      usageSource: 'none',
      model: req.body?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: quotaCheck.statusCode,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      latencyMs: Date.now() - startedAt,
      errorMessage: quotaCheck.message,
      requestId: `local_${crypto.randomUUID()}`
    });
    res.status(quotaCheck.statusCode).json({
      type: 'error',
      error: {
        type: 'rate_limit_error',
        message: quotaCheck.message
      },
      quota: quotaCheck.quota
    });
    return;
  }

  const candidates = listUpstreamSelectionCandidates(agent);
  if (!candidates.length) {
    writeProxyLog({
      key,
      model: req.body?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: 500,
      startedAt,
      errorMessage: `No upstream channel is available for ${agent}`,
      requestId: `local_${crypto.randomUUID()}`
    });
    res.status(500).json({
      type: 'error',
      error: {
        type: 'configuration_error',
        message: `No upstream channel is available for ${agent}`
      }
    });
    return;
  }

  let lastFailure: {
    statusCode: number;
    message: string;
    requestId: string;
  } | null = null;
  const attemptedGroupIds = new Set<string>();
  try {
    for (const candidate of candidates) {
      if (attemptedGroupIds.has(candidate.group.id) && isGroupLevelFailure(lastFailure?.statusCode || 0)) {
        continue;
      }

      const selection = materializeUpstreamSelection(candidate);
      if (!selection) continue;

      const upstreamUrl = `${selection.apiUrl}${upstreamPath}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.proxyTimeoutMs);
      const abortUpstream = () => controller.abort();
      req.on('aborted', abortUpstream);
      res.on('close', abortUpstream);

      try {
        const upstream = await fetch(upstreamUrl, {
          method: req.method,
          headers: buildUpstreamHeaders(req, selection, options.anthropicVersion),
          body: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : JSON.stringify(req.body ?? {}),
          signal: controller.signal
        });

        touchUpstreamKey(selection.key.id);
        const requestId = upstream.headers.get('request-id') || upstream.headers.get('x-request-id') || `up_${crypto.randomUUID()}`;
        const contentType = upstream.headers.get('content-type') || 'application/json';
        const requestModel = req.body?.model || 'unknown';
        const rates = resolveUpstreamRates({ groupId: selection.group.id, agent, model: requestModel });
        const displayUsageMultiplier = selection.group.displayUsageMultiplier;

        if (contentType.includes('text/event-stream') && upstream.body) {
          clearTimeout(timer);
          touchKey(key.id);
          res.status(upstream.status);
          res.setHeader('content-type', contentType);
          res.setHeader('x-transfer-station-key', key.keyPreview);
          res.setHeader('x-transfer-station-upstream', 'RelayHub');
          res.setHeader('x-transfer-station-quota-five-hour-remaining', String(quotaCheck.quota.remainingFiveHour));
          res.setHeader('x-transfer-station-quota-weekly-remaining', String(quotaCheck.quota.remainingWeekly));
          await streamSse(upstream, req, res, {
            key,
            channelGroupId: selection.group.id,
            channelNumber: selection.group.channelNumber,
            model: requestModel,
            path: req.path,
            method: req.method,
            statusCode: upstream.status,
            startedAt,
            requestId,
            rates,
            displayUsageMultiplier,
            usageSource: quotaCheck.quota.quotaSource
          });
          return;
        }

        const text = await upstream.text();
        const payload = parseJsonText(text);
        const errorMessage = upstreamErrorMessage(payload, upstream.statusText);
        const responseErrorMessage = !upstream.ok
          ? errorMessage
          : hasUpstreamErrorPayload(payload)
            ? upstreamErrorMessage(payload, 'Upstream response error')
            : null;
        const loggedStatusCode = responseErrorMessage && upstream.ok ? 502 : upstream.status;

        if (!upstream.ok && isKeyLevelFailure(upstream.status, errorMessage)) {
          markUpstreamKeyFailure({
            keyId: selection.key.id,
            statusCode: upstream.status,
            reason: errorMessage,
            until: recoveryUntilFromUpstream(upstream.headers, payload) || extractResetTime(payload)
          });
          lastFailure = { statusCode: upstream.status, message: errorMessage, requestId };
          continue;
        }

        if (!upstream.ok && isGroupLevelFailure(upstream.status)) {
          attemptedGroupIds.add(selection.group.id);
          markUpstreamGroupFailure({
            groupId: selection.group.id,
            statusCode: upstream.status,
            reason: errorMessage,
            until: recoveryUntilFromUpstream(upstream.headers, payload)
          });
          lastFailure = { statusCode: upstream.status, message: errorMessage, requestId };
          continue;
        }

        if (selection.key.exhaustedUntil || selection.key.failureReason || selection.key.failureStatusCode !== null) {
          resetUpstreamKeyFailureState(selection.key.id);
        }
        touchKey(key.id);
        res.status(upstream.status);
        res.setHeader('content-type', contentType);
        res.setHeader('x-transfer-station-key', key.keyPreview);
        res.setHeader('x-transfer-station-upstream', 'RelayHub');
        res.setHeader('x-transfer-station-usage-multiplier', displayUsageMultiplier.toFixed(2));
        res.setHeader('x-transfer-station-quota-five-hour-remaining', String(quotaCheck.quota.remainingFiveHour));
        res.setHeader('x-transfer-station-quota-weekly-remaining', String(quotaCheck.quota.remainingWeekly));
        const responseBody = contentType.includes('application/json')
          ? rewriteJsonUsageText(text, displayUsageMultiplier).text
          : text;
        res.send(responseBody);

        const loggedModel = req.body?.model || (payload as any)?.model || 'unknown';
        const tokenUsage = getTokenUsage(
          payload,
          resolveUpstreamRates({ groupId: selection.group.id, agent, model: loggedModel }),
          displayUsageMultiplier
        );
        const logUsage = responseErrorMessage ? withoutUsageCost(tokenUsage) : tokenUsage;
        createUsageLog({
          apiKeyId: key.id,
          channelGroupId: selection.group.id,
          channelNumber: selection.group.channelNumber,
          usageSource: quotaCheck.quota.quotaSource,
          model: loggedModel,
          path: req.path,
          method: req.method,
          statusCode: loggedStatusCode,
          inputTokens: logUsage.inputTokens,
          outputTokens: logUsage.outputTokens,
          cacheCreationInputTokens: logUsage.cacheCreationInputTokens,
          cacheReadInputTokens: logUsage.cacheReadInputTokens,
          totalTokens: logUsage.totalTokens,
          inputCostCents: logUsage.inputCostCents,
          outputCostCents: logUsage.outputCostCents,
          cacheCreationCostCents: logUsage.cacheCreationCostCents,
          cacheReadCostCents: logUsage.cacheReadCostCents,
          totalCostCents: logUsage.totalCostCents,
          latencyMs: Date.now() - startedAt,
          errorMessage: responseErrorMessage,
          requestId
        });
        return;
      } finally {
        clearTimeout(timer);
        req.off('aborted', abortUpstream);
        res.off('close', abortUpstream);
      }
    }

    const message = lastFailure?.message || 'All upstream channels failed';
    writeProxyLog({
      key,
      model: req.body?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: lastFailure?.statusCode || 502,
      startedAt,
      errorMessage: message,
      requestId: lastFailure?.requestId || `local_${crypto.randomUUID()}`
    });
    res.status(lastFailure?.statusCode || 502).json({
      type: 'error',
      error: {
        type: lastFailure?.statusCode === 402 ? 'rate_limit_error' : 'api_error',
        message
      }
    });
  } catch (error) {
    writeProxyLog({
      key,
      model: req.body?.model || 'unknown',
      path: req.path,
      method: req.method,
      statusCode: 502,
      startedAt,
      errorMessage: error instanceof Error ? error.message : 'Upstream request failed',
      requestId: `local_${crypto.randomUUID()}`
    });
    res.status(502).json({
      type: 'error',
      error: {
        type: 'api_error',
        message: error instanceof Error ? error.message : 'Upstream request failed'
      }
    });
  }
}

export function registerProxyRoutes(app: Express, options: ProxyRouteOptions) {
  for (const prefix of ['/claude-code/v1', '/codex/v1']) {
    app.head(prefix, (_req, res) => {
      res.status(204).end();
    });

    app.get(prefix, (_req, res) => {
      res.json({
        ok: true,
        service: 'transfer-station',
        health: `${prefix}/key/health`,
        balance: `${prefix}/key/balance`,
        usage: `${prefix}/key/usage`,
        now: new Date().toISOString()
      });
    });

    app.get(`${prefix}/health`, (_req, res) => {
      res.json({
        ok: true,
        upstreamConfigured: upstreamConfigured(),
        now: new Date().toISOString()
      });
    });

    app.get(`${prefix}/key/health`, (req, res) => {
      const key = authStatusKey(req, res, { allowQuery: true });
      if (!key) return;
      const agent: AgentType = prefix.startsWith('/codex') ? 'codex' : 'claude-code';
      void probeKeyHealth(key, agent, options)
        .then((health) => {
          const statusCode =
            typeof (health as { statusCode?: unknown }).statusCode === 'number'
              ? ((health as { statusCode: number }).statusCode || 503)
              : health.ok
                ? 200
                : 503;
          res.status(statusCode).json(health);
        })
        .catch((error) => {
          res.status(503).json({
            ok: false,
            status: 'probe_error',
            message: error instanceof Error ? error.message : 'Health probe failed',
            now: new Date().toISOString()
          });
        });
    });

    app.get(`${prefix}/key/balance`, (req, res) => {
      const key = authStatusKey(req, res);
      if (!key) return;
      res.json(buildKeyBalance(key));
    });

    app.get(`${prefix}/key/usage`, (req, res) => {
      const key = authStatusKey(req, res);
      if (!key) return;
      res.json(buildKeyUsageStatus(key));
    });
  }

  app.all('/claude-code/v1/*route', (req, res) => {
    void handleProxyRequest(req, res, 'claude-code', options);
  });

  app.all('/codex/v1/*route', (req, res) => {
    void handleProxyRequest(req, res, 'codex', options);
  });

  app.all(['/v1', '/v1/*route'], (_req, res) => {
    res.status(404).json({
      type: 'error',
      error: {
        type: 'not_found_error',
        message: 'Legacy /v1 endpoint has been removed. Use /claude-code/v1 or /codex/v1.'
      }
    });
  });
}

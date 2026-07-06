import {
  assertQuota,
  listUpstreamSelectionCandidates,
  materializeUpstreamSelection,
  touchUpstreamKey
} from '../store.js';
import type { AgentType, KeyWithPlan } from '../types.js';
import { parseJsonText } from '../usage.js';
import { upstreamErrorMessage } from './failover.js';
import { buildUpstreamHeaders } from './headers.js';
import { upstreamConfigured } from './status.js';

export type HealthProbeOptions = {
  anthropicVersion: string;
  timeoutMs: number;
  claudeModel: string;
  codexModel: string;
  prompt: string;
  maxOutputTokens: number;
};

function healthProbeSpec(agent: AgentType, options: HealthProbeOptions) {
  if (agent === 'claude-code') {
    return {
      path: '/v1/messages',
      model: options.claudeModel,
      body: {
        model: options.claudeModel,
        max_tokens: options.maxOutputTokens,
        messages: [{ role: 'user', content: options.prompt }]
      }
    };
  }

  return {
    path: '/v1/responses',
    model: options.codexModel,
    body: {
      model: options.codexModel,
      input: options.prompt,
      max_output_tokens: options.maxOutputTokens
    }
  };
}

function extractHealthProbeReply(agent: AgentType, payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;

  if (agent === 'claude-code') {
    const content = record.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const text = (part as Record<string, unknown>).text;
          return typeof text === 'string' ? text : '';
        })
        .filter(Boolean)
        .join(' ')
        .trim();
    }
    return '';
  }

  if (typeof record.output_text === 'string') return record.output_text.trim();
  if (!Array.isArray(record.output)) return '';
  return record.output
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) return [];
      return content.map((part) => {
        if (!part || typeof part !== 'object') return '';
        const value = part as Record<string, unknown>;
        const text = value.text || value.content || value.value;
        return typeof text === 'string' ? text : '';
      });
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

export async function probeKeyHealth(key: KeyWithPlan, agent: AgentType, options: HealthProbeOptions) {
  const startedAt = Date.now();
  const quotaCheck = assertQuota(key);
  const candidates = listUpstreamSelectionCandidates(agent);
  const spec = healthProbeSpec(agent, options);
  const attempts: Array<{
    upstream: string;
    channelNumber: number | null;
    statusCode: number | null;
    ok: boolean;
    latencyMs: number;
    message: string;
    requestId: string | null;
  }> = [];

  if (!candidates.length) {
    return {
      ok: false,
      status: 'configuration_error',
      message: `No upstream channel is available for ${agent}`,
      upstreamConfigured: upstreamConfigured(),
      key: {
        id: key.id,
        name: key.name,
        preview: key.keyPreview,
        status: key.status
      },
      probe: {
        agent,
        model: spec.model,
        promptTokenBudget: 'fixed-minimal',
        maxOutputTokens: options.maxOutputTokens,
        attempts
      },
      quota: quotaCheck.quota,
      quotaOk: quotaCheck.ok,
      now: new Date().toISOString()
    };
  }

  if (!quotaCheck.ok) {
    return {
      ok: false,
      status: 'quota_exceeded',
      message: quotaCheck.message,
      upstreamConfigured: upstreamConfigured(),
      key: {
        id: key.id,
        name: key.name,
        preview: key.keyPreview,
        status: key.status
      },
      probe: {
        agent,
        model: spec.model,
        promptTokenBudget: 'fixed-minimal',
        maxOutputTokens: options.maxOutputTokens,
        attempts
      },
      quota: quotaCheck.quota,
      quotaOk: quotaCheck.ok,
      now: new Date().toISOString(),
      statusCode: quotaCheck.statusCode
    };
  }

  for (const candidate of candidates) {
    const selection = materializeUpstreamSelection(candidate);
    if (!selection) continue;

    const attemptStartedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const upstream = await fetch(`${selection.apiUrl}${spec.path}`, {
        method: 'POST',
        headers: buildUpstreamHeaders(null, selection, options.anthropicVersion),
        body: JSON.stringify(spec.body),
        signal: controller.signal
      });
      touchUpstreamKey(selection.key.id);
      const text = await upstream.text();
      const payload = parseJsonText(text);
      const requestId = upstream.headers.get('request-id') || upstream.headers.get('x-request-id');
      const reply = upstream.ok ? extractHealthProbeReply(agent, payload) : '';
      const errorMessage = upstreamErrorMessage(payload, upstream.statusText);
      const attempt = {
        upstream: 'RelayHub',
        channelNumber: selection.group.channelNumber,
        statusCode: upstream.status,
        ok: upstream.ok && Boolean(reply),
        latencyMs: Date.now() - attemptStartedAt,
        message: upstream.ok && reply ? 'Probe response received' : errorMessage || 'Probe did not return a text response',
        requestId
      };
      attempts.push(attempt);

      if (attempt.ok) {
        return {
          ok: true,
          status: 'healthy',
          message: 'Upstream probe succeeded',
          upstreamConfigured: true,
          key: {
            id: key.id,
            name: key.name,
            preview: key.keyPreview,
            status: key.status
          },
          probe: {
            agent,
            model: spec.model,
            upstream: 'RelayHub',
            channelNumber: selection.group.channelNumber,
            responseStatusCode: upstream.status,
            responseTimeMs: Date.now() - startedAt,
            requestId,
            promptTokenBudget: 'fixed-minimal',
            maxOutputTokens: options.maxOutputTokens
          },
          quota: quotaCheck.quota,
          quotaOk: quotaCheck.ok,
          now: new Date().toISOString()
        };
      }
    } catch (error) {
      attempts.push({
        upstream: 'RelayHub',
        channelNumber: selection.group.channelNumber,
        statusCode: null,
        ok: false,
        latencyMs: Date.now() - attemptStartedAt,
        message: error instanceof Error ? error.message : 'Probe request failed',
        requestId: null
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    status: 'upstream_unavailable',
    message: 'All upstream health probes failed',
    upstreamConfigured: true,
    key: {
      id: key.id,
      name: key.name,
      preview: key.keyPreview,
      status: key.status
    },
    probe: {
      agent,
      model: spec.model,
      responseTimeMs: Date.now() - startedAt,
      promptTokenBudget: 'fixed-minimal',
      maxOutputTokens: options.maxOutputTokens,
      attempts
    },
    quota: quotaCheck.quota,
    quotaOk: quotaCheck.ok,
    now: new Date().toISOString()
  };
}

import type { Request } from 'express';
import { assertQuota, getAccountState, hasAvailableUpstreamChannels, usageSummaryForUser } from '../store.js';
import { formatBeijingDateTime } from '../time.js';
import type { KeyWithPlan } from '../types.js';

function centsToAmount(cents: number) {
  return Number(((cents || 0) / 100).toFixed(2));
}

function formatResetAt(value: string) {
  if (!value) return value;
  return formatBeijingDateTime(value);
}

export function upstreamConfigured() {
  return hasAvailableUpstreamChannels('claude-code') || hasAvailableUpstreamChannels('codex');
}

export function buildKeyHealth(key: KeyWithPlan) {
  const quotaCheck = assertQuota(key);
  const configured = upstreamConfigured();
  const ok = configured && quotaCheck.ok;

  return {
    ok,
    status: ok ? 'healthy' : configured ? 'quota_exceeded' : 'configuration_error',
    message: ok ? 'Key is ready' : configured ? quotaCheck.message : 'No upstream channel is available',
    upstreamConfigured: configured,
    key: {
      id: key.id,
      name: key.name,
      preview: key.keyPreview,
      status: key.status
    },
    quota: quotaCheck.quota,
    now: new Date().toISOString()
  };
}

export function buildKeyBalance(key: KeyWithPlan) {
  const account = key.userId ? getAccountState(key.userId) : null;
  const unit = '$';
  const amountCents = account?.freeCreditCents ?? 0;

  return {
    ok: true,
    balance: centsToAmount(amountCents),
    amount: centsToAmount(amountCents),
    balanceCents: amountCents,
    unit,
    planName: account?.currentPlanName || key.planName,
    planExpiresAt: account?.planExpiresAt ?? null,
    keyPreview: key.keyPreview,
    now: new Date().toISOString()
  };
}

export function buildKeyUsageStatus(key: KeyWithPlan) {
  const unit = '$';
  const quota = assertQuota(key).quota;
  const summary = key.userId ? usageSummaryForUser(key.userId) : null;
  const balance = buildKeyBalance(key);

  const fiveHour = {
    used: centsToAmount(quota.fiveHourUsed),
    usedCents: quota.fiveHourUsed,
    limit: centsToAmount(quota.fiveHourLimit),
    limitCents: quota.fiveHourLimit,
    remaining: centsToAmount(quota.remainingFiveHour),
    remainingCents: quota.remainingFiveHour,
    resetAt: formatResetAt(quota.fiveHourResetAt)
  };
  const weekly = {
    used: centsToAmount(quota.weeklyUsed),
    usedCents: quota.weeklyUsed,
    limit: centsToAmount(quota.weeklyLimit),
    limitCents: quota.weeklyLimit,
    remaining: centsToAmount(quota.remainingWeekly),
    remainingCents: quota.remainingWeekly,
    resetAt: formatResetAt(quota.weeklyResetAt)
  };

  return {
    ok: true,
    health: buildKeyHealth(key),
    balance: {
      amount: balance.amount,
      amountCents: balance.balanceCents,
      unit: balance.unit
    },
    usage: {
      unit,
      today: {
        cost: centsToAmount(summary?.todayCostCents ?? 0),
        costCents: summary?.todayCostCents ?? 0,
        tokens: summary?.todayTokens ?? 0,
        requests: summary?.todayRequests ?? 0
      },
      total: {
        cost: centsToAmount(summary?.totalCostCents ?? 0),
        costCents: summary?.totalCostCents ?? 0,
        tokens: summary?.totalTokens ?? 0,
        requests: summary?.requests ?? 0
      },
      fiveHour,
      weekly
    },
    ccSwitch: [
      {
        planName: 'Account Balance',
        remaining: balance.amount,
        total: balance.amount,
        used: 0,
        unit: balance.unit
      },
      {
        planName: '5h Rolling Limit',
        remaining: fiveHour.remaining,
        total: fiveHour.limit,
        used: fiveHour.used,
        unit,
        extra: `Resets at ${fiveHour.resetAt}`
      },
      {
        planName: '7d Rolling Limit',
        remaining: weekly.remaining,
        total: weekly.limit,
        used: weekly.used,
        unit,
        extra: `Resets at ${weekly.resetAt}`
      }
    ],
    keyPreview: key.keyPreview,
    planName: balance.planName,
    now: new Date().toISOString()
  };
}

export function requestOrigin(req: Request, port: number) {
  const configuredBaseUrl = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').trim();
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '');

  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host') || `localhost:${port}`;
  return `${protocol}://${host}`;
}

export function requestAgentApiEndpoint(req: Request, port: number, agent: 'claude' | 'codex') {
  const origin = requestOrigin(req, port);
  const segment = agent === 'claude' ? 'claude-code' : 'codex';
  return `${origin}/${segment}/v1`;
}

function buildCcSwitchUsageScript() {
  return `({
  request: {
    url: "{{baseUrl}}/key/usage",
    method: "GET",
    headers: {
      "Authorization": "Bearer {{apiKey}}",
      "User-Agent": "cc-switch/1.0"
    }
  },
  extractor: function(response) {
    if (!response.ok) {
      return {
        isValid: false,
        invalidMessage: response.error || "Usage query failed"
      };
    }

    return response.ccSwitch || {
      remaining: response.balance && response.balance.amount,
      unit: response.balance && response.balance.unit
    };
  }
})`;
}

function encodeCcSwitchConfig(config: unknown) {
  return Buffer.from(JSON.stringify(config), 'utf8').toString('base64');
}

function buildCodexCcSwitchConfig(input: { endpoint: string; apiKey: string }) {
  return encodeCcSwitchConfig({
    auth: {
      OPENAI_API_KEY: input.apiKey
    },
    config: [
      'model_provider = "relayhub"',
      'model = "gpt-5.5"',
      'model_reasoning_effort = "xhigh"',
      'disable_response_storage = true',
      'preferred_auth_method = "apikey"',
      '',
      '[model_providers.relayhub]',
      'name = "relayhub"',
      `base_url = "${input.endpoint}"`,
      'wire_api = "responses"'
    ].join('\n')
  });
}

export function buildCcSwitchProviderLink(input: {
  appName: 'claude' | 'codex';
  name: string;
  endpoint: string;
  apiKey: string;
  usageAutoIntervalMinutes: number;
}) {
  const healthUrl = `${input.endpoint}/key/health`;
  const params = new URLSearchParams({
    resource: 'provider',
    app: input.appName,
    name: input.name,
    endpoint: input.endpoint,
    apiKey: input.apiKey,
    enabled: 'true',
    usageEnabled: 'true',
    usageScript: Buffer.from(buildCcSwitchUsageScript(), 'utf8').toString('base64'),
    usageApiKey: input.apiKey,
    usageBaseUrl: input.endpoint,
    usageAutoInterval: String(input.usageAutoIntervalMinutes),
    healthUrl,
    healthCheckUrl: healthUrl,
    healthApiKey: input.apiKey
  });
  if (input.appName === 'codex') {
    params.set('configFormat', 'json');
    params.set('config', buildCodexCcSwitchConfig(input));
  }
  return `ccswitch://v1/import?${params.toString()}`;
}

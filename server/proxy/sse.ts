import type { Request, Response } from 'express';
import type { UsageRates } from '../pricing.js';
import type { AgentType, AnthropicUsage, KeyWithPlan } from '../types.js';
import {
  createTextTokenEstimator,
  estimateCodexInterruptedUsage,
  extractCodexOutputDelta,
  hasUsageTokens,
  mergeStreamingUsage,
  scaleSseEvent
} from '../usage.js';
import { writeProxyLog } from './logging.js';

export async function streamSse(
  upstream: globalThis.Response,
  req: Request,
  res: Response,
  logContext: {
    key: KeyWithPlan;
    channelGroupId?: string | null;
    channelNumber?: number | null;
    model: string;
    path: string;
    method: string;
    statusCode: number;
    startedAt: number;
    requestId: string;
    agent?: AgentType;
    requestBody?: unknown;
    usageSource?: 'plan' | 'balance' | 'none';
    rates?: UsageRates;
    displayUsageMultiplier?: number;
  }
) {
  const decoder = new TextDecoder();
  const reader = upstream.body!.getReader();
  let buffered = '';
  let finalUsage: AnthropicUsage = {};
  let errorMessage: string | null = upstream.ok ? null : upstream.statusText;
  const displayUsageMultiplier = logContext.displayUsageMultiplier || 1;
  let clientClosed = false;
  const interruptedOutputEstimator = logContext.agent === 'codex' ? createTextTokenEstimator() : null;

  const markClientClosed = () => {
    clientClosed = true;
  };
  req.on('aborted', markClientClosed);
  res.on('close', markClientClosed);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkText = decoder.decode(value, { stream: true });
      buffered += chunkText;

      const events = buffered.split('\n\n');
      buffered = events.pop() || '';

      for (const eventText of events) {
        if (!clientClosed && !res.writableEnded && !res.destroyed) {
          res.write(`${scaleSseEvent(eventText, displayUsageMultiplier)}\n\n`);
        }
        const dataLines = eventText
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.replace(/^data:\s?/, ''));

        for (const dataLine of dataLines) {
          if (!dataLine || dataLine === '[DONE]') continue;
          try {
            const event = JSON.parse(dataLine);
            finalUsage = mergeStreamingUsage(finalUsage, event);
            if (interruptedOutputEstimator && !hasUsageTokens(finalUsage)) {
              const delta = extractCodexOutputDelta(event);
              if (delta) interruptedOutputEstimator.add(delta);
            }
            if (event?.type === 'error') {
              errorMessage = event?.error?.message || 'Streaming error';
            }
          } catch {
            // Ignore partial or non-JSON SSE data.
          }
        }
      }
    }
  } catch (error) {
    if (!clientClosed) {
      errorMessage = error instanceof Error ? error.message : 'Streaming request failed';
    }
  }
  if (buffered && !clientClosed && !res.writableEnded && !res.destroyed) {
    res.write(scaleSseEvent(buffered, displayUsageMultiplier));
  }

  req.off('aborted', markClientClosed);
  res.off('close', markClientClosed);
  if (!clientClosed && !res.writableEnded && !res.destroyed) res.end();
  const upstreamFailed = Boolean(errorMessage);
  const loggedStatusCode =
    upstreamFailed && logContext.statusCode >= 200 && logContext.statusCode <= 299 ? 502 : logContext.statusCode;
  const useInterruptedUsageEstimate = logContext.agent === 'codex' && clientClosed && !hasUsageTokens(finalUsage);
  const usage = useInterruptedUsageEstimate
    ? estimateCodexInterruptedUsage({
        requestBody: logContext.requestBody,
        outputTokens: interruptedOutputEstimator?.finish() || 0
      })
    : finalUsage;
  const clientClosedMessage = useInterruptedUsageEstimate
    ? 'Client disconnected; estimated Codex usage from request and streamed output'
    : 'Client disconnected; upstream drained for final usage';
  writeProxyLog({
    ...logContext,
    statusCode: loggedStatusCode,
    usage,
    usageSource: logContext.usageSource,
    usageMultiplier: logContext.displayUsageMultiplier,
    billable: !upstreamFailed,
    errorMessage: errorMessage || (clientClosed ? clientClosedMessage : null)
  });
}

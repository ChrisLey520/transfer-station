import type { Request, Response } from 'express';
import type { UsageRates } from '../pricing.js';
import type { AnthropicUsage, KeyWithPlan } from '../types.js';
import { mergeStreamingUsage, scaleSseEvent } from '../usage.js';
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
  writeProxyLog({
    ...logContext,
    statusCode: loggedStatusCode,
    usage: finalUsage,
    usageSource: logContext.usageSource,
    usageMultiplier: logContext.displayUsageMultiplier,
    billable: !upstreamFailed,
    errorMessage: errorMessage || (clientClosed ? 'Client disconnected; upstream drained for final usage' : null)
  });
}

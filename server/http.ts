import type { Request } from 'express';

export function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || '';
}

export function getClientFingerprint(req: Request) {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.ip || req.socket.remoteAddress || 'unknown';
}

export function createSlidingWindowGuard(options: { cleanupIntervalMs: number }) {
  const rateBuckets = new Map<string, number[]>();
  let maxRateBucketWindowMs = 0;

  const guard = (bucket: string, limit: number, windowMs: number) => {
    maxRateBucketWindowMs = Math.max(maxRateBucketWindowMs, windowMs);
    return (req: Request, res: import('express').Response, next: import('express').NextFunction) => {
      const now = Date.now();
      const key = `${bucket}:${getClientFingerprint(req)}`;
      const hits = (rateBuckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
      if (hits.length >= limit) {
        rateBuckets.set(key, hits);
        res.status(429).json({ error: '请求过于频繁，请稍后再试。' });
        return;
      }
      hits.push(now);
      rateBuckets.set(key, hits);
      next();
    };
  };

  setInterval(() => {
    const now = Date.now();
    const maxWindowMs = maxRateBucketWindowMs || 10 * 60_000;
    for (const [key, hits] of rateBuckets.entries()) {
      const activeHits = hits.filter((timestamp) => now - timestamp < maxWindowMs);
      if (activeHits.length) {
        rateBuckets.set(key, activeHits);
      } else {
        rateBuckets.delete(key);
      }
    }
  }, options.cleanupIntervalMs).unref();

  return guard;
}

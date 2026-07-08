import type { NextFunction, Request, Response } from 'express';
import { getFirstAdminUser, getKeyByRawKey, getUserBySessionToken } from './store.js';
import type { KeyWithPlan, User } from './types.js';
import { routeParam } from './http.js';

export function getBearerToken(req: Request) {
  return req.header('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
}

export function adminGuard(req: Request, res: Response, next: NextFunction) {
  const bearerToken = getBearerToken(req);
  const sessionUser = bearerToken ? getUserBySessionToken(bearerToken) : null;
  const adminToken = process.env.ADMIN_TOKEN?.trim();
  const suppliedAdminToken = req.header('x-admin-token') || (sessionUser ? '' : bearerToken);

  if (adminToken && suppliedAdminToken === adminToken) {
    const adminUser = getFirstAdminUser();
    if (!adminUser) {
      res.status(401).json({ error: '未配置管理员用户。' });
      return;
    }
    res.locals.adminUser = adminUser;
    next();
    return;
  }

  if (sessionUser?.role === 'admin') {
    res.locals.adminUser = sessionUser;
    next();
    return;
  }

  res.status(sessionUser ? 403 : 401).json({ error: '需要管理员身份。' });
}

export function authUser(req: Request, res: Response): User | null {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: '请先登录。' });
    return null;
  }

  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: '登录已过期，请重新登录。' });
    return null;
  }

  return user;
}

export function getClientKey(req: Request, options: { allowQuery?: boolean } = {}) {
  const authorization = req.header('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  const headerKey = req.header('x-api-key');
  if (headerKey) return headerKey;

  if (options.allowQuery) {
    const queryKey = routeParam(req.query.apiKey as string | string[] | undefined)
      || routeParam(req.query.api_key as string | string[] | undefined)
      || routeParam(req.query.key as string | string[] | undefined);
    if (queryKey) return queryKey;
  }

  return '';
}

export function authProxyKey(req: Request, res: Response): KeyWithPlan | null {
  const rawKey = getClientKey(req);
  if (!rawKey) {
    res.status(401).json({ type: 'error', error: { type: 'authentication_error', message: 'API key is required' } });
    return null;
  }

  const key = getKeyByRawKey(rawKey);
  if (!key) {
    res.status(401).json({ type: 'error', error: { type: 'authentication_error', message: 'Invalid API key' } });
    return null;
  }

  if (key.userStatus === 'banned') {
    res.status(403).json({ type: 'error', error: { type: 'permission_error', message: '该用户已被封禁。' } });
    return null;
  }

  if (key.status !== 'active') {
    res.status(403).json({ type: 'error', error: { type: 'permission_error', message: `API key is ${key.status}` } });
    return null;
  }

  return key;
}

export function authStatusKey(req: Request, res: Response, options: { allowQuery?: boolean } = {}): KeyWithPlan | null {
  const rawKey = getClientKey(req, options);
  if (!rawKey) {
    res.status(401).json({ ok: false, error: 'API key is required' });
    return null;
  }

  const key = getKeyByRawKey(rawKey);
  if (!key) {
    res.status(401).json({ ok: false, error: 'Invalid API key' });
    return null;
  }

  if (key.userStatus === 'banned') {
    res.status(403).json({ ok: false, error: '该用户已被封禁。', status: key.userStatus });
    return null;
  }

  if (key.status !== 'active') {
    res.status(403).json({ ok: false, error: `API key is ${key.status}`, status: key.status });
    return null;
  }

  return key;
}

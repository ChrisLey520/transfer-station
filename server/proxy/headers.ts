import type { Request } from 'express';
import type { UpstreamSelection } from '../types.js';

export function routeToUpstreamPath(req: Request) {
  const pathValue = req.originalUrl;
  if (pathValue.startsWith('/claude-code/v1')) return `/v1${pathValue.slice('/claude-code/v1'.length)}`;
  if (pathValue.startsWith('/codex/v1')) return `/v1${pathValue.slice('/codex/v1'.length)}`;
  return '/v1';
}

export function buildUpstreamHeaders(req: Request | null, selection: UpstreamSelection, anthropicVersion: string) {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  if (selection.agent === 'claude-code') {
    headers.set('x-api-key', selection.rawKey);
    headers.set('anthropic-version', req?.header('anthropic-version') || anthropicVersion);
    const betaHeader = req?.header('anthropic-beta');
    if (betaHeader) headers.set('anthropic-beta', betaHeader);
    return headers;
  }

  headers.set('authorization', `Bearer ${selection.rawKey}`);
  const openAiOrg = req?.header('openai-organization');
  const openAiProject = req?.header('openai-project');
  if (openAiOrg) headers.set('openai-organization', openAiOrg);
  if (openAiProject) headers.set('openai-project', openAiProject);
  return headers;
}

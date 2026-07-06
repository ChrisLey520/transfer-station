import type { Announcement, Bootstrap } from '../../types.js';
import { readJsonResponse, responseErrorMessage } from '../../utils/api.js';

export async function fetchBootstrap(headers: HeadersInit, requestFailed: string) {
  const response = await fetch('/api/bootstrap', { headers });
  if (response.status === 401) {
    return { unauthorized: true as const, bootstrap: null };
  }
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(responseErrorMessage(response, payload, requestFailed));
  }
  return { unauthorized: false as const, bootstrap: payload as Bootstrap };
}

export async function dismissAnnouncementRequest(action: 'close' | 'closeToday', headers: HeadersInit, requestFailed: string) {
  const response = await fetch('/api/announcement/dismiss', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action })
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(responseErrorMessage(response, payload, requestFailed));
  }
  return (payload as { announcement: Announcement | null }).announcement;
}

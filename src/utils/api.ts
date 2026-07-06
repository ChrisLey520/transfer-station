export function extractErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  if (typeof record.detail === 'string') return record.detail;
  if (typeof record.details === 'string') return record.details;

  if (record.error) {
    const nested = extractErrorMessage(record.error);
    if (nested) return nested;
  }

  if (record.detail) {
    const nested = extractErrorMessage(record.detail);
    if (nested) return nested;
  }

  if (record.details) {
    const nested = extractErrorMessage(record.details);
    if (nested) return nested;
  }

  if (typeof record.invalidMessage === 'string') return record.invalidMessage;

  if (Array.isArray(record.errors)) {
    const messages = record.errors
      .map((entry) => extractErrorMessage(entry))
      .filter((entry) => entry.length > 0);
    if (messages.length > 0) return messages.join(' ');
  }

  const fieldErrors = record.fieldErrors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const messages = Object.values(fieldErrors as Record<string, unknown>)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    if (messages.length > 0) return messages.join(' ');
  }

  const formErrors = record.formErrors;
  if (Array.isArray(formErrors)) {
    const messages = formErrors.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    if (messages.length > 0) return messages.join(' ');
  }

  return '';
}

export async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export function responseErrorMessage(response: Response, payload: unknown, fallback: string) {
  const message = extractErrorMessage(payload) || response.statusText || fallback;
  const statusText = response.statusText ? ` ${response.statusText}` : '';
  return `${message} (${response.status}${statusText})`;
}

export function unknownErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

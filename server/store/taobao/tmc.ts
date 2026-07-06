import { db, nowIso } from '../../db.js';

export function recordTaobaoTmcMessage(input: { id: string; topic?: string; content?: string; status?: string; errorMessage?: string | null }) {
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO taobao_tmc_messages (
      id,
      topic,
      content,
      status,
      error_message,
      received_at,
      processed_at
    )
    VALUES (
      @id,
      @topic,
      @content,
      @status,
      @errorMessage,
      @receivedAt,
      @processedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      error_message = excluded.error_message,
      processed_at = excluded.processed_at
  `
  ).run({
    id: input.id,
    topic: input.topic || '',
    content: input.content || '',
    status: input.status || 'received',
    errorMessage: input.errorMessage || null,
    receivedAt: timestamp,
    processedAt: input.status && input.status !== 'received' ? timestamp : null
  });
}

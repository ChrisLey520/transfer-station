import { db, mapTaobaoShop, nowIso } from '../../db.js';
import type { TaobaoShop } from '../../types.js';
import { normalizeTaobaoId } from './shared.js';

export function listTaobaoShops(): TaobaoShop[] {
  return db.prepare('SELECT * FROM taobao_shops ORDER BY updated_at DESC').all().map((row) => mapTaobaoShop(row) as TaobaoShop);
}

export function saveTaobaoShop(input: {
  id: string;
  nick?: string;
  sessionCiphertext: string;
  sessionExpiresAt?: string | null;
  messagePermittedAt?: string | null;
}) {
  const timestamp = nowIso();
  db.prepare(
    `
    INSERT INTO taobao_shops (
      id,
      nick,
      session_ciphertext,
      session_expires_at,
      message_permitted_at,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @nick,
      @sessionCiphertext,
      @sessionExpiresAt,
      @messagePermittedAt,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      nick = excluded.nick,
      session_ciphertext = excluded.session_ciphertext,
      session_expires_at = excluded.session_expires_at,
      message_permitted_at = COALESCE(excluded.message_permitted_at, taobao_shops.message_permitted_at),
      updated_at = excluded.updated_at
  `
  ).run({
    id: normalizeTaobaoId(input.id),
    nick: input.nick || '',
    sessionCiphertext: input.sessionCiphertext,
    sessionExpiresAt: input.sessionExpiresAt || null,
    messagePermittedAt: input.messagePermittedAt || null,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  return getTaobaoShop(input.id);
}

export function markTaobaoShopMessagePermitted(shopId: string) {
  const timestamp = nowIso();
  db.prepare('UPDATE taobao_shops SET message_permitted_at = ?, updated_at = ? WHERE id = ?').run(
    timestamp,
    timestamp,
    normalizeTaobaoId(shopId)
  );
  return getTaobaoShop(shopId);
}

export function getTaobaoShop(shopId: string): TaobaoShop | null {
  const row = db.prepare('SELECT * FROM taobao_shops WHERE id = ?').get(normalizeTaobaoId(shopId));
  return row ? (mapTaobaoShop(row) as TaobaoShop) : null;
}

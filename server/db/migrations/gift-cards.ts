import { db } from '../connection.js';
import { tableColumns } from './shared.js';

export function ensureGiftCardOwnerColumn() {
  const columns = tableColumns('gift_cards');

  if (!columns.has('redeemed_by_user_id')) {
    db.exec('ALTER TABLE gift_cards ADD COLUMN redeemed_by_user_id TEXT');
  }

  if (!columns.has('created_by_user_id')) {
    db.exec('ALTER TABLE gift_cards ADD COLUMN created_by_user_id TEXT');
  }

  if (!columns.has('revoked_at')) {
    db.exec('ALTER TABLE gift_cards ADD COLUMN revoked_at TEXT');
  }

  if (!columns.has('revoked_by_user_id')) {
    db.exec('ALTER TABLE gift_cards ADD COLUMN revoked_by_user_id TEXT');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_gift_cards_revoked_at ON gift_cards(revoked_at)');
}

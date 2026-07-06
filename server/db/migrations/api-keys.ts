import { db } from '../connection.js';
import { tableColumns } from './shared.js';

export function ensureApiKeySecretColumns() {
  const columns = tableColumns('api_keys');

  if (!columns.has('key_ciphertext')) {
    db.exec('ALTER TABLE api_keys ADD COLUMN key_ciphertext TEXT');
  }
}

export function ensureApiKeyOwnerColumn() {
  const columns = tableColumns('api_keys');

  if (!columns.has('user_id')) {
    db.exec('ALTER TABLE api_keys ADD COLUMN user_id TEXT');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)');
}

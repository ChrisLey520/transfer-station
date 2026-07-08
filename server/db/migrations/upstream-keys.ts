import { db } from '../connection.js';
import { tableColumns, tableSql } from './shared.js';

export function ensureUpstreamKeyColumns() {
  const columns = tableColumns('upstream_channel_keys');

  if (!columns.has('expires_at')) {
    db.exec('ALTER TABLE upstream_channel_keys ADD COLUMN expires_at TEXT');
  }

  if (!columns.has('name')) {
    db.exec("ALTER TABLE upstream_channel_keys ADD COLUMN name TEXT NOT NULL DEFAULT ''");
  }

  if (!columns.has('sort_order')) {
    db.exec('ALTER TABLE upstream_channel_keys ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 100');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_upstream_keys_selection ON upstream_channel_keys(channel_group_id, agent_type, status, expires_at, sort_order, created_at)');
}

export function ensureUpstreamKeyStatusConstraint() {
  const table = tableSql('upstream_channel_keys');

  if (!table?.sql || table.sql.includes("'banned'")) {
    return;
  }

  const migrate = db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS upstream_channel_keys_status_migration;

      CREATE TABLE upstream_channel_keys_status_migration (
        id TEXT PRIMARY KEY,
        channel_group_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        agent_type TEXT NOT NULL DEFAULT 'shared' CHECK (agent_type IN ('shared', 'claude-code', 'codex')),
        key_hash TEXT NOT NULL,
        key_preview TEXT NOT NULL,
        key_ciphertext TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked', 'banned')),
        sort_order INTEGER NOT NULL DEFAULT 100,
        expires_at TEXT,
        exhausted_until TEXT,
        failure_reason TEXT,
        failure_status_code INTEGER,
        last_used_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(channel_group_id, key_hash),
        FOREIGN KEY (channel_group_id) REFERENCES upstream_channel_groups(id) ON DELETE CASCADE
      );

      INSERT INTO upstream_channel_keys_status_migration (
        id,
        channel_group_id,
        name,
        agent_type,
        key_hash,
        key_preview,
        key_ciphertext,
        status,
        sort_order,
        expires_at,
        exhausted_until,
        failure_reason,
        failure_status_code,
        last_used_at,
        created_at,
        updated_at
      )
      SELECT
        id,
        channel_group_id,
        name,
        agent_type,
        key_hash,
        key_preview,
        key_ciphertext,
        status,
        sort_order,
        expires_at,
        exhausted_until,
        failure_reason,
        failure_status_code,
        last_used_at,
        created_at,
        updated_at
      FROM upstream_channel_keys;

      DROP TABLE upstream_channel_keys;
      ALTER TABLE upstream_channel_keys_status_migration RENAME TO upstream_channel_keys;
      CREATE INDEX IF NOT EXISTS idx_upstream_keys_group_agent_status ON upstream_channel_keys(channel_group_id, agent_type, status);
      CREATE INDEX IF NOT EXISTS idx_upstream_keys_selection ON upstream_channel_keys(channel_group_id, agent_type, status, expires_at, sort_order, created_at);
    `);
  });

  migrate();
}

export function ensureUpstreamKeyScopedUniqueness() {
  const table = tableSql('upstream_channel_keys');

  if (!table?.sql || table.sql.includes('UNIQUE(channel_group_id, key_hash)')) {
    return;
  }

  const migrate = db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS upstream_channel_keys_scope_migration;

      CREATE TABLE upstream_channel_keys_scope_migration (
        id TEXT PRIMARY KEY,
        channel_group_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        agent_type TEXT NOT NULL DEFAULT 'shared' CHECK (agent_type IN ('shared', 'claude-code', 'codex')),
        key_hash TEXT NOT NULL,
        key_preview TEXT NOT NULL,
        key_ciphertext TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked', 'banned')),
        sort_order INTEGER NOT NULL DEFAULT 100,
        expires_at TEXT,
        exhausted_until TEXT,
        failure_reason TEXT,
        failure_status_code INTEGER,
        last_used_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(channel_group_id, key_hash),
        FOREIGN KEY (channel_group_id) REFERENCES upstream_channel_groups(id) ON DELETE CASCADE
      );

      INSERT INTO upstream_channel_keys_scope_migration (
        id,
        channel_group_id,
        name,
        agent_type,
        key_hash,
        key_preview,
        key_ciphertext,
        status,
        sort_order,
        expires_at,
        exhausted_until,
        failure_reason,
        failure_status_code,
        last_used_at,
        created_at,
        updated_at
      )
      SELECT
        id,
        channel_group_id,
        name,
        agent_type,
        key_hash,
        key_preview,
        key_ciphertext,
        status,
        sort_order,
        expires_at,
        exhausted_until,
        failure_reason,
        failure_status_code,
        last_used_at,
        created_at,
        updated_at
      FROM upstream_channel_keys;

      DROP TABLE upstream_channel_keys;
      ALTER TABLE upstream_channel_keys_scope_migration RENAME TO upstream_channel_keys;
      CREATE INDEX IF NOT EXISTS idx_upstream_keys_group_agent_status ON upstream_channel_keys(channel_group_id, agent_type, status);
      CREATE INDEX IF NOT EXISTS idx_upstream_keys_selection ON upstream_channel_keys(channel_group_id, agent_type, status, expires_at, sort_order, created_at);
    `);
  });

  migrate();
}

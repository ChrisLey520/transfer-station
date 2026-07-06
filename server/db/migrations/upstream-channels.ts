import { db } from '../connection.js';
import { tableColumns, tableSql } from './shared.js';

export function ensureUpstreamChannelColumns() {
  const columns = tableColumns('upstream_channel_groups');

  if (!columns.has('website_url')) {
    db.exec("ALTER TABLE upstream_channel_groups ADD COLUMN website_url TEXT NOT NULL DEFAULT ''");
  }

  if (!columns.has('server_error_recovery_minutes')) {
    db.exec('ALTER TABLE upstream_channel_groups ADD COLUMN server_error_recovery_minutes INTEGER NOT NULL DEFAULT 10');
  }

  if (!columns.has('display_usage_multiplier')) {
    db.exec('ALTER TABLE upstream_channel_groups ADD COLUMN display_usage_multiplier REAL NOT NULL DEFAULT 2');
  }
}

export function ensureUpstreamChannelStatusConstraint() {
  const table = tableSql('upstream_channel_groups');

  if (!table?.sql || table.sql.includes("'banned'")) {
    return;
  }

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    const migrate = db.transaction(() => {
      db.exec(`
        DROP TABLE IF EXISTS upstream_channel_groups_status_migration;

        CREATE TABLE upstream_channel_groups_status_migration (
          id TEXT PRIMARY KEY,
          channel_number INTEGER,
          name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'banned')),
          claude_api_url TEXT NOT NULL DEFAULT '',
          codex_api_url TEXT NOT NULL DEFAULT '',
          use_independent_agent_keys INTEGER NOT NULL DEFAULT 0,
          input_rate_per_million REAL NOT NULL DEFAULT 3,
          output_rate_per_million REAL NOT NULL DEFAULT 15,
          cache_creation_rate_per_million REAL NOT NULL DEFAULT 3.75,
          cache_read_rate_per_million REAL NOT NULL DEFAULT 0.3,
          server_error_recovery_minutes INTEGER NOT NULL DEFAULT 10,
          display_usage_multiplier REAL NOT NULL DEFAULT 2,
          sort_order INTEGER NOT NULL DEFAULT 100,
          degraded_until TEXT,
          degraded_reason TEXT,
          degraded_status_code INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT INTO upstream_channel_groups_status_migration (
          id,
          channel_number,
          name,
          status,
          claude_api_url,
          codex_api_url,
          use_independent_agent_keys,
          input_rate_per_million,
          output_rate_per_million,
          cache_creation_rate_per_million,
          cache_read_rate_per_million,
          server_error_recovery_minutes,
          display_usage_multiplier,
          sort_order,
          degraded_until,
          degraded_reason,
          degraded_status_code,
          created_at,
          updated_at
        )
        SELECT
          id,
          channel_number,
          name,
          status,
          claude_api_url,
          codex_api_url,
          use_independent_agent_keys,
          input_rate_per_million,
          output_rate_per_million,
          cache_creation_rate_per_million,
          cache_read_rate_per_million,
          server_error_recovery_minutes,
          display_usage_multiplier,
          sort_order,
          degraded_until,
          degraded_reason,
          degraded_status_code,
          created_at,
          updated_at
        FROM upstream_channel_groups;

        DROP TABLE upstream_channel_groups;
        ALTER TABLE upstream_channel_groups_status_migration RENAME TO upstream_channel_groups;
        CREATE INDEX IF NOT EXISTS idx_upstream_groups_status_order ON upstream_channel_groups(status, sort_order);
      `);
    });

    migrate();
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

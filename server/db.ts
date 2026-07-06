import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const databasePath = process.env.DATABASE_PATH ?? './data/transfer-station.sqlite';
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

class SqliteDatabase {
  private readonly database: DatabaseSync;

  constructor(filename: string) {
    this.database = new DatabaseSync(filename);
  }

  exec(sql: string) {
    return this.database.exec(sql);
  }

  prepare(sql: string) {
    const statement = this.database.prepare(sql);
    statement.setAllowUnknownNamedParameters(true);
    return statement;
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: Parameters<T>) => {
      this.database.exec('BEGIN');
      try {
        const result = fn(...args);
        this.database.exec('COMMIT');
        return result;
      } catch (error) {
        this.database.exec('ROLLBACK');
        throw error;
      }
    }) as T;
  }
}

export const db = new SqliteDatabase(databasePath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function nowIso() {
  return new Date().toISOString();
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_announcement_states (
      user_id TEXT NOT NULL,
      announcement_id TEXT NOT NULL,
      closed_at TEXT,
      closed_for_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, announcement_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      five_hour_token_limit INTEGER NOT NULL,
      weekly_token_limit INTEGER NOT NULL,
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_preview TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'revoked')),
      owner_email TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      api_key_id TEXT,
      channel_group_id TEXT,
      channel_number INTEGER,
      usage_source TEXT NOT NULL DEFAULT 'plan' CHECK (usage_source IN ('plan', 'balance', 'none')),
      model TEXT NOT NULL DEFAULT 'unknown',
      path TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      request_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
    );

    CREATE TABLE IF NOT EXISTS account_state (
      id TEXT PRIMARY KEY,
      free_credit_cents INTEGER NOT NULL DEFAULT 26840,
      current_plan_id TEXT,
      current_plan_name TEXT,
      current_plan_rank INTEGER NOT NULL DEFAULT 0,
      plan_expires_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gift_cards (
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('credit', 'plan')),
      amount_cents INTEGER NOT NULL DEFAULT 0,
      plan_id TEXT,
      plan_name TEXT,
      five_hour_token_limit INTEGER NOT NULL DEFAULT 0,
      weekly_token_limit INTEGER NOT NULL DEFAULT 0,
      plan_rank INTEGER NOT NULL DEFAULT 0,
      duration_months INTEGER NOT NULL DEFAULT 1,
      redeemed_at TEXT,
      revoked_at TEXT,
      created_by_user_id TEXT,
      redeemed_by_user_id TEXT,
      revoked_by_user_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_links (
      item_type TEXT NOT NULL CHECK (item_type IN ('plan', 'credit')),
      item_id TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('taobao', 'xianyu')),
      url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (item_type, item_id, channel)
    );

    CREATE TABLE IF NOT EXISTS taobao_shops (
      id TEXT PRIMARY KEY,
      nick TEXT NOT NULL DEFAULT '',
      session_ciphertext TEXT NOT NULL,
      session_expires_at TEXT,
      message_permitted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS taobao_product_mappings (
      id TEXT PRIMARY KEY,
      num_iid TEXT NOT NULL,
      sku_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      gift_type TEXT NOT NULL CHECK (gift_type IN ('credit', 'plan')),
      amount_cents INTEGER NOT NULL DEFAULT 0,
      plan_id TEXT,
      duration_months INTEGER NOT NULL DEFAULT 1,
      quantity INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(num_iid, sku_id)
    );

    CREATE TABLE IF NOT EXISTS platform_orders (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL CHECK (platform IN ('taobao', 'xianyu')),
      shop_id TEXT,
      order_id TEXT NOT NULL,
      sub_order_id TEXT NOT NULL DEFAULT '',
      buyer_nick TEXT NOT NULL DEFAULT '',
      item_id TEXT NOT NULL DEFAULT '',
      sku_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      gift_card_code TEXT,
      delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'ready', 'claimed', 'skipped', 'failed')),
      delivery_message TEXT,
      claimed_at TEXT,
      claimed_by_user_id TEXT,
      last_event_at TEXT,
      raw_payload TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(platform, order_id, sub_order_id)
    );

    CREATE TABLE IF NOT EXISTS taobao_tmc_messages (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'received',
      error_message TEXT,
      received_at TEXT NOT NULL,
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS upstream_channel_groups (
      id TEXT PRIMARY KEY,
      channel_number INTEGER,
      name TEXT NOT NULL,
      website_url TEXT NOT NULL DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS upstream_channel_keys (
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

    CREATE TABLE IF NOT EXISTS upstream_model_rates (
      id TEXT PRIMARY KEY,
      channel_group_id TEXT NOT NULL,
      agent_type TEXT NOT NULL CHECK (agent_type IN ('claude-code', 'codex')),
      model TEXT NOT NULL,
      input_rate_per_million REAL NOT NULL DEFAULT 0,
      output_rate_per_million REAL NOT NULL DEFAULT 0,
      cache_creation_rate_per_million REAL NOT NULL DEFAULT 0,
      cache_read_rate_per_million REAL NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(channel_group_id, agent_type, model),
      FOREIGN KEY (channel_group_id) REFERENCES upstream_channel_groups(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_usage_api_key_created_at ON usage_logs(api_key_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_quota_window ON usage_logs(api_key_id, usage_source, created_at, status_code);
    CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_gift_cards_redeemed_at ON gift_cards(redeemed_at);
    CREATE INDEX IF NOT EXISTS idx_product_links_item ON product_links(item_type, item_id);
    CREATE INDEX IF NOT EXISTS idx_taobao_product_mappings_item ON taobao_product_mappings(num_iid, sku_id);
    CREATE INDEX IF NOT EXISTS idx_platform_orders_lookup ON platform_orders(platform, order_id);
    CREATE INDEX IF NOT EXISTS idx_platform_orders_gift_card ON platform_orders(gift_card_code);
    CREATE INDEX IF NOT EXISTS idx_upstream_groups_status_order ON upstream_channel_groups(status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_upstream_keys_group_agent_status ON upstream_channel_keys(channel_group_id, agent_type, status);
    CREATE INDEX IF NOT EXISTS idx_upstream_model_rates_group_agent ON upstream_model_rates(channel_group_id, agent_type, model);
  `);

  ensureUsageLogMoneyColumns();
  ensureUserRoleColumn();
  ensureAnnouncementTablesShape();
  ensureApiKeySecretColumns();
  ensureApiKeyOwnerColumn();
  ensureGiftCardOwnerColumn();
  ensureTaobaoIntegrationTables();
  ensurePlatformOrderClaimColumns();
  ensureUpstreamChannelColumns();
  ensureUpstreamKeyColumns();
  ensureUpstreamKeyStatusConstraint();
  ensureUpstreamKeyScopedUniqueness();
  ensureChannelNumberColumns();
  ensureUpstreamChannelStatusConstraint();
}

function ensureChannelNumberColumns() {
  const groupColumns = new Set(
    (db.prepare('PRAGMA table_info(upstream_channel_groups)').all() as Array<{ name: string }>).map((column) => column.name)
  );
  if (!groupColumns.has('channel_number')) {
    db.exec('ALTER TABLE upstream_channel_groups ADD COLUMN channel_number INTEGER');
  }

  const logColumns = new Set(
    (db.prepare('PRAGMA table_info(usage_logs)').all() as Array<{ name: string }>).map((column) => column.name)
  );
  if (!logColumns.has('channel_group_id')) {
    db.exec('ALTER TABLE usage_logs ADD COLUMN channel_group_id TEXT');
  }
  if (!logColumns.has('channel_number')) {
    db.exec('ALTER TABLE usage_logs ADD COLUMN channel_number INTEGER');
  }

  const groups = db.prepare('SELECT id, created_at FROM upstream_channel_groups ORDER BY created_at ASC, id ASC').all() as Array<{ id: string }>;
  groups.forEach((group, index) => {
    db.prepare('UPDATE upstream_channel_groups SET channel_number = COALESCE(channel_number, ?) WHERE id = ?').run(index + 1, group.id);
  });

  db.exec(`
    UPDATE usage_logs
    SET channel_number = (
      SELECT upstream_channel_groups.channel_number
      FROM upstream_channel_groups
      WHERE upstream_channel_groups.id = usage_logs.channel_group_id
    )
    WHERE channel_group_id IS NOT NULL AND channel_number IS NULL
  `);
}

function ensureAnnouncementTablesShape() {
  const announcementColumns = new Set(
    (db.prepare('PRAGMA table_info(announcements)').all() as Array<{ name: string }>).map((column) => column.name)
  );
  const stateColumns = new Set(
    (db.prepare('PRAGMA table_info(user_announcement_states)').all() as Array<{ name: string }>).map((column) => column.name)
  );

  if (!announcementColumns.has('version') && !stateColumns.has('announcement_version')) {
    return;
  }

  const latestAnnouncement = db
    .prepare('SELECT id, content, published_at, created_at, updated_at FROM announcements ORDER BY updated_at DESC LIMIT 1')
    .get() as
    | {
        id: string;
        content: string;
        published_at: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  const latestStates = latestAnnouncement
    ? (db
        .prepare(
          `
          SELECT user_id, announcement_id, closed_at, closed_for_date, created_at, updated_at
          FROM user_announcement_states
          WHERE announcement_id = ?
        `
        )
        .all(latestAnnouncement.id) as Array<{
        user_id: string;
        announcement_id: string;
        closed_at: string | null;
        closed_for_date: string | null;
        created_at: string;
        updated_at: string;
      }>)
    : [];

  const tx = db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS user_announcement_states;
      DROP TABLE IF EXISTS announcements;

      CREATE TABLE announcements (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL DEFAULT '',
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE user_announcement_states (
        user_id TEXT NOT NULL,
        announcement_id TEXT NOT NULL,
        closed_at TEXT,
        closed_for_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, announcement_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
      );
    `);

    if (!latestAnnouncement) return;

    db.prepare(
      `
      INSERT INTO announcements (id, content, published_at, created_at, updated_at)
      VALUES (@id, @content, @publishedAt, @createdAt, @updatedAt)
    `
    ).run({
      id: latestAnnouncement.id,
      content: latestAnnouncement.content,
      publishedAt: latestAnnouncement.published_at,
      createdAt: latestAnnouncement.created_at,
      updatedAt: latestAnnouncement.updated_at
    });

    const insertState = db.prepare(
      `
      INSERT INTO user_announcement_states (
        user_id,
        announcement_id,
        closed_at,
        closed_for_date,
        created_at,
        updated_at
      )
      VALUES (
        @userId,
        @announcementId,
        @closedAt,
        @closedForDate,
        @createdAt,
        @updatedAt
      )
    `
    );

    for (const state of latestStates) {
      insertState.run({
        userId: state.user_id,
        announcementId: state.announcement_id,
        closedAt: state.closed_at,
        closedForDate: state.closed_for_date,
        createdAt: state.created_at,
        updatedAt: state.updated_at
      });
    }
  });

  tx();
}

function ensureUserRoleColumn() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((column) => column.name)
  );

  if (!columns.has('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member'))");
  }

  db.exec("UPDATE users SET role = 'member' WHERE role IS NULL OR role NOT IN ('admin', 'member')");
}

function ensureApiKeySecretColumns() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(api_keys)').all() as Array<{ name: string }>).map((column) => column.name)
  );

  if (!columns.has('key_ciphertext')) {
    db.exec('ALTER TABLE api_keys ADD COLUMN key_ciphertext TEXT');
  }
}

function ensureApiKeyOwnerColumn() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(api_keys)').all() as Array<{ name: string }>).map((column) => column.name)
  );

  if (!columns.has('user_id')) {
    db.exec('ALTER TABLE api_keys ADD COLUMN user_id TEXT');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)');
}

function ensureGiftCardOwnerColumn() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(gift_cards)').all() as Array<{ name: string }>).map((column) => column.name)
  );

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

function ensureTaobaoIntegrationTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS taobao_shops (
      id TEXT PRIMARY KEY,
      nick TEXT NOT NULL DEFAULT '',
      session_ciphertext TEXT NOT NULL,
      session_expires_at TEXT,
      message_permitted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS taobao_product_mappings (
      id TEXT PRIMARY KEY,
      num_iid TEXT NOT NULL,
      sku_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      gift_type TEXT NOT NULL CHECK (gift_type IN ('credit', 'plan')),
      amount_cents INTEGER NOT NULL DEFAULT 0,
      plan_id TEXT,
      duration_months INTEGER NOT NULL DEFAULT 1,
      quantity INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(num_iid, sku_id)
    );

    CREATE TABLE IF NOT EXISTS platform_orders (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL CHECK (platform IN ('taobao', 'xianyu')),
      shop_id TEXT,
      order_id TEXT NOT NULL,
      sub_order_id TEXT NOT NULL DEFAULT '',
      buyer_nick TEXT NOT NULL DEFAULT '',
      item_id TEXT NOT NULL DEFAULT '',
      sku_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      gift_card_code TEXT,
      delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'ready', 'claimed', 'skipped', 'failed')),
      delivery_message TEXT,
      claimed_at TEXT,
      claimed_by_user_id TEXT,
      last_event_at TEXT,
      raw_payload TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(platform, order_id, sub_order_id)
    );

    CREATE TABLE IF NOT EXISTS taobao_tmc_messages (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'received',
      error_message TEXT,
      received_at TEXT NOT NULL,
      processed_at TEXT
    );
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_taobao_product_mappings_item ON taobao_product_mappings(num_iid, sku_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_platform_orders_lookup ON platform_orders(platform, order_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_platform_orders_gift_card ON platform_orders(gift_card_code)');
}

function ensurePlatformOrderClaimColumns() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(platform_orders)').all() as Array<{ name: string }>).map((column) => column.name)
  );

  if (!columns.has('claimed_by_user_id')) {
    db.exec('ALTER TABLE platform_orders ADD COLUMN claimed_by_user_id TEXT');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_platform_orders_claimed_by ON platform_orders(claimed_by_user_id, claimed_at)');
}

function ensureUsageLogMoneyColumns() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(usage_logs)').all() as Array<{ name: string }>).map((column) => column.name)
  );

  const additions = [
    ['cache_creation_input_tokens', 'INTEGER NOT NULL DEFAULT 0'],
    ['cache_read_input_tokens', 'INTEGER NOT NULL DEFAULT 0'],
    ['usage_source', "TEXT NOT NULL DEFAULT 'plan' CHECK (usage_source IN ('plan', 'balance', 'none'))"],
    ['input_cost_cents', 'INTEGER NOT NULL DEFAULT 0'],
    ['output_cost_cents', 'INTEGER NOT NULL DEFAULT 0'],
    ['cache_creation_cost_cents', 'INTEGER NOT NULL DEFAULT 0'],
    ['cache_read_cost_cents', 'INTEGER NOT NULL DEFAULT 0'],
    ['total_cost_cents', 'INTEGER NOT NULL DEFAULT 0']
  ];

  for (const [name, definition] of additions) {
    if (!columns.has(name)) {
      db.exec(`ALTER TABLE usage_logs ADD COLUMN ${name} ${definition}`);
    }
  }
}

function ensureUpstreamChannelColumns() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(upstream_channel_groups)').all() as Array<{ name: string }>).map((column) => column.name)
  );

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

function ensureUpstreamKeyColumns() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(upstream_channel_keys)').all() as Array<{ name: string }>).map((column) => column.name)
  );

  if (!columns.has('expires_at')) {
    db.exec('ALTER TABLE upstream_channel_keys ADD COLUMN expires_at TEXT');
  }

  if (!columns.has('name')) {
    db.exec("ALTER TABLE upstream_channel_keys ADD COLUMN name TEXT NOT NULL DEFAULT ''");
  }
}

function ensureUpstreamChannelStatusConstraint() {
  const table = db.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'upstream_channel_groups'").get() as
    | { sql: string | null }
    | undefined;

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

function ensureUpstreamKeyStatusConstraint() {
  const table = db.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'upstream_channel_keys'").get() as
    | { sql: string | null }
    | undefined;

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
    `);
  });

  migrate();
}

function ensureUpstreamKeyScopedUniqueness() {
  const table = db.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'upstream_channel_keys'").get() as
    | { sql: string | null }
    | undefined;

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
    `);
  });

  migrate();
}

export function mapPlan(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fiveHourTokenLimit: row.five_hour_token_limit,
    weeklyTokenLimit: row.weekly_token_limit,
    priceCents: row.price_cents,
    currency: row.currency,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapProductLink(row: any) {
  return {
    itemType: row.item_type,
    itemId: row.item_id,
    channel: row.channel,
    url: row.url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapTaobaoShop(row: any) {
  return {
    id: row.id,
    nick: row.nick,
    sessionCiphertext: row.session_ciphertext,
    sessionExpiresAt: row.session_expires_at ?? null,
    messagePermittedAt: row.message_permitted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapTaobaoProductMapping(row: any) {
  return {
    id: row.id,
    numIid: row.num_iid,
    skuId: row.sku_id ?? null,
    title: row.title,
    giftType: row.gift_type,
    amountCents: row.amount_cents,
    planId: row.plan_id ?? null,
    durationMonths: row.duration_months,
    quantity: row.quantity,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapPlatformOrder(row: any) {
  return {
    id: row.id,
    platform: row.platform,
    shopId: row.shop_id ?? null,
    orderId: row.order_id,
    subOrderId: row.sub_order_id,
    buyerNick: row.buyer_nick,
    itemId: row.item_id,
    skuId: row.sku_id ?? null,
    title: row.title,
    status: row.status,
    giftCardType: row.gift_card_type ?? null,
    giftCardCode: row.gift_card_code ?? null,
    deliveryStatus: row.delivery_status,
    deliveryMessage: row.delivery_message ?? null,
    claimedAt: row.claimed_at ?? null,
    claimedByUserId: row.claimed_by_user_id ?? null,
    lastEventAt: row.last_event_at ?? null,
    rawPayload: row.raw_payload ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapKey(row: any) {
  return {
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    keyPreview: row.key_preview,
    keyCiphertext: row.key_ciphertext ?? null,
    userId: row.user_id ?? null,
    planId: row.plan_id,
    status: row.status,
    ownerEmail: row.owner_email,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at
  };
}

export function mapLog(row: any) {
  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    channelGroupId: row.channel_group_id ?? null,
    channelNumber: row.channel_number ?? null,
    usageSource: row.usage_source ?? 'plan',
    model: row.model,
    path: row.path,
    method: row.method,
    statusCode: row.status_code,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    totalTokens: row.total_tokens,
    inputCostCents: row.input_cost_cents,
    outputCostCents: row.output_cost_cents,
    cacheCreationCostCents: row.cache_creation_cost_cents,
    cacheReadCostCents: row.cache_read_cost_cents,
    totalCostCents: row.total_cost_cents,
    latencyMs: row.latency_ms,
    errorMessage: row.error_message,
    requestId: row.request_id,
    createdAt: row.created_at
  };
}

export function mapUpstreamChannel(row: any) {
  return {
    id: row.id,
    channelNumber: Number(row.channel_number ?? 0),
    name: row.name,
    websiteUrl: row.website_url ?? '',
    status: row.status,
    claudeApiUrl: row.claude_api_url,
    codexApiUrl: row.codex_api_url,
    useIndependentAgentKeys: Boolean(row.use_independent_agent_keys),
    inputRatePerMillion: Number(row.input_rate_per_million),
    outputRatePerMillion: Number(row.output_rate_per_million),
    cacheCreationRatePerMillion: Number(row.cache_creation_rate_per_million),
    cacheReadRatePerMillion: Number(row.cache_read_rate_per_million),
    serverErrorRecoveryMinutes: Number(row.server_error_recovery_minutes ?? 10),
    displayUsageMultiplier: Number(row.display_usage_multiplier ?? 2),
    sortOrder: Number(row.sort_order),
    degradedUntil: row.degraded_until ?? null,
    degradedReason: row.degraded_reason ?? null,
    degradedStatusCode: row.degraded_status_code ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapUpstreamChannelKey(row: any) {
  return {
    id: row.id,
    channelGroupId: row.channel_group_id,
    name: row.name ?? '',
    agentType: row.agent_type,
    keyHash: row.key_hash,
    keyPreview: row.key_preview,
    keyCiphertext: row.key_ciphertext,
    status: row.status,
    sortOrder: Number(row.sort_order),
    expiresAt: row.expires_at ?? null,
    exhaustedUntil: row.exhausted_until ?? null,
    failureReason: row.failure_reason ?? null,
    failureStatusCode: row.failure_status_code ?? null,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapUpstreamModelRate(row: any) {
  return {
    id: row.id,
    channelGroupId: row.channel_group_id,
    agentType: row.agent_type,
    model: row.model,
    inputRatePerMillion: Number(row.input_rate_per_million),
    outputRatePerMillion: Number(row.output_rate_per_million),
    cacheCreationRatePerMillion: Number(row.cache_creation_rate_per_million),
    cacheReadRatePerMillion: Number(row.cache_read_rate_per_million),
    isDefault: Boolean(row.is_default),
    sortOrder: Number(row.sort_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

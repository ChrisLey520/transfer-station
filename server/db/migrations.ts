import { db } from './connection.js';

export function runMigrations() {
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

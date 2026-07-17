import { db } from './connection.js';
import { runMigrations } from './migrations.js';

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
      remark TEXT,
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
      five_hour_cycle_start_at TEXT,
      weekly_cycle_start_at TEXT,
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

  runMigrations();
}

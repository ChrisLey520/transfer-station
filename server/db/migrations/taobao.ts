import { db } from '../connection.js';
import { tableColumns } from './shared.js';

export function ensureTaobaoIntegrationTables() {
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

export function ensurePlatformOrderClaimColumns() {
  const columns = tableColumns('platform_orders');

  if (!columns.has('claimed_by_user_id')) {
    db.exec('ALTER TABLE platform_orders ADD COLUMN claimed_by_user_id TEXT');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_platform_orders_claimed_by ON platform_orders(claimed_by_user_id, claimed_at)');
}

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const databasePath = process.env.DATABASE_PATH ?? './data/transfer-station.sqlite';
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function nowIso() {
  return new Date().toISOString();
}

export function initDb() {
  db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_usage_api_key_created_at ON usage_logs(api_key_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_logs(created_at);
  `);

  ensureUsageLogMoneyColumns();
  ensureApiKeySecretColumns();
}

function ensureApiKeySecretColumns() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(api_keys)').all() as Array<{ name: string }>).map((column) => column.name)
  );

  if (!columns.has('key_ciphertext')) {
    db.exec('ALTER TABLE api_keys ADD COLUMN key_ciphertext TEXT');
  }
}

function ensureUsageLogMoneyColumns() {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(usage_logs)').all() as Array<{ name: string }>).map((column) => column.name)
  );

  const additions = [
    ['cache_creation_input_tokens', 'INTEGER NOT NULL DEFAULT 0'],
    ['cache_read_input_tokens', 'INTEGER NOT NULL DEFAULT 0'],
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

export function mapKey(row: any) {
  return {
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    keyPreview: row.key_preview,
    keyCiphertext: row.key_ciphertext ?? null,
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

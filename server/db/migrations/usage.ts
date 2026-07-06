import { db } from '../connection.js';
import { tableColumns } from './shared.js';

export function ensureUsageLogMoneyColumns() {
  const columns = tableColumns('usage_logs');

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

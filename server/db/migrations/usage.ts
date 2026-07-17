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

export function ensureAccountQuotaCycleColumns() {
  const columns = tableColumns('account_state');
  const additions = [
    ['five_hour_cycle_start_at', 'TEXT'],
    ['weekly_cycle_start_at', 'TEXT']
  ] as const;

  const missing = additions.filter(([name]) => !columns.has(name));
  if (!missing.length) return;

  for (const [name, definition] of missing) {
    db.exec(`ALTER TABLE account_state ADD COLUMN ${name} ${definition}`);
  }

  // One-time backfill: anchor each user's active cycle to the earliest
  // successful plan consumption inside the trailing window so quotas that are
  // already exhausted stay exhausted after this migration.
  const backfillColumn = (column: string, windowMs: number) => {
    db.prepare(
      `
      UPDATE account_state
      SET ${column} = (
        SELECT MIN(usage_logs.created_at)
        FROM usage_logs
        WHERE usage_logs.api_key_id IN (SELECT id FROM api_keys WHERE user_id = account_state.id)
          AND usage_logs.created_at >= @since
          AND usage_logs.status_code BETWEEN 200 AND 299
          AND COALESCE(usage_logs.usage_source, 'plan') = 'plan'
          AND COALESCE(usage_logs.total_cost_cents, 0) > 0
      )
      WHERE ${column} IS NULL
    `
    ).run({ since: new Date(Date.now() - windowMs).toISOString() });
  };

  backfillColumn('five_hour_cycle_start_at', 5 * 60 * 60 * 1000);
  backfillColumn('weekly_cycle_start_at', 7 * 24 * 60 * 60 * 1000);
}

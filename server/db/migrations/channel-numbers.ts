import { db } from '../connection.js';
import { tableColumns } from './shared.js';

export function ensureChannelNumberColumns() {
  const groupColumns = tableColumns('upstream_channel_groups');
  if (!groupColumns.has('channel_number')) {
    db.exec('ALTER TABLE upstream_channel_groups ADD COLUMN channel_number INTEGER');
  }

  const logColumns = tableColumns('usage_logs');
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

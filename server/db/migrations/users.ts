import { db } from '../connection.js';
import { tableColumns } from './shared.js';

export function ensureUserRoleColumn() {
  const columns = tableColumns('users');

  if (!columns.has('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member'))");
  }

  db.exec("UPDATE users SET role = 'member' WHERE role IS NULL OR role NOT IN ('admin', 'member')");
}

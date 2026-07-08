import { db } from '../connection.js';
import { tableColumns } from './shared.js';

export function ensureUserRoleColumn() {
  const columns = tableColumns('users');

  if (!columns.has('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member'))");
  }

  if (!columns.has('status')) {
    db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned'))");
  }

  if (!columns.has('remark')) {
    db.exec('ALTER TABLE users ADD COLUMN remark TEXT');
  }

  db.exec("UPDATE users SET role = 'member' WHERE role IS NULL OR role NOT IN ('admin', 'member')");
  db.exec("UPDATE users SET status = 'active' WHERE status IS NULL OR status NOT IN ('active', 'banned')");
}

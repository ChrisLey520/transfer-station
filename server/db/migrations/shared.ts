import { db } from '../connection.js';

export function tableColumns(tableName: string) {
  return new Set((db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((column) => column.name));
}

export function tableSql(tableName: string) {
  return db.prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?").get(tableName) as
    | { sql: string | null }
    | undefined;
}

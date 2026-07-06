import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const databasePath = process.env.DATABASE_PATH ?? './data/transfer-station.sqlite';
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

class SqliteDatabase {
  private readonly database: DatabaseSync;

  constructor(filename: string) {
    this.database = new DatabaseSync(filename);
  }

  exec(sql: string) {
    return this.database.exec(sql);
  }

  prepare(sql: string) {
    const statement = this.database.prepare(sql);
    statement.setAllowUnknownNamedParameters(true);
    return statement;
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: Parameters<T>) => {
      this.database.exec('BEGIN');
      try {
        const result = fn(...args);
        this.database.exec('COMMIT');
        return result;
      } catch (error) {
        this.database.exec('ROLLBACK');
        throw error;
      }
    }) as T;
  }
}

export const db = new SqliteDatabase(databasePath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function nowIso() {
  return new Date().toISOString();
}

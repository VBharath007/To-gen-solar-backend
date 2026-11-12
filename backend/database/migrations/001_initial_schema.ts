import type Database from 'better-sqlite3';

export interface Migration {
  /** Monotonically increasing integer; never reuse or reorder. */
  version: number;
  /** Human-readable slug stored in schema_migrations. */
  name: string;
  /** Applies the migration inside a transaction. */
  up(db: Database.Database): void;
}

/**
 * Migration 001 – Initial schema
 *
 * Creates:
 * - schema_migrations  : tracks applied migrations
 * - customers          : core customer records
 * - customers_updated_at trigger : auto-updates updated_at on row change
 */
export const migration001: Migration = {
  version: 1,
  name: '001_initial_schema',

  up(db: Database.Database): void {
    // Migration tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    INTEGER PRIMARY KEY,
        name       TEXT    NOT NULL,
        applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Customers
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        email      TEXT,
        phone      TEXT    NOT NULL,
        address    TEXT,
        city       TEXT,
        notes      TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Auto-update trigger
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS customers_updated_at
      AFTER UPDATE ON customers
      FOR EACH ROW
      BEGIN
        UPDATE customers SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

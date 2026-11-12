import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration004: Migration = {
  version: 4,
  name: '004_products',

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        category    TEXT    NOT NULL,
        brand       TEXT    NOT NULL,
        model       TEXT    NOT NULL,
        specs       TEXT,
        unit        TEXT    NOT NULL,
        price       INTEGER, -- Stored in paise (100 paise = 1 INR)
        tax_rate    REAL,    -- Percentage (e.g. 5.0, 18.0)
        is_archived BOOLEAN NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS products_updated_at
      AFTER UPDATE ON products
      FOR EACH ROW
      BEGIN
        UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

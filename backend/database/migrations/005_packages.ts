import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration005: Migration = {
  version: 5,
  name: '005_packages',

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS packages (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name           TEXT    NOT NULL,
        description    TEXT,
        dc_capacity_kw REAL    NOT NULL DEFAULT 0,
        ac_capacity_kw REAL    NOT NULL DEFAULT 0,
        pricing_method TEXT    NOT NULL DEFAULT 'aggregate', -- 'aggregate' or 'fixed'
        fixed_price    INTEGER, -- Stored in paise, used if method is 'fixed'
        is_archived    BOOLEAN NOT NULL DEFAULT 0,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS package_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        package_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity   REAL    NOT NULL,
        FOREIGN KEY(package_id) REFERENCES packages(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE RESTRICT
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS packages_updated_at
      AFTER UPDATE ON packages
      FOR EACH ROW
      BEGIN
        UPDATE packages SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

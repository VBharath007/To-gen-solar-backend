import type Database from 'better-sqlite3';
import type { Migration } from './001_initial_schema';

export const migration002: Migration = {
  version: 2,
  name: '002_installation_sites',

  up(db: Database.Database): void {
    // Installation Sites
    db.exec(`
      CREATE TABLE IF NOT EXISTS installation_sites (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        address     TEXT    NOT NULL,
        city        TEXT    NOT NULL,
        postcode    TEXT,
        site_notes  TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );
    `);

    // Auto-update trigger
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS installation_sites_updated_at
      AFTER UPDATE ON installation_sites
      FOR EACH ROW
      BEGIN
        UPDATE installation_sites SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

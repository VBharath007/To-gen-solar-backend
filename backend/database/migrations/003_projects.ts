import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration003: Migration = {
  version: 3,
  name: '003_projects',

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        reference      TEXT    NOT NULL,
        customer_id    INTEGER NOT NULL,
        site_id        INTEGER NOT NULL,
        quotation_ref  TEXT,
        target_date    TEXT,
        stage          TEXT    NOT NULL,
        payment_status TEXT    NOT NULL,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY(site_id) REFERENCES installation_sites(id) ON DELETE RESTRICT
      );
    `);

    // Auto-update trigger for updated_at
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS projects_updated_at
      AFTER UPDATE ON projects
      FOR EACH ROW
      BEGIN
        UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

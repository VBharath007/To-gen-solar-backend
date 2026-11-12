import type Database from 'better-sqlite3';
import { Migration } from './001_initial_schema';

/**
 * Migration 010 – Leads schema
 *
 * Creates:
 * - leads : stores lead records
 * - leads_updated_at trigger : auto-updates updated_at on row change
 */
export const migration010: Migration = {
  version: 10,
  name: '010_leads',

  up(db: Database.Database): void {
    // Leads table
    db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        email      TEXT,
        phone      TEXT    NOT NULL,
        source     TEXT,
        status     TEXT    NOT NULL DEFAULT 'New',
        notes      TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Auto-update trigger for leads
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS leads_updated_at
      AFTER UPDATE ON leads
      FOR EACH ROW
      BEGIN
        UPDATE leads SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

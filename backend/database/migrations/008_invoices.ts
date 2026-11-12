import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration008: Migration = {
  version: 8,
  name: '008_invoices',

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        reference      TEXT    NOT NULL,
        project_id     INTEGER NOT NULL,
        customer_id    INTEGER NOT NULL,
        issue_date     TEXT    NOT NULL,
        due_date       TEXT    NOT NULL,
        amount         INTEGER NOT NULL DEFAULT 0,
        tax_amount     INTEGER NOT NULL DEFAULT 0,
        total_amount   INTEGER NOT NULL DEFAULT 0,
        amount_paid    INTEGER NOT NULL DEFAULT 0,
        status         TEXT    NOT NULL DEFAULT 'Draft', -- Draft, Sent, Partially Paid, Paid, Overdue
        notes          TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS invoices_updated_at
      AFTER UPDATE ON invoices
      FOR EACH ROW
      BEGIN
        UPDATE invoices SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

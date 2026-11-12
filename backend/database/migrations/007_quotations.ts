import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration007: Migration = {
  version: 7,
  name: '007_quotations',

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotations (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        reference      TEXT    NOT NULL,
        version        INTEGER NOT NULL DEFAULT 1,
        customer_id    INTEGER NOT NULL,
        site_id        INTEGER NOT NULL,
        status         TEXT    NOT NULL DEFAULT 'Draft', -- Draft, Issued, Accepted, Rejected, Expired
        issue_date     TEXT,
        valid_until    TEXT,
        subtotal       INTEGER NOT NULL DEFAULT 0,
        total_discount INTEGER NOT NULL DEFAULT 0,
        total_tax      INTEGER NOT NULL DEFAULT 0,
        grand_total    INTEGER NOT NULL DEFAULT 0,
        payment_terms  TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY(site_id) REFERENCES installation_sites(id) ON DELETE RESTRICT
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        item_type    TEXT    NOT NULL, -- 'product' or 'package'
        item_id      INTEGER,          -- The original product_id or package_id for reference
        name         TEXT    NOT NULL, -- SNAPSHOT
        description  TEXT,             -- SNAPSHOT
        quantity     REAL    NOT NULL,
        unit_price   INTEGER NOT NULL, -- SNAPSHOT
        discount     INTEGER NOT NULL DEFAULT 0,
        tax_rate     REAL    NOT NULL DEFAULT 0, -- SNAPSHOT
        total        INTEGER NOT NULL, -- Computed at insertion
        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS quotations_updated_at
      AFTER UPDATE ON quotations
      FOR EACH ROW
      BEGIN
        UPDATE quotations SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 020 – Support manual/unlisted customer details directly on quotations
 *
 * Allows quotation creation without selecting an existing customer from the database:
 * - Adds is_manual_customer, manual_customer_name, manual_customer_phone, manual_customer_email, manual_customer_address
 * - Makes customer_id and site_id nullable in quotations table
 */
export const migration020: Migration = {
  version: 20,
  name: '020_quotation_manual_customer',

  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(quotations)').all() as { name: string; notnull: number }[]);
    const colNames = cols.map((c) => c.name);
    const customerIdCol = cols.find((c) => c.name === 'customer_id');

    // If customer_id is NOT NULL, recreate table to make customer_id and site_id nullable
    if (customerIdCol && customerIdCol.notnull === 1) {
      db.exec(`
        CREATE TABLE quotations_temp (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          reference           TEXT    NOT NULL,
          version             INTEGER NOT NULL DEFAULT 1,
          customer_id         INTEGER,
          site_id             INTEGER,
          is_manual_customer  INTEGER NOT NULL DEFAULT 0,
          manual_customer_name    TEXT,
          manual_customer_phone   TEXT,
          manual_customer_email   TEXT,
          manual_customer_address TEXT,
          status              TEXT    NOT NULL DEFAULT 'Draft',
          issue_date          TEXT,
          valid_until         TEXT,
          subtotal            INTEGER NOT NULL DEFAULT 0,
          total_discount      INTEGER NOT NULL DEFAULT 0,
          total_tax           INTEGER NOT NULL DEFAULT 0,
          grand_total         INTEGER NOT NULL DEFAULT 0,
          payment_terms       TEXT,
          business_snapshot   TEXT,
          business_category   TEXT,
          system_type         TEXT,
          tax_inclusive       BOOLEAN NOT NULL DEFAULT 0,
          validity_days       INTEGER NOT NULL DEFAULT 10,
          quotation_type      TEXT    NOT NULL DEFAULT 'Quotation',
          project_type        TEXT,
          notes_internal      TEXT,
          locked_at           TEXT,
          created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
          FOREIGN KEY(site_id) REFERENCES installation_sites(id) ON DELETE SET NULL
        );
      `);

      const commonCols = [
        'id', 'reference', 'version', 'customer_id', 'site_id', 'status',
        'issue_date', 'valid_until', 'subtotal', 'total_discount', 'total_tax',
        'grand_total', 'payment_terms', 'created_at', 'updated_at'
      ];
      const optionalCols = [
        'business_snapshot', 'business_category', 'system_type',
        'tax_inclusive', 'validity_days', 'quotation_type', 'project_type',
        'notes_internal', 'locked_at'
      ];
      for (const col of optionalCols) {
        if (colNames.includes(col)) {
          commonCols.push(col);
        }
      }

      const colList = commonCols.join(', ');
      db.exec(`INSERT INTO quotations_temp (${colList}) SELECT ${colList} FROM quotations;`);
      db.exec(`DROP TABLE quotations;`);
      db.exec(`ALTER TABLE quotations_temp RENAME TO quotations;`);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS quotations_updated_at
        AFTER UPDATE ON quotations
        FOR EACH ROW
        BEGIN
          UPDATE quotations SET updated_at = datetime('now') WHERE id = NEW.id;
        END;
      `);
    } else {
      const qadd = (col: string, def: string) => {
        if (!colNames.includes(col)) {
          db.exec(`ALTER TABLE quotations ADD COLUMN ${col} ${def};`);
        }
      };
      qadd('is_manual_customer', 'INTEGER NOT NULL DEFAULT 0');
      qadd('manual_customer_name', 'TEXT');
      qadd('manual_customer_phone', 'TEXT');
      qadd('manual_customer_email', 'TEXT');
      qadd('manual_customer_address', 'TEXT');
    }
  },
};

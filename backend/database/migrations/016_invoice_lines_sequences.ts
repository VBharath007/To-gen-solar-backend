import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 016 – Invoice lines, optional project, document sequences
 *
 * Creates:
 *   document_sequences   : safe, transaction-level sequence counters (replaces COUNT+1)
 *   invoice_lines        : per-line item records with tax snapshots
 *
 * Modifies invoices:
 *   project_id → nullable
 *   adds: tax_inclusive, place_of_supply, seller_snapshot, customer_snapshot,
 *         quotation_id, locked_at (when issued — prevents editing financial fields)
 *
 * Preserves:  existing aggregate amount/tax_amount/total_amount columns (historical records)
 */
export const migration016: Migration = {
  version: 16,
  name: '016_invoice_lines_sequences',
  up(db: Database.Database): void {

    // 1. Safe sequence counters
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_sequences (
        series      TEXT    PRIMARY KEY,
        last_value  INTEGER NOT NULL DEFAULT 0
      );
    `);
    // Seed series used in the app
    db.prepare(`INSERT OR IGNORE INTO document_sequences (series, last_value) VALUES (?, ?)`).run('INV', 0);
    db.prepare(`INSERT OR IGNORE INTO document_sequences (series, last_value) VALUES (?, ?)`).run('PAY', 0);
    db.prepare(`INSERT OR IGNORE INTO document_sequences (series, last_value) VALUES (?, ?)`).run('ADV', 0);
    db.prepare(`INSERT OR IGNORE INTO document_sequences (series, last_value) VALUES (?, ?)`).run('QUO', 0);


    // 3. Add new columns to invoices (all additive — preserves historical rows)
    const icols = (db.prepare('PRAGMA table_info(invoices)').all() as { name: string }[]).map(c => c.name);
    const iadd = (col: string, def: string) => { if (!icols.includes(col)) db.exec(`ALTER TABLE invoices ADD COLUMN ${col} ${def};`); };

    iadd('quotation_id',      'INTEGER');
    iadd('tax_inclusive',     'BOOLEAN NOT NULL DEFAULT 0');
    iadd('place_of_supply',   `TEXT DEFAULT 'Tamil Nadu'`);
    iadd('seller_snapshot',   'TEXT'); // JSON snapshot of company info at issue time
    iadd('customer_snapshot', 'TEXT'); // JSON snapshot of customer info at issue time
    iadd('locked_at',         'TEXT'); // ISO datetime; non-null = issued, prevent financial edits
    iadd('invoice_type',      `TEXT NOT NULL DEFAULT 'Tax Invoice'`); // Tax Invoice | Proforma | Credit Note
    iadd('has_line_items',    'BOOLEAN NOT NULL DEFAULT 0'); // False for legacy aggregate invoices

    // Make project_id nullable — SQLite doesn't support ALTER COLUMN, so we use a workaround
    // Check if we need to recreate the table
    const hasNullableProject = (() => {
      const createSql = (db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='invoices'`).get() as { sql: string } | undefined)?.sql ?? '';
      // If project_id has NOT NULL constraint without default → needs migration
      return !createSql.includes('project_id     INTEGER NOT NULL');
    })();

    if (!hasNullableProject) {
      // Recreate invoices table with project_id nullable
      db.exec(`
        CREATE TABLE invoices_new (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          reference        TEXT    NOT NULL UNIQUE,
          project_id       INTEGER,             -- NULLABLE: service-only billing allowed
          customer_id      INTEGER NOT NULL,
          quotation_id     INTEGER,
          invoice_type     TEXT    NOT NULL DEFAULT 'Tax Invoice',
          issue_date       TEXT    NOT NULL,
          due_date         TEXT    NOT NULL,
          place_of_supply  TEXT    DEFAULT 'Tamil Nadu',
          tax_inclusive    BOOLEAN NOT NULL DEFAULT 0,
          amount           INTEGER NOT NULL DEFAULT 0,  -- subtotal (taxable value)
          tax_amount       INTEGER NOT NULL DEFAULT 0,
          total_amount     INTEGER NOT NULL DEFAULT 0,
          amount_paid      INTEGER NOT NULL DEFAULT 0,
          status           TEXT    NOT NULL DEFAULT 'Draft',
          has_line_items   BOOLEAN NOT NULL DEFAULT 0,
          notes            TEXT,
          business_snapshot  TEXT,
          seller_snapshot    TEXT,
          customer_snapshot  TEXT,
          locked_at          TEXT,
          created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(project_id)   REFERENCES projects(id)   ON DELETE RESTRICT,
          FOREIGN KEY(customer_id)  REFERENCES customers(id)  ON DELETE RESTRICT,
          FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE SET NULL
        );
      `);

      // Copy existing data
      db.exec(`
        INSERT INTO invoices_new (
          id, reference, project_id, customer_id, issue_date, due_date,
          amount, tax_amount, total_amount, amount_paid, status, notes,
          business_snapshot, created_at, updated_at
        )
        SELECT
          id, reference, project_id, customer_id, issue_date, due_date,
          amount, tax_amount, total_amount, amount_paid, status, notes,
          business_snapshot, created_at, updated_at
        FROM invoices;
      `);

      // Drop triggers that reference the invoices table
      db.exec(`DROP TRIGGER IF EXISTS update_invoice_paid_amount_insert;`);
      db.exec(`DROP TRIGGER IF EXISTS update_invoice_paid_amount_update;`);
      db.exec(`DROP TRIGGER IF EXISTS update_invoice_paid_amount_delete;`);

      db.exec(`DROP TABLE invoices;`);
      db.exec(`ALTER TABLE invoices_new RENAME TO invoices;`);

      // Recreate triggers that were dropped
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_invoice_paid_amount_insert
        AFTER INSERT ON payments
        FOR EACH ROW
        BEGIN
          UPDATE invoices
          SET amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = NEW.invoice_id)
          WHERE id = NEW.invoice_id;
        END;
      `);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_invoice_paid_amount_update
        AFTER UPDATE ON payments
        FOR EACH ROW
        BEGIN
          UPDATE invoices
          SET amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = NEW.invoice_id)
          WHERE id = NEW.invoice_id;
          
          UPDATE invoices
          SET amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = OLD.invoice_id)
          WHERE id = OLD.invoice_id;
        END;
      `);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_invoice_paid_amount_delete
        AFTER DELETE ON payments
        FOR EACH ROW
        BEGIN
          UPDATE invoices
          SET amount_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = OLD.invoice_id)
          WHERE id = OLD.invoice_id;
        END;
      `);

      // Recreate trigger
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS invoices_updated_at
        AFTER UPDATE ON invoices
        FOR EACH ROW
        BEGIN
          UPDATE invoices SET updated_at = datetime('now') WHERE id = NEW.id;
        END;
      `);
    }

    // 2. Invoice line items table (Create AFTER invoices is potentially recreated to avoid FK constraints)
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoice_lines (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id      INTEGER NOT NULL,
        sl_no           INTEGER NOT NULL,
        description     TEXT    NOT NULL,
        specification   TEXT,
        hsn_sac         TEXT,
        quantity        REAL    NOT NULL DEFAULT 1,
        unit            TEXT    NOT NULL DEFAULT 'Nos',
        unit_price      INTEGER NOT NULL,        -- paise
        discount        INTEGER NOT NULL DEFAULT 0, -- paise
        taxable_value   INTEGER NOT NULL,        -- paise (computed by backend)
        tax_rate        REAL    NOT NULL DEFAULT 0,
        cgst_rate       REAL    NOT NULL DEFAULT 0,
        sgst_rate       REAL    NOT NULL DEFAULT 0,
        igst_rate       REAL    NOT NULL DEFAULT 0,
        tax_amount      INTEGER NOT NULL DEFAULT 0,  -- paise
        line_total      INTEGER NOT NULL,        -- paise
        FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `);
  },
};

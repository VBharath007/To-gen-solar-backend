import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 017 – Advance payments, allocation, milestones
 *
 * Creates:
 *   payment_receipts     : all money received (replaces/extends payments table concept)
 *                          invoice_id is NULLABLE (advance before invoice)
 *   payment_allocations  : links a receipt to an invoice (many-to-many)
 *   quotation_milestones : editable payment milestone templates per quotation
 *
 * The original payments table is preserved for historical data.
 * New receipts go into payment_receipts.
 */
export const migration017: Migration = {
  version: 17,
  name: '017_payments_advance_allocation',
  up(db: Database.Database): void {

    // New receipts table with nullable invoice_id
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_receipts (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        reference       TEXT    NOT NULL UNIQUE,
        customer_id     INTEGER NOT NULL,
        project_id      INTEGER,            -- optional
        invoice_id      INTEGER,            -- null = advance (pre-invoice)
        payment_type    TEXT    NOT NULL DEFAULT 'Receipt', -- Receipt | Advance | Refund
        amount          INTEGER NOT NULL,   -- paise received
        payment_date    TEXT    NOT NULL,
        payment_method  TEXT    NOT NULL,   -- Bank Transfer | UPI | Cash | Cheque | NEFT | RTGS
        transaction_id  TEXT,
        bank_ref        TEXT,
        unallocated     INTEGER NOT NULL DEFAULT 0, -- paise not yet allocated
        notes           TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY(project_id)  REFERENCES projects(id)  ON DELETE SET NULL,
        FOREIGN KEY(invoice_id)  REFERENCES invoices(id)  ON DELETE SET NULL
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS payment_receipts_updated_at
      AFTER UPDATE ON payment_receipts FOR EACH ROW
      BEGIN
        UPDATE payment_receipts SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);

    // Allocation table: links a receipt to an invoice
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id      INTEGER NOT NULL,
        invoice_id      INTEGER NOT NULL,
        allocated_amount INTEGER NOT NULL,  -- paise
        allocated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        notes           TEXT,
        FOREIGN KEY(receipt_id)  REFERENCES payment_receipts(id) ON DELETE RESTRICT,
        FOREIGN KEY(invoice_id)  REFERENCES invoices(id)         ON DELETE RESTRICT,
        UNIQUE(receipt_id, invoice_id)
      );
    `);

    // Quotation milestone templates
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotation_milestones (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id INTEGER NOT NULL,
        sl_no        INTEGER NOT NULL,
        label        TEXT    NOT NULL,  -- e.g. "Advance", "On Material Delivery", "On Commissioning"
        percentage   REAL    NOT NULL,  -- e.g. 80, 10, 10
        amount       INTEGER,           -- paise; computed from quotation grand_total; may be null until quotation finalised
        due_trigger  TEXT,              -- description of when this milestone is due
        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      );
    `);

    // Seed document sequence for advances
    db.prepare(`INSERT OR IGNORE INTO document_sequences (series, last_value) VALUES (?, ?)`).run('ADV', 0);
  },
};

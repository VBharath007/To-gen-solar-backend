import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration009: Migration = {
  version: 9,
  name: '009_payments',

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        reference      TEXT    NOT NULL,
        invoice_id     INTEGER NOT NULL,
        amount         INTEGER NOT NULL,
        payment_date   TEXT    NOT NULL,
        payment_method TEXT    NOT NULL, -- Bank Transfer, UPI, Cash, Cheque
        transaction_id TEXT,
        notes          TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT
      );
    `);

    // Auto-update amount_paid on invoice when a payment is added
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_invoice_paid_amount_insert
      AFTER INSERT ON payments
      BEGIN
        UPDATE invoices 
        SET amount_paid = amount_paid + NEW.amount,
            status = CASE 
              WHEN amount_paid + NEW.amount >= total_amount THEN 'Paid'
              ELSE 'Partially Paid'
            END
        WHERE id = NEW.invoice_id;
      END;
    `);

    // Auto-update amount_paid on invoice when a payment is deleted
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_invoice_paid_amount_delete
      AFTER DELETE ON payments
      BEGIN
        UPDATE invoices 
        SET amount_paid = amount_paid - OLD.amount,
            status = CASE 
              WHEN amount_paid - OLD.amount <= 0 THEN 'Sent' -- fallback status
              WHEN amount_paid - OLD.amount >= total_amount THEN 'Paid'
              ELSE 'Partially Paid'
            END
        WHERE id = OLD.invoice_id;
      END;
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS payments_updated_at
      AFTER UPDATE ON payments
      FOR EACH ROW
      BEGIN
        UPDATE payments SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';
import { formatNotesToPlainText } from '@shared/utils/notesFormatter';

/**
 * Migration 039 – Add bank_account_id to invoices table
 * and convert any existing raw JSON notes to readable text format.
 */
export const migration039: Migration = {
  version: 39,
  name: '039_invoice_bank_account',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(invoices)').all() as { name: string }[]).map(c => c.name);
    if (!cols.includes('bank_account_id')) {
      db.exec('ALTER TABLE invoices ADD COLUMN bank_account_id TEXT;');
    }

    // Convert any legacy JSON notes in invoices table to clean plain text
    try {
      const rows = db.prepare("SELECT id, notes FROM invoices WHERE notes LIKE '[%' OR notes LIKE '{%'").all() as { id: number; notes: string }[];
      const updateStmt = db.prepare('UPDATE invoices SET notes = ? WHERE id = ?');
      for (const r of rows) {
        if (r.notes) {
          const formatted = formatNotesToPlainText(r.notes);
          if (formatted && formatted !== r.notes) {
            updateStmt.run(formatted, r.id);
          }
        }
      }
    } catch {
      // Ignore if table query fails in edge cases
    }
  },
};

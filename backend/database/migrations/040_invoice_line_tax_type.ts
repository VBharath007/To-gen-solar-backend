import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 040 – Add tax_type to invoice_lines table
 */
export const migration040: Migration = {
  version: 40,
  name: '040_invoice_line_tax_type',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(invoice_lines)').all() as { name: string }[]).map(c => c.name);
    if (!cols.includes('tax_type')) {
      db.exec("ALTER TABLE invoice_lines ADD COLUMN tax_type TEXT DEFAULT 'Exclusive';");
    }
  },
};

import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration026: Migration = {
  version: 26,
  name: '026_quotation_unique_reference',

  up(db: Database.Database): void {
    // 1. Ensure unique index on quotations(reference)
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_reference ON quotations(reference);
    `);

    // 2. Seed document_sequences for the current year if not present
    const currentYear = new Date().getFullYear();
    const series = `QUO_${currentYear}`;
    const prefix = `QR${currentYear}`;

    const existingQuotes = db.prepare(`
      SELECT reference FROM quotations WHERE reference LIKE ?
    `).all(`${prefix}%`) as { reference: string }[];

    let maxSeq = 0;
    for (const q of existingQuotes) {
      const numPart = q.reference.slice(prefix.length);
      const val = parseInt(numPart, 10);
      if (!isNaN(val) && val > maxSeq) {
        maxSeq = val;
      }
    }

    db.prepare(`
      INSERT OR IGNORE INTO document_sequences (series, last_value) VALUES (?, ?)
    `).run(series, maxSeq);
  },
};

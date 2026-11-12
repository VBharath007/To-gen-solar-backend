import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration027: Migration = {
  version: 27,
  name: '027_project_unique_reference',

  up(db: Database.Database): void {
    // 1. Ensure unique index on projects(reference)
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_reference ON projects(reference);
    `);

    // 2. Pre-seed document_sequences for the current year if not present
    const currentYear = new Date().getFullYear();
    const series = `PRJ_${currentYear}`;
    const prefix = `PRJ${currentYear}`;

    const existingProjects = db.prepare(`
      SELECT reference FROM projects WHERE reference LIKE ?
    `).all(`${prefix}%`) as { reference: string }[];

    let maxSeq = 0;
    for (const p of existingProjects) {
      const numPart = p.reference.slice(prefix.length);
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

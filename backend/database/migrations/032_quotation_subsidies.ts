import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration032: Migration = {
  version: 32,
  name: '032_quotation_subsidies',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(quotations)').all() as { name: string }[]).map(c => c.name);
    if (!cols.includes('state_subsidy')) {
      db.exec(`ALTER TABLE quotations ADD COLUMN state_subsidy INTEGER NOT NULL DEFAULT 0;`);
    }
    if (!cols.includes('central_subsidy')) {
      db.exec(`ALTER TABLE quotations ADD COLUMN central_subsidy INTEGER NOT NULL DEFAULT 0;`);
    }
  },
};

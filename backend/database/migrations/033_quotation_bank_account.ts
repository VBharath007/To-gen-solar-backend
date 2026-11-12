import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration033: Migration = {
  version: 33,
  name: '033_quotation_bank_account',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(quotations)').all() as { name: string }[]).map(c => c.name);
    if (!cols.includes('bank_account_id')) {
      db.exec(`ALTER TABLE quotations ADD COLUMN bank_account_id TEXT;`);
    }
  },
};

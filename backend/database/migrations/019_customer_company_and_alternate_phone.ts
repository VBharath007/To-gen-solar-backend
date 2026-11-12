import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 019 – Customer company_name and alternate_phone fields
 * Adds company_name and alternate_phone to customers table if they do not exist.
 */
export const migration019: Migration = {
  version: 19,
  name: '019_customer_company_and_alternate_phone',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(customers)').all() as { name: string }[]).map(c => c.name);
    if (!cols.includes('company_name')) {
      db.exec(`ALTER TABLE customers ADD COLUMN company_name TEXT;`);
    }
    if (!cols.includes('alternate_phone')) {
      db.exec(`ALTER TABLE customers ADD COLUMN alternate_phone TEXT;`);
    }
  },
};

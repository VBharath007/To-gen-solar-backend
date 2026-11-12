import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 012 – Customer extended fields
 * Adds gstin, pan, customer_type, pincode, state to customers table (all nullable/additive).
 */
export const migration012: Migration = {
  version: 12,
  name: '012_customer_extended_fields',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(customers)').all() as { name: string }[]).map(c => c.name);
    if (!cols.includes('customer_type')) db.exec(`ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'Individual';`);
    if (!cols.includes('gstin'))         db.exec(`ALTER TABLE customers ADD COLUMN gstin TEXT;`);
    if (!cols.includes('pan'))           db.exec(`ALTER TABLE customers ADD COLUMN pan TEXT;`);
    if (!cols.includes('pincode'))       db.exec(`ALTER TABLE customers ADD COLUMN pincode TEXT;`);
    if (!cols.includes('state'))         db.exec(`ALTER TABLE customers ADD COLUMN state TEXT;`);
  },
};

import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 038 – Add business_category to customers table
 * Preserves lead business category when converted to customer,
 * and enables automatic pre-filling in quotation proposals.
 */
export const migration038: Migration = {
  version: 38,
  name: '038_customer_business_category',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(customers)').all() as { name: string }[]).map(c => c.name);
    if (!cols.includes('business_category')) {
      db.exec('ALTER TABLE customers ADD COLUMN business_category TEXT;');
    }

    // Backfill business_category for existing customers converted from leads
    try {
      db.exec(`
        UPDATE customers
        SET business_category = (
          SELECT leads.business_category 
          FROM leads 
          WHERE leads.phone = customers.phone 
            AND leads.business_category IS NOT NULL 
            AND leads.business_category != ''
          LIMIT 1
        )
        WHERE (business_category IS NULL OR business_category = '');
      `);
    } catch {
      // Ignore if table query fails in edge cases
    }
  },
};

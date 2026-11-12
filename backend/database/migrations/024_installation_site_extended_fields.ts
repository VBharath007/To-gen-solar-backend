import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 024 – Installation site extended fields for utility & billing details
 */
export const migration024: Migration = {
  version: 24,
  name: '024_installation_site_extended_fields',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(installation_sites)').all() as { name: string }[]).map(c => c.name);
    const add = (col: string, def: string) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE installation_sites ADD COLUMN ${col} ${def};`);
      }
    };

    add('state', 'TEXT');
    add('utility_provider', 'TEXT');
    add('consumer_number', 'TEXT');
    add('sanctioned_load_kw', 'REAL');
    add('tariff_category', 'TEXT');
    add('connection_phase', 'TEXT');
    add('average_monthly_bill', 'REAL');
  },
};

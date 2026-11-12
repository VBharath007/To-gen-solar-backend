import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 013 – Installation site electricity & utility fields
 * All additive — preserves existing rows.
 */
export const migration013: Migration = {
  version: 13,
  name: '013_site_electricity_fields',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(installation_sites)').all() as { name: string }[]).map(c => c.name);
    const add = (col: string, def: string) => { if (!cols.includes(col)) db.exec(`ALTER TABLE installation_sites ADD COLUMN ${col} ${def};`); };

    add('electricity_conn_no',     'TEXT');
    add('phase',                   `TEXT DEFAULT 'Single Phase'`);
    add('sanctioned_load_kw',      'REAL');
    add('tariff_code',             'TEXT');
    add('monthly_consumption_kwh', 'REAL');
    add('billing_period_from',     'TEXT');
    add('billing_period_to',       'TEXT');
    add('discom_name',             'TEXT');
    add('meter_no',                'TEXT');
    add('loan_docs_checklist',     'TEXT'); // JSON array of {doc, obtained: bool}
    add('roof_area_sqft',          'REAL');
    add('shadow_free_area_sqft',   'REAL');
  },
};

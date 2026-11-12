import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 035 – Add battery fields to quotation_technical_details
 * Supports Off-Grid additional technical fields: battery_type, battery_capacity, battery_quantity
 */
export const migration035: Migration = {
  version: 35,
  name: '035_quotation_battery_fields',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(quotation_technical_details)').all() as { name: string }[]).map(c => c.name);
    const addCol = (col: string, def: string) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE quotation_technical_details ADD COLUMN ${col} ${def};`);
      }
    };

    addCol('battery_type', 'TEXT');
    addCol('battery_capacity', 'REAL');
    addCol('battery_quantity', 'INTEGER');
  },
};

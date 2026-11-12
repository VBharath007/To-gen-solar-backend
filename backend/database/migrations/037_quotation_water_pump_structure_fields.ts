import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 037 – Add structure_height to quotation_technical_details
 * Supports Solar Water Pump structure height specifications.
 */
export const migration037: Migration = {
  version: 37,
  name: '037_quotation_water_pump_structure_fields',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(quotation_technical_details)').all() as { name: string }[]).map(c => c.name);
    const addCol = (col: string, def: string) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE quotation_technical_details ADD COLUMN ${col} ${def};`);
      }
    };

    addCol('structure_height', 'TEXT');
  },
};

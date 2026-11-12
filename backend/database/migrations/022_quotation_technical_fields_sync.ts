import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 022 – Sync Quotation Technical Details Columns
 * Ensures all form fields from QuotationEditor (system_capacity_kw, daily_generation_est,
 * panel_specs, inverter_specs, structure_type, structure_material, area_required_sqft)
 * are stored and retrieved without being dropped.
 */
export const migration022: Migration = {
  version: 22,
  name: '022_quotation_technical_fields_sync',

  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(quotation_technical_details)').all() as { name: string }[]).map(c => c.name);
    const addCol = (col: string, def: string) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE quotation_technical_details ADD COLUMN ${col} ${def};`);
      }
    };

    addCol('system_capacity_kw', 'REAL');
    addCol('daily_generation_est', 'REAL');
    addCol('panel_specs', 'TEXT');
    addCol('inverter_specs', 'TEXT');
    addCol('structure_type', 'TEXT');
    addCol('structure_material', 'TEXT');
    addCol('area_required_sqft', 'REAL');
  }
};

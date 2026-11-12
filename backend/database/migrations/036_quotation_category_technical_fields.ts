import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 036 – Add category-specific technical fields to quotation_technical_details
 * Supports Solar Street Light, Solar Water Pump, and Solar CCTV Camera fields.
 */
export const migration036: Migration = {
  version: 36,
  name: '036_quotation_category_technical_fields',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(quotation_technical_details)').all() as { name: string }[]).map(c => c.name);
    const addCol = (col: string, def: string) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE quotation_technical_details ADD COLUMN ${col} ${def};`);
      }
    };

    // Solar Street Light fields
    addCol('light_type', 'TEXT');
    addCol('sl_panel_type', 'TEXT');
    addCol('pole_material', 'TEXT');
    addCol('pole_height_ft', 'REAL');

    // Solar Water Pump fields
    addCol('pump_system_type', 'TEXT');

    // Solar CCTV Camera fields
    addCol('camera_mp', 'TEXT');
    addCol('memory_card_capacity', 'TEXT');
  },
};

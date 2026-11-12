import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 015 – Products extended fields
 *
 * Adds: component_type, hsn_sac, wattage_w, solution_categories (JSON array of category codes),
 *       make_country, datasheet_url.
 */
export const migration015: Migration = {
  version: 15,
  name: '015_products_extended',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(products)').all() as { name: string }[]).map(c => c.name);
    const add = (col: string, def: string) => { if (!cols.includes(col)) db.exec(`ALTER TABLE products ADD COLUMN ${col} ${def};`); };

    // Component type — Panel | Inverter | Battery | Structure | Cable | DCDB | ACDB |
    //                   Earthing | Lightning Protection | Accessory | Service | Other
    add('component_type',       'TEXT');
    // HSN for goods, SAC for services
    add('hsn_sac',              'TEXT');
    // Wattage where applicable (panels, inverters)
    add('wattage_w',            'REAL');
    // JSON array of business_category codes this product can be used in
    add('solution_categories',  'TEXT');
    // Country of manufacture
    add('make_country',         'TEXT');
    // Flag: does product require "as required" quantity (no fixed qty)
    add('qty_as_required',      'BOOLEAN NOT NULL DEFAULT 0');
  },
};

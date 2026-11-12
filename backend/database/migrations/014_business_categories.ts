import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 014 – Business categories
 *
 * Creates:
 *   business_categories   : canonical list of offering categories
 *
 * Adds business_category column to leads, products, packages, quotations, projects.
 *
 * Seeds the 5 primary + 2 pending categories.
 * "I & C" is treated as Installation & Commissioning pending owner confirmation.
 */
export const migration014: Migration = {
  version: 14,
  name: '014_business_categories',
  up(db: Database.Database): void {
    // Category master table
    db.exec(`
      CREATE TABLE IF NOT EXISTS business_categories (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        code        TEXT    NOT NULL UNIQUE,
        name        TEXT    NOT NULL,
        description TEXT,
        status      TEXT    NOT NULL DEFAULT 'Active', -- Active | PendingConfirmation
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Seed primary categories (idempotent)
    const insert = db.prepare(`
      INSERT OR IGNORE INTO business_categories (code, name, description, status, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    insert.run('SOLAR_ROOFTOP',   'Solar Rooftop',          'On-grid, Off-grid and Hybrid rooftop solar PV systems', 'Active', 1);
    insert.run('SOLAR_STREETLIGHT','Solar Street Light',     'Solar-powered street and area lighting systems',         'Active', 2);
    insert.run('SOLAR_WATERPUMP', 'Solar Water Pump',       'Solar-powered agricultural and domestic water pumps',    'Active', 3);
    insert.run('SOLAR_CCTV',      'Solar CCTV Camera',      'Solar-powered surveillance camera systems',              'Active', 4);
    insert.run('SOLAR_IC',        'Solar I & C Service',    'Installation and Commissioning service (awaiting owner confirmation of interpretation)', 'Active', 5);
    // Pending confirmation
    insert.run('SOLAR_FENCING',   'Solar Fencing',          'Solar electric fencing (DOCX reference — pending owner confirmation)', 'PendingConfirmation', 6);
    insert.run('SOLAR_AMC',       'Solar Water Heater / AMC','Solar water heater and annual maintenance (PDF reference — pending owner confirmation)', 'PendingConfirmation', 7);

    // Add business_category column to core tables (additive)
    const addCol = (table: string) => {
      const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
      if (!cols.includes('business_category')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN business_category TEXT;`);
      }
    };
    ['leads', 'products', 'packages', 'quotations', 'projects'].forEach(addCol);

    // Add system_type to packages and quotations
    const addSysType = (table: string) => {
      const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
      if (!cols.includes('system_type')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN system_type TEXT;`); // On-grid | Off-grid | Hybrid | N/A
      }
    };
    ['packages', 'quotations'].forEach(addSysType);
  },
};

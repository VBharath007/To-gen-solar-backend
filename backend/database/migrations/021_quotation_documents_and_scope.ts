import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 021 – Quotation required documents, scope responsibilities, and site photos
 *
 * Creates:
 *   quotation_documents : typed customer ID, PAN, EB, and Bank details
 *   quotation_scope     : customer scope responsibilities checklist & special notes
 *   quotation_site_photos : site photos (up to 3 photos max, customer choice)
 */
export const migration021: Migration = {
  version: 21,
  name: '021_quotation_documents_and_scope',

  up(db: Database.Database): void {
    // 1. Required Documents
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotation_documents (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id         INTEGER NOT NULL UNIQUE,
        aadhar_number        TEXT,
        aadhar_name          TEXT,
        pan_number           TEXT,
        pan_name             TEXT,
        eb_consumer_number   TEXT,
        eb_tariff            TEXT,
        bank_account_no      TEXT,
        bank_ifsc            TEXT,
        bank_name            TEXT,
        bank_account_holder  TEXT,
        email_id             TEXT,
        alt_email            TEXT,
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      );
    `);

    // 2. Customer Scope
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotation_scope (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id         INTEGER NOT NULL UNIQUE,
        notes                TEXT,
        roof_access          INTEGER NOT NULL DEFAULT 1,
        water_supply         INTEGER NOT NULL DEFAULT 1,
        power_point          INTEGER NOT NULL DEFAULT 1,
        shadow_free          INTEGER NOT NULL DEFAULT 1,
        internet_available   INTEGER NOT NULL DEFAULT 0,
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      );
    `);

    // 3. Site Photos (Max 3 photos)
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotation_site_photos (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id         INTEGER NOT NULL,
        photo_order          INTEGER NOT NULL DEFAULT 1,
        name                 TEXT,
        size                 TEXT,
        data_url             TEXT NOT NULL,
        caption              TEXT,
        uploaded_at          TEXT,
        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      );
    `);
  },
};

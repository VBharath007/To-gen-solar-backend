import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration006: Migration = {
  version: 6,
  name: '006_surveys',

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS site_surveys (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id      INTEGER NOT NULL,
        site_id          INTEGER NOT NULL,
        survey_date      TEXT    NOT NULL,
        status           TEXT    NOT NULL DEFAULT 'Scheduled', -- Scheduled, Completed, Cancelled
        roof_type        TEXT,
        roof_area_sqft   REAL,
        electrical_phase TEXT,   -- Single, Three
        notes            TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY(site_id) REFERENCES installation_sites(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS site_surveys_updated_at
      AFTER UPDATE ON site_surveys
      FOR EACH ROW
      BEGIN
        UPDATE site_surveys SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

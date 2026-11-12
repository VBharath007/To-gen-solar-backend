import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 025 – Survey cancellation reason
 */
export const migration025: Migration = {
  version: 25,
  name: '025_survey_cancellation_reason',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(site_surveys)').all() as { name: string }[]).map(c => c.name);
    if (!cols.includes('cancellation_reason')) {
      db.exec('ALTER TABLE site_surveys ADD COLUMN cancellation_reason TEXT;');
    }
  },
};

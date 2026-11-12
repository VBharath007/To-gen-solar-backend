import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 023 – Remove quotation_documents table
 *
 * Deprecates and completely drops the old quotation_documents table.
 * Old required documents are no longer stored in the database.
 */
export const migration023: Migration = {
  version: 23,
  name: '023_remove_quotation_documents',

  up(db: Database.Database): void {
    db.exec(`DROP TABLE IF EXISTS quotation_documents;`);
  },
};

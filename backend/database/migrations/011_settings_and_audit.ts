import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration011: Migration = {
  version: 11,
  name: '011_settings_and_audit',

  up(db: Database.Database): void {
    // 1. Application settings store (key-value JSON configuration)
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // 2. Audit logs for critical operations (profile/business changes, storage migration, backups)
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        action      TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id   TEXT,
        details     TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // 3. Add business_snapshot columns to quotations and invoices if not already present
    const quotationColumns = db.prepare(`PRAGMA table_info(quotations)`).all() as { name: string }[];
    const hasQuotationSnapshot = quotationColumns.some((col) => col.name === 'business_snapshot');
    if (!hasQuotationSnapshot) {
      db.exec(`ALTER TABLE quotations ADD COLUMN business_snapshot TEXT;`);
    }

    const invoiceColumns = db.prepare(`PRAGMA table_info(invoices)`).all() as { name: string }[];
    const hasInvoiceSnapshot = invoiceColumns.some((col) => col.name === 'business_snapshot');
    if (!hasInvoiceSnapshot) {
      db.exec(`ALTER TABLE invoices ADD COLUMN business_snapshot TEXT;`);
    }

    // 4. Seed initial default settings if empty
    const checkSetting = db.prepare(`SELECT key FROM app_settings WHERE key = ?`);

    if (!checkSetting.get('user_profile')) {
      const defaultProfile = JSON.stringify({
        displayName: 'Administrator',
        email: 'admin@togen.solar',
        phoneNumber: '+91 98765 43210',
      });
      db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`).run('user_profile', defaultProfile);
    }

    if (!checkSetting.get('business_info')) {
      const defaultBusiness = JSON.stringify({
        businessName: 'TO-GEN SOLAR AGRO PRIVATE LIMITED',
        businessEmail: 'contact@togensolar.com',
        primaryPhone: '+91 94433 12345',
        alternatePhone: '+91 98422 67890',
        address: 'No. 45, Solar Energy Park, Trichy Road, Coimbatore, Tamil Nadu - 641018',
        gstin: '33AABCT1234A1Z5',
        logoPath: '',
      });
      db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`).run('business_info', defaultBusiness);
    }

    if (!checkSetting.get('backup_config')) {
      const defaultBackup = JSON.stringify({
        autoBackupEnabled: true,
        intervalHours: 24,
        lastBackupTime: undefined,
        nextBackupTime: undefined,
        lastStatus: undefined,
      });
      db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`).run('backup_config', defaultBackup);
    }
  },
};

import type Database from 'better-sqlite3';
import { migration001, type Migration } from './001_initial_schema';
import { migration002 } from './002_installation_sites';
import { migration003 } from './003_projects';
import { migration004 } from './004_products';
import { migration005 } from './005_packages';
import { migration006 } from './006_surveys';
import { migration007 } from './007_quotations';
import { migration008 } from './008_invoices';
import { migration009 } from './009_payments';
import { migration010 } from './010_leads';
import { migration011 } from './011_settings_and_audit';
import { migration012 } from './012_customer_extended_fields';
import { migration013 } from './013_site_electricity_fields';
import { migration014 } from './014_business_categories';
import { migration015 } from './015_products_extended';
import { migration016 } from './016_invoice_lines_sequences';
import { migration017 } from './017_payments_advance_allocation';
import { migration018 } from './018_quotation_technical_details';
import { migration019 } from './019_customer_company_and_alternate_phone';
import { migration020 } from './020_quotation_manual_customer';
import { migration021 } from './021_quotation_documents_and_scope';
import { migration022 } from './022_quotation_technical_fields_sync';
import { migration023 } from './023_remove_quotation_documents';
import { migration024 } from './024_installation_site_extended_fields';
import { migration025 } from './025_survey_cancellation_reason';
import { migration026 } from './026_quotation_unique_reference';
import { migration027 } from './027_project_unique_reference';
import { migration028 } from './028_quotation_7_day_expiry';
import { migration029 } from './029_phone_duplicate_prevention';
import { migration030 } from './030_product_inventory_and_tax';
import { migration031 } from './031_allow_converted_leads';
import { migration032 } from './032_quotation_subsidies';
import { migration033 } from './033_quotation_bank_account';
import { migration034 } from './034_update_quote_validity_default';
import { migration035 } from './035_quotation_battery_fields';
import { migration036 } from './036_quotation_category_technical_fields';
import { migration037 } from './037_quotation_water_pump_structure_fields';
import { migration038 } from './038_customer_business_category';
import { migration039 } from './039_invoice_bank_account';
import { migration040 } from './040_invoice_line_tax_type';

/**
 * All migrations in strict ascending version order.
 * To add a migration: create the file, import it, and append it to this array.
 */
const ALL_MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
  migration014,
  migration015,
  migration016,
  migration017,
  migration018,
  migration019,
  migration020,
  migration021,
  migration022,
  migration023,
  migration024,
  migration025,
  migration026,
  migration027,
  migration028,
  migration029,
  migration030,
  migration031,
  migration032,
  migration033,
  migration034,
  migration035,
  migration036,
  migration037,
  migration038,
  migration039,
  migration040,
];


/**
 * Runs every migration that has not yet been recorded in schema_migrations.
 *
 * This function is:
 * - Idempotent: safe to call on every application startup.
 * - Transactional: each migration is applied inside a transaction; a failure
 *   rolls back that migration and the error is re-thrown.
 */
export function runMigrations(db: Database.Database): void {
  // Bootstrap the tracking table before querying it
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedVersions = new Set<number>(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version,
    ),
  );

  const insertMigration = db.prepare<[number, string]>(
    'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
  );

  const prevFK = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');

  for (const migration of ALL_MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    db.transaction(() => {
      migration.up(db);
      insertMigration.run(migration.version, migration.name);
    })();

    console.info(`[Migration] Applied v${migration.version}: ${migration.name}`);
  }
  
  if (prevFK) {
    db.pragma('foreign_keys = ON');
  }
}

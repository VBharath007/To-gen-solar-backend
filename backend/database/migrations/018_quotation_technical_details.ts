import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 018 – Quotation technical details + package BOM extension
 *
 * Creates:
 *   quotation_technical_details : category-specific technical fields per quotation
 *
 * Adds to quotations:
 *   tax_inclusive, validity_days, quotation_type, notes_internal
 *   project_type (Residential | Commercial | Industrial | Agricultural)
 *
 * Adds to quotation_items:
 *   hsn_sac, taxable_value, cgst_rate, sgst_rate, igst_rate, tax_amount_line
 *   quantity_basis (fixed | as_required), quantity_notes
 *
 * Adds to packages:
 *   business_category already added in 014; adds bom_version, import_source, import_status
 */
export const migration018: Migration = {
  version: 18,
  name: '018_quotation_technical_details',
  up(db: Database.Database): void {

    // Technical details (one row per quotation)
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotation_technical_details (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        quotation_id         INTEGER NOT NULL UNIQUE,

        -- Solar Rooftop
        use_type             TEXT,  -- Residential | Commercial | Industrial
        dc_capacity_kwp      REAL,
        ac_capacity_kw       REAL,
        panel_count          INTEGER,
        panel_wattage_w      REAL,
        inverter_capacity_kw REAL,
        battery_count        INTEGER,
        battery_ah           REAL,
        battery_v            REAL,
        mounting_structure   TEXT,  -- Aluminium Rail | GI Elevated | Rooftop Flush | Ground Mount
        connection_type      TEXT,  -- On-grid | Off-grid | Hybrid
        roof_area_sqft       REAL,
        shadow_free_sqft     REAL,
        tilt_angle_deg       REAL,
        orientation          TEXT,

        -- Solar Street Light
        luminaire_wattage_w  REAL,
        pole_height_m        REAL,
        pole_type            TEXT,
        sl_panel_w           REAL,
        sl_battery_ah        REAL,

        -- Solar Water Pump
        pump_hp              REAL,
        pump_rating_kw       REAL,
        vfd_model            TEXT,
        head_m               REAL,
        flow_lph             REAL,
        pump_phase           TEXT,
        pump_panel_count     INTEGER,

        -- Solar CCTV
        camera_count         INTEGER,
        camera_model         TEXT,
        recording_type       TEXT,  -- DVR | NVR | Cloud
        storage_days         INTEGER,
        connectivity         TEXT,  -- WiFi | LAN | 4G

        -- I&C Service
        service_description  TEXT,
        service_date_from    TEXT,
        service_date_to      TEXT,
        labour_count         INTEGER,
        labour_unit          TEXT,
        labour_rate          INTEGER,  -- paise per unit

        -- Common
        supply_scope         TEXT,   -- Supply Only | Installation Only | Supply & Installation
        exclusions           TEXT,   -- free text

        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
      );
    `);

    // Add extra fields to quotations
    const qcols = (db.prepare('PRAGMA table_info(quotations)').all() as { name: string }[]).map(c => c.name);
    const qadd = (col: string, def: string) => { if (!qcols.includes(col)) db.exec(`ALTER TABLE quotations ADD COLUMN ${col} ${def};`); };
    qadd('tax_inclusive',     'BOOLEAN NOT NULL DEFAULT 0');
    qadd('validity_days',     'INTEGER NOT NULL DEFAULT 10');
    qadd('quotation_type',    `TEXT NOT NULL DEFAULT 'Quotation'`); // Quotation | Proforma Invoice
    qadd('project_type',      'TEXT');   // Residential | Commercial | Industrial | Agricultural
    qadd('notes_internal',    'TEXT');
    qadd('locked_at',         'TEXT');   // issued time; financial fields read-only after this

    // Add extra fields to quotation_items
    const qicols = (db.prepare('PRAGMA table_info(quotation_items)').all() as { name: string }[]).map(c => c.name);
    const qiadd = (col: string, def: string) => { if (!qicols.includes(col)) db.exec(`ALTER TABLE quotation_items ADD COLUMN ${col} ${def};`); };
    qiadd('hsn_sac',           'TEXT');
    qiadd('taxable_value',     'INTEGER');   // paise; backend computed
    qiadd('cgst_rate',         'REAL NOT NULL DEFAULT 0');
    qiadd('sgst_rate',         'REAL NOT NULL DEFAULT 0');
    qiadd('igst_rate',         'REAL NOT NULL DEFAULT 0');
    qiadd('tax_amount_line',   'INTEGER NOT NULL DEFAULT 0');
    qiadd('quantity_basis',    `TEXT NOT NULL DEFAULT 'fixed'`);  // fixed | as_required
    qiadd('quantity_notes',    'TEXT');

    // Add extra fields to packages
    const pcols = (db.prepare('PRAGMA table_info(packages)').all() as { name: string }[]).map(c => c.name);
    const padd = (col: string, def: string) => { if (!pcols.includes(col)) db.exec(`ALTER TABLE packages ADD COLUMN ${col} ${def};`); };
    padd('bom_version',    'INTEGER NOT NULL DEFAULT 1');
    padd('import_source',  'TEXT');   // e.g. 'DOCX_2024_TEMPLATE'
    padd('import_status',  `TEXT NOT NULL DEFAULT 'Active'`); // Active | Draft | PendingReview

    // Add quantity_basis to package_items
    const picols = (db.prepare('PRAGMA table_info(package_items)').all() as { name: string }[]).map(c => c.name);
    if (!picols.includes('quantity_basis')) db.exec(`ALTER TABLE package_items ADD COLUMN quantity_basis TEXT NOT NULL DEFAULT 'fixed';`);
    if (!picols.includes('quantity_notes')) db.exec(`ALTER TABLE package_items ADD COLUMN quantity_notes TEXT;`);

    // Document center: replace localStorage with SQLite
    db.exec(`
      CREATE TABLE IF NOT EXISTS crm_documents (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        title        TEXT    NOT NULL,
        category     TEXT    NOT NULL,
        status       TEXT    NOT NULL DEFAULT 'Draft',
        customer_id  INTEGER,
        project_id   INTEGER,
        quotation_id INTEGER,
        invoice_id   INTEGER,
        file_path    TEXT,       -- relative to data root
        file_type    TEXT,
        file_size    INTEGER,
        version      TEXT    NOT NULL DEFAULT 'v1.0',
        uploaded_by  TEXT,
        description  TEXT,
        source       TEXT    NOT NULL DEFAULT 'User', -- User | AutoGen | PDF Export
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(customer_id)  REFERENCES customers(id)  ON DELETE SET NULL,
        FOREIGN KEY(project_id)   REFERENCES projects(id)   ON DELETE SET NULL,
        FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
        FOREIGN KEY(invoice_id)   REFERENCES invoices(id)   ON DELETE SET NULL
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS crm_documents_updated_at
      AFTER UPDATE ON crm_documents FOR EACH ROW
      BEGIN
        UPDATE crm_documents SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  },
};

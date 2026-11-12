import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

/**
 * Migration 030 – Products inventory, GST breakdown, specs, and starter catalog
 *
 * 1. Adds missing columns to `products` table:
 *    cgst_rate, sgst_rate, igst_rate, warranty_years, datasheet_url,
 *    is_inventory_tracked, current_stock, minimum_stock, sku, barcode,
 *    dimensions_mm, weight_kg
 *
 * 2. Seeds standard solar industry starter products if products table is empty.
 */
export const migration030: Migration = {
  version: 30,
  name: '030_product_inventory_and_tax',
  up(db: Database.Database): void {
    const cols = (db.prepare('PRAGMA table_info(products)').all() as { name: string }[]).map(c => c.name);
    const add = (col: string, def: string) => {
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE products ADD COLUMN ${col} ${def};`);
      }
    };

    add('cgst_rate',             'REAL');
    add('sgst_rate',             'REAL');
    add('igst_rate',             'REAL');
    add('warranty_years',        'REAL');
    add('datasheet_url',         'TEXT');
    add('is_inventory_tracked',  'BOOLEAN NOT NULL DEFAULT 0');
    add('current_stock',         'REAL NOT NULL DEFAULT 0');
    add('minimum_stock',         'REAL NOT NULL DEFAULT 0');
    add('sku',                   'TEXT');
    add('barcode',               'TEXT');
    add('dimensions_mm',         'TEXT');
    add('weight_kg',             'REAL');

    // Seed starter solar products if table is currently empty
    const countRow = db.prepare('SELECT count(*) as count FROM products').get() as { count: number };
    if (countRow.count === 0) {
      const insert = db.prepare(`
        INSERT INTO products (
          category, brand, model, specs, unit, price, tax_rate,
          component_type, hsn_sac, cgst_rate, sgst_rate, igst_rate,
          warranty_years, is_inventory_tracked, current_stock, minimum_stock
        )
        VALUES (
          @category, @brand, @model, @specs, @unit, @price, @tax_rate,
          @component_type, @hsn_sac, @cgst_rate, @sgst_rate, @igst_rate,
          @warranty_years, @is_inventory_tracked, @current_stock, @minimum_stock
        )
      `);

      const starterProducts = [
        {
          category: 'Solar Panel',
          brand: 'Tata Power Solar',
          model: 'TP-545W-MONO',
          specs: '545W Mono PERC Half-Cut Solar PV Module',
          unit: 'Pieces',
          price: 1350000, // 13,500 INR in paise
          tax_rate: 12,
          component_type: 'Panel',
          hsn_sac: '85414300',
          cgst_rate: 6,
          sgst_rate: 6,
          igst_rate: 12,
          warranty_years: 25,
          is_inventory_tracked: 1,
          current_stock: 50,
          minimum_stock: 10,
        },
        {
          category: 'Solar Panel',
          brand: 'Adani Solar',
          model: 'AS-540W-BIFACIAL',
          specs: '540W Bifacial Dual Glass High Efficiency PV Module',
          unit: 'Pieces',
          price: 1420000, // 14,200 INR in paise
          tax_rate: 12,
          component_type: 'Panel',
          hsn_sac: '85414300',
          cgst_rate: 6,
          sgst_rate: 6,
          igst_rate: 12,
          warranty_years: 25,
          is_inventory_tracked: 1,
          current_stock: 40,
          minimum_stock: 10,
        },
        {
          category: 'Inverter',
          brand: 'Growatt',
          model: 'MIN 5000TL-X',
          specs: '5kW Single Phase Dual MPPT On-Grid Solar Inverter',
          unit: 'Pieces',
          price: 4200000, // 42,000 INR in paise
          tax_rate: 12,
          component_type: 'Inverter',
          hsn_sac: '85044090',
          cgst_rate: 6,
          sgst_rate: 6,
          igst_rate: 12,
          warranty_years: 5,
          is_inventory_tracked: 1,
          current_stock: 10,
          minimum_stock: 2,
        },
        {
          category: 'Inverter',
          brand: 'Deye',
          model: 'SUN-5K-SG03LP1',
          specs: '5kW Hybrid Solar Inverter with 48V Battery Support',
          unit: 'Pieces',
          price: 7800000, // 78,000 INR in paise
          tax_rate: 12,
          component_type: 'Inverter',
          hsn_sac: '85044090',
          cgst_rate: 6,
          sgst_rate: 6,
          igst_rate: 12,
          warranty_years: 5,
          is_inventory_tracked: 1,
          current_stock: 5,
          minimum_stock: 2,
        },
        {
          category: 'Battery',
          brand: 'Exide Solar',
          model: 'Tubular 150Ah',
          specs: '12V 150Ah C10 Deep Cycle Solar Tubular Battery',
          unit: 'Pieces',
          price: 1550000, // 15,500 INR in paise
          tax_rate: 18,
          component_type: 'Battery',
          hsn_sac: '85072000',
          cgst_rate: 9,
          sgst_rate: 9,
          igst_rate: 18,
          warranty_years: 5,
          is_inventory_tracked: 1,
          current_stock: 20,
          minimum_stock: 4,
        },
        {
          category: 'Structure',
          brand: 'ToGen Standard',
          model: 'HDG-ROOF-STRUCTURE',
          specs: 'Elevated Hot Dip Galvanized Iron Solar Mounting Structure',
          unit: 'kW',
          price: 350000, // 3,500 INR per kW in paise
          tax_rate: 18,
          component_type: 'Structure',
          hsn_sac: '73089090',
          cgst_rate: 9,
          sgst_rate: 9,
          igst_rate: 18,
          warranty_years: 10,
          is_inventory_tracked: 0,
          current_stock: 100,
          minimum_stock: 10,
        },
        {
          category: 'Cabling',
          brand: 'Polycab',
          model: '4sqmm-DC-RED-BLK',
          specs: '4 sq.mm Tinned Copper 1500V UV Resistant Solar DC Cable',
          unit: 'Meters',
          price: 4500, // 45 INR per meter in paise
          tax_rate: 18,
          component_type: 'Cable',
          hsn_sac: '85444999',
          cgst_rate: 9,
          sgst_rate: 9,
          igst_rate: 18,
          warranty_years: 5,
          is_inventory_tracked: 1,
          current_stock: 500,
          minimum_stock: 100,
        },
        {
          category: 'Accessories',
          brand: 'ToGen Protection',
          model: 'ACDB-DCDB-1PH',
          specs: 'Single Phase ACDB + DCDB Box with Type II SPD & MCB Protection',
          unit: 'Pieces',
          price: 650000, // 6,500 INR in paise
          tax_rate: 18,
          component_type: 'Accessory',
          hsn_sac: '85371000',
          cgst_rate: 9,
          sgst_rate: 9,
          igst_rate: 18,
          warranty_years: 2,
          is_inventory_tracked: 1,
          current_stock: 15,
          minimum_stock: 3,
        },
      ];

      for (const p of starterProducts) {
        insert.run(p);
      }
    }
  },
};

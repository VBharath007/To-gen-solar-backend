import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration034: Migration = {
  version: 34,
  name: '034_update_quote_validity_default',
  up(db: Database.Database): void {
    db.prepare(`
      UPDATE quotations
      SET payment_terms = replace(payment_terms, '10 Days from the date of submission', '7 Days from the date of submission')
      WHERE payment_terms LIKE '%10 Days from the date of submission%'
    `).run();
    db.prepare(`
      UPDATE quotations
      SET payment_terms = replace(payment_terms, 'Within 10 Days from the date of receipt of the Purchase Order', 'Within 7 Days from the date of receipt of the Purchase Order')
      WHERE payment_terms LIKE '%Within 10 Days from the date of receipt of the Purchase Order%'
    `).run();

    try {
      const row = db.prepare("SELECT value FROM app_settings WHERE key = 'business_info'").get() as { value: string } | undefined;
      let b: any = {};
      if (row?.value) {
        b = JSON.parse(row.value);
      }
      b.businessName = 'TO-GEN SOLAR AGRO';
      b.address = '3/584-H, Mathur Village, Velliyankundram Group Via, Alagarkoil, Madurai – 625301';
      b.gstin = '33BJWPA4500M1Z6';
      b.primaryPhone = '+91 63803 29294';
      db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('business_info', ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(JSON.stringify(b));
    } catch {}
  },
};

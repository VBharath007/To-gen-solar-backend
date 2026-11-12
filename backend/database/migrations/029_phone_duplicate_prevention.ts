import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';
import { normalizePhoneNumber } from '@shared/utils/phone';

export const migration029: Migration = {
  version: 29,
  name: '029_phone_duplicate_prevention',

  up(db: Database.Database): void {
    // 1. Normalize existing phone numbers in customers table
    const customers = db.prepare('SELECT id, phone FROM customers').all() as { id: number; phone: string }[];
    const updateCustomerPhone = db.prepare('UPDATE customers SET phone = ? WHERE id = ?');
    for (const c of customers) {
      const normalized = normalizePhoneNumber(c.phone);
      if (normalized && normalized !== c.phone) {
        updateCustomerPhone.run(normalized, c.id);
      }
    }

    // 2. Normalize existing phone numbers in leads table
    const leads = db.prepare('SELECT id, phone FROM leads').all() as { id: number; phone: string }[];
    const updateLeadPhone = db.prepare('UPDATE leads SET phone = ? WHERE id = ?');
    for (const l of leads) {
      const normalized = normalizePhoneNumber(l.phone);
      if (normalized && normalized !== l.phone) {
        updateLeadPhone.run(normalized, l.id);
      }
    }

    // 3. Create unique index on customers.phone to prevent duplicate customers at the DB engine level
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    `);

    // 4. Create unique index on leads.phone to prevent duplicate leads at the DB engine level
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
    `);

    // 5. Trigger: prevent inserting a customer whose phone already exists in leads
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_customer_no_dup_lead_insert
      BEFORE INSERT ON customers
      FOR EACH ROW
      WHEN EXISTS (SELECT 1 FROM leads WHERE phone = NEW.phone)
      BEGIN
        SELECT RAISE(ABORT, 'This phone number is already registered as a Lead.');
      END;
    `);

    // 6. Trigger: prevent updating a customer to a phone that already exists in leads
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_customer_no_dup_lead_update
      BEFORE UPDATE OF phone ON customers
      FOR EACH ROW
      WHEN EXISTS (SELECT 1 FROM leads WHERE phone = NEW.phone)
      BEGIN
        SELECT RAISE(ABORT, 'This phone number is already registered as a Lead.');
      END;
    `);

    // 7. Trigger: prevent inserting a lead whose phone already exists in customers
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_lead_no_dup_customer_insert
      BEFORE INSERT ON leads
      FOR EACH ROW
      WHEN EXISTS (SELECT 1 FROM customers WHERE phone = NEW.phone)
      BEGIN
        SELECT RAISE(ABORT, 'This phone number is already registered as a Customer.');
      END;
    `);

    // 8. Trigger: prevent updating a lead to a phone that already exists in customers
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_lead_no_dup_customer_update
      BEFORE UPDATE OF phone ON leads
      FOR EACH ROW
      WHEN EXISTS (SELECT 1 FROM customers WHERE phone = NEW.phone)
      BEGIN
        SELECT RAISE(ABORT, 'This phone number is already registered as a Customer.');
      END;
    `);
  },
};

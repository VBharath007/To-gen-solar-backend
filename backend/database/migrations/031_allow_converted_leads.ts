import type Database from 'better-sqlite3';
import { type Migration } from './001_initial_schema';

export const migration031: Migration = {
  version: 31,
  name: '031_allow_converted_leads',

  up(db: Database.Database): void {
    // Drop old triggers
    db.exec(`DROP TRIGGER IF EXISTS trg_customer_no_dup_lead_insert;`);
    db.exec(`DROP TRIGGER IF EXISTS trg_customer_no_dup_lead_update;`);
    db.exec(`DROP TRIGGER IF EXISTS trg_lead_no_dup_customer_insert;`);
    db.exec(`DROP TRIGGER IF EXISTS trg_lead_no_dup_customer_update;`);

    // 1. Trigger: prevent inserting a customer whose phone already exists in an ACTIVE lead
    db.exec(`
      CREATE TRIGGER trg_customer_no_dup_lead_insert
      BEFORE INSERT ON customers
      FOR EACH ROW
      WHEN EXISTS (SELECT 1 FROM leads WHERE phone = NEW.phone AND status != 'Converted')
      BEGIN
        SELECT RAISE(ABORT, 'This phone number is already registered as an active Lead.');
      END;
    `);

    // 2. Trigger: prevent updating a customer to a phone that already exists in an ACTIVE lead
    db.exec(`
      CREATE TRIGGER trg_customer_no_dup_lead_update
      BEFORE UPDATE OF phone ON customers
      FOR EACH ROW
      WHEN EXISTS (SELECT 1 FROM leads WHERE phone = NEW.phone AND status != 'Converted')
      BEGIN
        SELECT RAISE(ABORT, 'This phone number is already registered as an active Lead.');
      END;
    `);

    // 3. Trigger: prevent inserting a lead whose phone already exists in customers
    // (This remains unchanged, you can't create a lead for an existing customer)
    db.exec(`
      CREATE TRIGGER trg_lead_no_dup_customer_insert
      BEFORE INSERT ON leads
      FOR EACH ROW
      WHEN EXISTS (SELECT 1 FROM customers WHERE phone = NEW.phone)
      BEGIN
        SELECT RAISE(ABORT, 'This phone number is already registered as a Customer.');
      END;
    `);

    // 4. Trigger: prevent updating a lead to a phone that already exists in customers
    db.exec(`
      CREATE TRIGGER trg_lead_no_dup_customer_update
      BEFORE UPDATE OF phone ON leads
      FOR EACH ROW
      WHEN EXISTS (SELECT 1 FROM customers WHERE phone = NEW.phone)
      BEGIN
        SELECT RAISE(ABORT, 'This phone number is already registered as a Customer.');
      END;
    `);
  },
};

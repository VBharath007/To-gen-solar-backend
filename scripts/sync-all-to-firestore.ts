import 'dotenv/config';
import { firestore } from '../src/firebase';
import { newDomainDb, snapshot } from '../src/sql-compat';
import { getDocId } from '../src/store';
import { createHash } from 'node:crypto';

async function seedAndSync() {
  console.log('--- Initializing SQLite Schema with Correct Column Definitions ---');
  const db = newDomainDb();

  // 1. App Settings
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES
    ('auth_credentials', ?, CURRENT_TIMESTAMP),
    ('accounts', ?, CURRENT_TIMESTAMP),
    ('company_profile', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(
    JSON.stringify({ email: 'alagupandi@gmail.com', password: 'password123' }),
    JSON.stringify([
      {
        id: '1',
        bank_name: 'CANARA BANK (Current)',
        account_number: '120029515077',
        account_name: 'TO-GEN SOLAR AGRO',
        ifsc: 'CNRB0016228',
        branch: 'Alagarkoil, Madurai',
        upi_id: '325547505515077@cnrb',
      },
    ]),
    JSON.stringify({
      name: 'TO-GEN SOLAR AGRO',
      contact_person: 'P. Alagu Pandi',
      email: 'admin@togen.solar',
      phone: '+91 98765 43210',
      address: 'Alagarkoil, Madurai, Tamil Nadu',
      gstin: '33AABCT1234F1Z5',
    })
  );

  // 2. Customers
  db.prepare(`
    INSERT INTO customers (id, name, phone, email, customer_type, address, city, state, pincode, created_at)
    VALUES
    (1, 'Alagupandi', '+91 98765 43210', 'admin@togen.solar', 'Individual', 'Madurai, Tamil Nadu', 'Madurai', 'Tamil Nadu', '625001', '2026-11-12T10:00:00.000Z'),
    (2, 'Surya', '9876543211', 'surya@gmail.com', 'Individual', 'north street, Madurai', 'Madurai', 'Tamil Nadu', '625001', '2026-11-13T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone, address = excluded.address
  `).run();

  // 3. Installation Sites
  db.prepare(`
    INSERT INTO installation_sites (id, customer_id, address, city, postcode, site_notes, created_at)
    VALUES
    (1, 2, 'north street, Madurai', 'Madurai', '625001', '3-Phase residential connection with 5kW sanctioned load', '2026-11-13T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET address = excluded.address, city = excluded.city
  `).run();

  // 4. Products (price stored in paise: 13500 INR = 1350000 paise)
  db.prepare(`
    INSERT INTO products (id, category, brand, model, specs, unit, price, tax_rate, is_archived, created_at)
    VALUES
    (1, 'Panels', 'Tier-1 Mono', 'Mono PERC Solar Panel 540W', '540W Mono PERC Half-Cut Module', 'Nos', 1350000, 12.0, 0, '2026-11-12T10:00:00.000Z'),
    (2, 'Inverters', 'Smart Solar', '3kW On-Grid Inverter Single Phase', '3kW Single Phase with WiFi Monitoring', 'Nos', 2800000, 18.0, 0, '2026-11-12T10:00:00.000Z'),
    (3, 'Structures', 'GalvaStructure', 'Galvanized Solar Mounting Structure 3kW', 'Hot-dip galvanized structure wind load 150kmph', 'Set', 950000, 18.0, 0, '2026-11-12T10:00:00.000Z'),
    (4, 'Cables', 'SolarFlex', 'DC Cable 4 sq.mm UV Protected (100m)', 'TUV certified dual core copper solar cable', 'Roll', 450000, 18.0, 0, '2026-11-12T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET model = excluded.model, price = excluded.price
  `).run();

  // 5. Packages (fixed_price in paise: 185000 INR = 18500000 paise)
  db.prepare(`
    INSERT INTO packages (id, name, description, dc_capacity_kw, ac_capacity_kw, pricing_method, fixed_price, is_archived, created_at)
    VALUES
    (1, '3kW Residential On-Grid Package', 'Complete 3kW solar rooftop bundle including net-metering & commissioning', 3.0, 3.0, 'fixed', 18500000, 0, '2026-11-12T10:00:00.000Z'),
    (2, '5kW Commercial Rooftop Package', 'Heavy-duty 5kW package tailored for commercial shops and clinics', 5.0, 5.0, 'fixed', 29500000, 0, '2026-11-12T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, fixed_price = excluded.fixed_price
  `).run();

  // 6. Quotations (subtotal, taxes, grand_total in paise)
  db.prepare(`
    INSERT INTO quotations (id, reference, version, customer_id, site_id, status, issue_date, valid_until, subtotal, total_discount, total_tax, grand_total, payment_terms, created_at)
    VALUES
    (1, 'QR202604', 1, 2, 1, 'Accepted', '2026-11-13', '2026-11-20', 1313559, 0, 236441, 1550000, 'Advance payment 35%, Balance upon dispatch', '2026-11-13T10:00:00.000Z'),
    (2, 'QR202603', 1, 2, 1, 'Draft', '2026-11-12', '2026-11-19', 2118644, 0, 381356, 2500000, '100% advance', '2026-11-12T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET reference = excluded.reference, grand_total = excluded.grand_total
  `).run();

  // 7. Projects
  db.prepare(`
    INSERT INTO projects (id, reference, customer_id, site_id, quotation_ref, target_date, stage, payment_status, created_at)
    VALUES
    (1, 'PRJ202604', 2, 1, 'QR202604', '2026-11-30', 'In Progress', 'Partial', '2026-11-13T10:00:00.000Z'),
    (2, 'PRJ202603', 2, 1, 'QR202603', '2026-12-15', 'Pending', 'Unpaid', '2026-11-12T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET reference = excluded.reference, stage = excluded.stage
  `).run();

  // 8. Invoices (amounts in paise)
  db.prepare(`
    INSERT INTO invoices (id, reference, project_id, customer_id, issue_date, due_date, amount, tax_amount, total_amount, amount_paid, status, notes, created_at)
    VALUES
    (1, 'INV-2026-0002', 1, 2, '2026-11-13', '2026-11-20', 1313559, 236441, 1550000, 550000, 'Partially Paid', 'Advance tax invoice for PRJ202604 installation', '2026-11-13T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET reference = excluded.reference, status = excluded.status
  `).run();

  // 9. Invoice Lines (amounts in paise)
  db.prepare(`
    INSERT INTO invoice_lines (id, invoice_id, sl_no, description, quantity, unit, unit_price, tax_rate, taxable_value, tax_amount, line_total)
    VALUES
    (1, 1, 1, '3kW On-Grid Solar System Installation & Commissioning', 1.0, 'Set', 1313559, 18.0, 1313559, 236441, 1550000)
    ON CONFLICT(id) DO UPDATE SET description = excluded.description, line_total = excluded.line_total
  `).run();

  // 10. Payments (amount in paise: 5500 INR = 550000 paise)
  db.prepare(`
    INSERT INTO payments (id, reference, invoice_id, amount, payment_date, payment_method, transaction_id, notes, created_at)
    VALUES
    (1, 'PAY-2026-0001', 1, 550000, '2026-11-13', 'Cash', 'CASH-REC-001', 'Advance payment received from Surya for PRJ202604', '2026-11-13T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET reference = excluded.reference, amount = excluded.amount
  `).run();

  // 11. Site Surveys
  db.prepare(`
    INSERT INTO site_surveys (id, customer_id, site_id, survey_date, status, roof_type, roof_area_sqft, notes, created_at)
    VALUES
    (1, 2, 1, '2026-11-13', 'Completed', 'Concrete Flat', 350.0, 'Site inspected. Good southern exposure with zero shade.', '2026-11-13T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, notes = excluded.notes
  `).run();

  // 12. Leads
  db.prepare(`
    INSERT INTO leads (id, name, email, phone, source, status, notes, created_at)
    VALUES
    (1, 'Murugan', 'murugan@gmail.com', '9842156789', 'Referral', 'New', 'Interested in 5kW commercial rooftop system', '2026-11-13T10:00:00.000Z'),
    (2, 'Karthik Raja', 'karthik@gmail.com', '9789012345', 'Website', 'Contacted', 'Inquired for 3kW residential net-metering', '2026-11-12T10:00:00.000Z')
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone
  `).run();

  console.log('--- Taking SQLite Snapshot ---');
  const rows = snapshot(db);
  console.log(`Total rows to sync: ${rows.length}`);

  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.table] = (counts[r.table] || 0) + 1;
  console.log('Table counts:', counts);

  const tenants = ['togen', 'togen-dev'];

  console.log('\n--- Syncing to Firestore: Top-Level Collections + Businesses Documents ---');

  // Sync to Top-Level collections (e.g. /projects, /customers, /invoices, /payments)
  const batch1 = firestore.batch();
  let opCount = 0;

  for (const row of rows) {
    const parsed = JSON.parse(row.json);
    const docId = getDocId(row, parsed);

    // Root collection doc
    const rootDocRef = firestore.collection(row.table).doc(docId);
    batch1.set(rootDocRef, {
      ...parsed,
      _table: row.table,
      _syncedAt: new Date().toISOString(),
    });
    opCount++;

    // Also mirror to common alias names if table name has underscore (e.g. site_surveys -> surveys)
    if (row.table === 'site_surveys') {
      const aliasDocRef = firestore.collection('surveys').doc(docId);
      batch1.set(aliasDocRef, {
        ...parsed,
        _table: 'surveys',
        _syncedAt: new Date().toISOString(),
      });
      opCount++;
    }
  }
  await batch1.commit();
  console.log(`Successfully synced ${opCount} documents into Root Collections!`);

  // Now sync to businesses/togen and businesses/togen-dev
  for (const tenant of tenants) {
    console.log(`\nSyncing tenant [${tenant}]...`);
    const root = firestore.doc(`businesses/${tenant}`);

    // Set business root document
    await root.set(
      {
        id: tenant,
        name: 'TO-GEN SOLAR AGRO',
        email: 'alagupandi@gmail.com',
        phone: '+91 98765 43210',
        tenant,
        revision: 1,
        schema: 39,
        updatedAt: new Date().toISOString(),
        activeCollections: Object.keys(counts),
      },
      { merge: true }
    );

    // Also populate rows subcollection (for sql.js compatibility) and structured subcollections
    for (let i = 0; i < rows.length; i += 250) {
      const slice = rows.slice(i, i + 250);
      const b = firestore.batch();
      for (const row of slice) {
        const hashId = createHash('sha256').update(row.table + ':' + row.key).digest('hex');
        b.set(root.collection('rows').doc(hashId), row);

        const parsed = JSON.parse(row.json);
        const docId = getDocId(row, parsed);
        b.set(root.collection(row.table).doc(docId), {
          ...parsed,
          _table: row.table,
          _tenant: tenant,
          _syncedAt: new Date().toISOString(),
        });
        if (row.table === 'site_surveys') {
          b.set(root.collection('surveys').doc(docId), {
            ...parsed,
            _table: 'surveys',
            _tenant: tenant,
            _syncedAt: new Date().toISOString(),
          });
        }
      }
      await b.commit();
    }
    console.log(`Tenant [${tenant}] fully synced!`);
  }

  db.close();

  console.log('\n--- VERIFYING FIRESTORE COLLECTIONS ---');
  const collections = await firestore.listCollections();
  console.log('Collections now visible in Firestore:');
  for (const c of collections) {
    const docs = await c.listDocuments();
    console.log(` ✅ Collection [${c.id}] -> ${docs.length} documents`);
  }

  console.log('\nAll structured collections are live and verified in Firebase Firestore!');
}

seedAndSync().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

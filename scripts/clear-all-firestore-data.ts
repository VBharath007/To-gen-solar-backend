import 'dotenv/config';
import { firestore } from '../src/firebase';
import { newDomainDb, snapshot } from '../src/sql-compat';

async function clearData() {
  console.log('=== CLEARING ALL SAMPLE / DEFAULT DATA FROM FIRESTORE ===');

  // List of collections to completely clear
  const collectionsToClear = [
    'projects',
    'customers',
    'invoices',
    'invoice_lines',
    'payments',
    'quotations',
    'products',
    'packages',
    'surveys',
    'site_surveys',
    'leads',
    'installation_sites',
    'document_sequences',
    'sqlite_sequence',
    'business_categories',
    'schema_migrations',
  ];

  for (const colName of collectionsToClear) {
    try {
      const colRef = firestore.collection(colName);
      const docs = await colRef.listDocuments();
      if (docs.length > 0) {
        const batch = firestore.batch();
        for (const doc of docs) {
          batch.delete(doc);
        }
        await batch.commit();
        console.log(`🧹 Cleared ${docs.length} documents from root collection [${colName}]`);
      } else {
        console.log(`ℹ️ Root collection [${colName}] is already empty.`);
      }
    } catch (err: any) {
      console.warn(`Warning clearing collection ${colName}:`, err.message);
    }
  }

  // Handle app_settings: keep ONLY auth_credentials
  console.log('\n--- Resetting app_settings (preserving only auth_credentials) ---');
  try {
    const settingsCol = firestore.collection('app_settings');
    const settingDocs = await settingsCol.listDocuments();
    for (const doc of settingDocs) {
      if (doc.id !== 'auth_credentials') {
        await doc.delete();
        console.log(`Deleted setting: ${doc.id}`);
      }
    }
    // Ensure auth_credentials document exists
    await settingsCol.doc('auth_credentials').set({
      key: 'auth_credentials',
      value: JSON.stringify({ email: 'alagupandi@gmail.com', password: 'password123' }),
      updated_at: new Date().toISOString(),
    });
    console.log('✅ app_settings reset: only auth_credentials kept for login.');
  } catch (err: any) {
    console.error('Error resetting app_settings:', err);
  }

  // Handle businesses tenants: togen & togen-dev
  console.log('\n--- Resetting businesses data to clean 0-data state ---');
  const tenants = ['togen', 'togen-dev'];

  // Create a brand new clean blank SQLite DB
  const cleanDb = newDomainDb();
  // Insert auth_credentials so backend auth functions smoothly
  cleanDb.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('auth_credentials', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(JSON.stringify({ email: 'alagupandi@gmail.com', password: 'password123' }));

  const cleanRows = snapshot(cleanDb);
  cleanDb.close();

  console.log(`Clean DB snapshot has ${cleanRows.length} internal schema rows (0 user records).`);

  for (const tenant of tenants) {
    const root = firestore.doc(`businesses/${tenant}`);

    // Clean all subcollections under business document
    const subcols = await root.listCollections();
    for (const sub of subcols) {
      const subDocs = await sub.listDocuments();
      if (subDocs.length > 0) {
        // delete in batches of 300
        for (let i = 0; i < subDocs.length; i += 300) {
          const slice = subDocs.slice(i, i + 300);
          const b = firestore.batch();
          for (const d of slice) b.delete(d);
          await b.commit();
        }
        console.log(`🧹 Cleared ${subDocs.length} docs from businesses/${tenant}/${sub.id}`);
      }
    }

    // Set business document
    await root.set({
      id: tenant,
      name: 'TO-GEN SOLAR AGRO',
      email: 'alagupandi@gmail.com',
      tenant,
      revision: 1,
      schema: 39,
      updatedAt: new Date().toISOString(),
      status: 'Clean 0-data instance ready for manual entry',
    });

    // Populate rows subcollection with only clean schema rows
    const hash = (await import('node:crypto')).createHash;
    for (let i = 0; i < cleanRows.length; i += 250) {
      const slice = cleanRows.slice(i, i + 250);
      const b = firestore.batch();
      for (const row of slice) {
        const id = hash('sha256').update(row.table + ':' + row.key).digest('hex');
        b.set(root.collection('rows').doc(id), row);
      }
      await b.commit();
    }
    console.log(`✅ Tenant [${tenant}] reset with 0 data.`);
  }

  console.log('\n=== VERIFYING FINAL FIRESTORE STATE ===');
  const collections = await firestore.listCollections();
  for (const c of collections) {
    const docs = await c.listDocuments();
    console.log(`Collection [${c.id}] -> ${docs.length} documents`);
    if (docs.length > 0 && docs.length <= 5) {
      console.log(`   Docs: ${docs.map(d => d.id).join(', ')}`);
    }
  }

  console.log('\n🎉 ALL SAMPLE DATA HAS BEEN REMOVED! App is now at clean 0-data state!');
  console.log('Now, whatever you manually create from the app will be the ONLY data in Firebase.');
}

clearData().catch(err => {
  console.error('Failed to clear data:', err);
  process.exit(1);
});

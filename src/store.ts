import { createHash } from 'node:crypto';
import { firestore } from './firebase';
import { domainContext } from '../backend/database/connection';
import { hydrate, newDomainDb, snapshot, SavedRow, MemoryDomainDb } from './sql-compat';

const id = (r: SavedRow) => createHash('sha256').update(r.table + ':' + r.key).digest('hex');

export function getDocId(row: SavedRow, parsed: any): string {
  if (row.table === 'app_settings' && parsed.key) return String(parsed.key);
  if (row.table === 'invoices' && (parsed.invoice_number || parsed.id)) {
    return String(parsed.invoice_number || parsed.id);
  }
  if (row.table === 'projects' && (parsed.reference_number || parsed.id)) {
    return String(parsed.reference_number || parsed.id);
  }
  if (row.table === 'quotations' && (parsed.quote_number || parsed.id)) {
    return String(parsed.quote_number || parsed.id);
  }
  if (row.table === 'payments' && (parsed.payment_number || parsed.id)) {
    return String(parsed.payment_number || parsed.id);
  }
  if (parsed.id !== undefined && parsed.id !== null) return String(parsed.id);
  if (parsed.key !== undefined && parsed.key !== null) return String(parsed.key);
  if (parsed.code !== undefined && parsed.code !== null) return String(parsed.code);
  if (parsed.name !== undefined && parsed.name !== null && typeof parsed.name === 'string' && parsed.name.length < 50) return parsed.name;

  let k = String(row.key);
  if (k.startsWith('[') && k.endsWith(']')) {
    try {
      const arr = JSON.parse(k);
      if (Array.isArray(arr) && arr.length === 1) return String(arr[0]);
    } catch (_) {}
  }
  return k.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface CachedTenantDb {
  revision: number;
  dbBytes: Uint8Array;
  lastChecked: number;
}
const tenantCache = new Map<string, CachedTenantDb>();

/** Fast-path for read-only queries avoiding Firestore transaction locks and redundant row re-hydration */
export async function domainRead(tenant: string, operation: () => any) {
  const root = firestore.doc(`businesses/${tenant}`);
  const now = Date.now();
  const cached = tenantCache.get(tenant);

  // Fast path: if cached within last 5 seconds, run immediately in-memory (0ms Firestore delay)
  if (cached && (now - cached.lastChecked < 5000)) {
    const db = new MemoryDomainDb(cached.dbBytes);
    try {
      return await domainContext.run(db, operation);
    } finally {
      db.close();
    }
  }

  const metadata = await root.get();
  if (metadata.get('importing')) throw new Error('Business data migration is in progress');
  const currentRevision = (metadata.get('revision') || 0) as number;

  if (cached && cached.revision === currentRevision) {
    cached.lastChecked = now;
    const db = new MemoryDomainDb(cached.dbBytes);
    try {
      return await domainContext.run(db, operation);
    } finally {
      db.close();
    }
  }

  let db: MemoryDomainDb;
  if (metadata.exists) {
    const existing = await root.collection('rows').get();
    if (existing.size > 20000) throw new Error('Compatibility workspace exceeds 20,000 rows; partition before continuing');
    const rows = existing.docs.map(d => d.data() as SavedRow);
    db = hydrate(rows);
  } else {
    const fallbackTenant = tenant === 'togen-dev' ? 'togen' : 'togen-dev';
    const fallbackRoot = firestore.doc(`businesses/${fallbackTenant}`);
    const fallbackMeta = await fallbackRoot.get();
    if (fallbackMeta.exists) {
      const existing = await fallbackRoot.collection('rows').get();
      const rows = existing.docs.map(d => d.data() as SavedRow);
      db = hydrate(rows);
    } else {
      db = newDomainDb();
    }
  }

  try {
    const dbBytes = db.raw.export();
    tenantCache.set(tenant, {
      revision: currentRevision,
      dbBytes,
      lastChecked: now,
    });
  } catch (_) {}

  try {
    return await domainContext.run(db, operation);
  } finally {
    db.close();
  }
}

/** All domain writes commit together. A revision lock serializes requests across server instances. */
export async function domainCall(tenant: string, operation: () => any, requestId?: string, fingerprint?: string) {
  return firestore.runTransaction(async tx => {
    const root = firestore.doc(`businesses/${tenant}`);
    const metadata = await tx.get(root);
    if (metadata.get('importing')) throw new Error('Business data migration is in progress');
    const request = requestId ? root.collection('requests').doc(requestId) : null;
    if (request) {
      const previous = await tx.get(request);
      if (previous.exists) {
        if (previous.get('fingerprint') !== fingerprint) throw new Error('Request key already used for different data');
        return JSON.parse(previous.get('response'));
      }
    }
    const existing = await tx.get(root.collection('rows'));
    if (existing.size > 20000) throw new Error('Compatibility workspace exceeds 20,000 rows; partition before continuing');
    const before = new Map(existing.docs.map(d => [d.id, d.data() as SavedRow]));
    const db = metadata.exists ? hydrate([...before.values()]) : newDomainDb();
    try {
      const result = await domainContext.run(db, operation);
      if (result?.success === false) return result; // discard every partial mutation on business failure
      const after = snapshot(db);
      const updates: any[] = [];
      for (const row of after) {
        if (Buffer.byteLength(row.json) > 800000) throw new Error('Record exceeds safe size; upload attachments in Documents');
        const key = id(row), old = before.get(key);
        if (!old || old.json !== row.json) updates.push({ key, row });
        before.delete(key);
      }
      if (Buffer.byteLength(JSON.stringify(updates)) > 7000000) throw new Error('Operation exceeds atomic compatibility size limit (7 MB)');
      for (const { key, row } of updates) {
        tx.set(root.collection('rows').doc(key), row);
        try {
          const parsed = JSON.parse(row.json);
          const docId = getDocId(row, parsed);
          const structuredData = {
            ...parsed,
            _table: row.table,
            _tenant: tenant,
            _syncedAt: new Date().toISOString(),
          };
          // 1. Top-level structured collection in Firestore (e.g. /projects/1, /customers/1)
          tx.set(firestore.collection(row.table).doc(docId), structuredData);
          // 2. Also inside the business document as structured subcollection (e.g. /businesses/togen/projects/1)
          tx.set(root.collection(row.table).doc(docId), structuredData);
        } catch (err) {
          console.warn(`[Firestore] Failed to mirror row to structured collection: ${row.table}`, err);
        }
      }
      for (const [key, oldRow] of before.entries()) {
        tx.delete(root.collection('rows').doc(key));
        try {
          const parsed = JSON.parse(oldRow.json);
          const docId = getDocId(oldRow, parsed);
          tx.delete(firestore.collection(oldRow.table).doc(docId));
          tx.delete(root.collection(oldRow.table).doc(docId));
        } catch (_) {}
      }
      const newRev = (metadata.get('revision') || 0) + (updates.length || before.size || !metadata.exists ? 1 : 0);
      tx.set(root, {
        id: tenant,
        name: 'TO-GEN SOLAR AGRO',
        email: 'alagupandi@gmail.com',
        tenant,
        revision: newRev,
        schema: 39,
        updatedAt: new Date(),
        activeCollections: [
          'projects',
          'customers',
          'invoices',
          'invoice_lines',
          'payments',
          'quotations',
          'products',
          'packages',
          'surveys',
          'leads',
          'installation_sites',
          'app_settings',
        ],
      }, { merge: true });
      if (request) tx.create(request, { fingerprint, response: JSON.stringify(result ?? null), createdAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000) });

      try {
        const dbBytes = db.raw.export();
        tenantCache.set(tenant, {
          revision: newRev,
          dbBytes,
          lastChecked: Date.now(),
        });
      } catch (_) {}

      return result;
    } finally {
      db.close();
    }
  });
}

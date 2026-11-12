import { createHash } from 'node:crypto';
import { firestore } from './firebase';
import { domainContext } from '../backend/database/connection';
import { hydrate, newDomainDb, snapshot, SavedRow, MemoryDomainDb } from './sql-compat';

const id = (r: SavedRow) => createHash('sha256').update(r.table + ':' + r.key).digest('hex');

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
    db = newDomainDb();
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
      for (const { key, row } of updates) tx.set(root.collection('rows').doc(key), row);
      for (const key of before.keys()) tx.delete(root.collection('rows').doc(key));
      const newRev = (metadata.get('revision') || 0) + (updates.length || before.size || !metadata.exists ? 1 : 0);
      if (updates.length || before.size || !metadata.exists) tx.set(root, { revision: newRev, schema: 39 }, { merge: true });
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

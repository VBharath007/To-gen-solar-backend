/** Request-local SQL execution, NOT persistent storage. Firestore owns every saved row. */
import initSqlJs from 'sql.js';
import { runMigrations } from '../backend/database/migrations';
export const SQL = await initSqlJs();
export class MemoryDomainDb {
  raw: any;
  depth = 0;
  constructor(bytes?: Uint8Array) { this.raw = new SQL.Database(bytes); }
  exec(sql: string) { this.raw.run(sql); return this; }
  prepare<T = any>(sql: string) {
    const execute = (args: any[], mode: string) => {
      let params: any = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
        params = Object.fromEntries(Object.entries(args[0]).flatMap(([k,v]) => ['@',':','$'].map(prefix => [prefix+k,v === undefined ? null : typeof v === 'boolean' ? +v : v])));
      }
      if (Array.isArray(params)) params = params.map(v => v === undefined ? null : typeof v === 'boolean' ? +v : v);
      const stmt = this.raw.prepare(sql);
      try {
        stmt.bind(params);
        const rows: any[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        if (mode === 'run') return { changes: this.raw.getRowsModified(), lastInsertRowid: this.raw.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0 };
        return mode === 'get' ? rows[0] : rows;
      } finally { stmt.free(); }
    };
    return { all: (...args: any[]) => execute(args,'all'), get: (...args: any[]) => execute(args,'get'), run: (...args: any[]) => execute(args,'run') };
  }
  pragma(sql: string, options?: any) { const rows = this.prepare('PRAGMA '+sql).all(); return options?.simple ? Object.values(rows[0] || {})[0] : rows; }
  transaction(fn: (...args:any[])=>any) {
    return (...args:any[]) => {
      const name = 'domain_'+(++this.depth);
      this.exec('SAVEPOINT '+name);
      try { const result=fn(...args); this.exec('RELEASE '+name); return result; }
      catch(e) { this.exec('ROLLBACK TO '+name); this.exec('RELEASE '+name); throw e; }
      finally { this.depth--; }
    };
  }
  get open() { return !!this.raw; }
  close() { this.raw.close(); this.raw=null; }
}
const schema = new MemoryDomainDb();
runMigrations(schema as any);
schema.pragma('foreign_keys=ON');
const blank = schema.raw.export();
schema.close();
export function newDomainDb() { const db=new MemoryDomainDb(blank); db.pragma('foreign_keys=ON'); return db; }
export type SavedRow = { table: string; key: string; json: string };
const quote = (v:string) => '"'+v.replaceAll('"','""')+'"';
export function snapshot(db:MemoryDomainDb): SavedRow[] {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' UNION SELECT 'sqlite_sequence'").all().flatMap(({name}:any) => {
    const primary=db.prepare('PRAGMA table_info('+quote(name)+')').all().filter((c:any)=>c.pk).sort((a:any,b:any)=>a.pk-b.pk).map((c:any)=>c.name);
    if(name==='sqlite_sequence')primary.push('name');
    return db.prepare(`SELECT rowid AS __rid, * FROM ${quote(name)}`).all().map((record:any) => {
      const {__rid,...row}=record;
      return {table:name,key:primary.length?JSON.stringify(primary.map((k:string)=>row[k])):String(__rid),json:JSON.stringify(row)};
    });
  });
}
export function hydrate(rows:SavedRow[]) {
  const db = newDomainDb();
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r:any)=>r.name));
  const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
  db.pragma('foreign_keys=OFF');
  for(const t of triggers) db.exec('DROP TRIGGER '+quote(t.name));
  db.transaction(()=>{
    for(const name of tables) db.exec('DELETE FROM '+quote(String(name)));
    for(const r of rows.filter(row=>row.table!=='sqlite_sequence')) {
      if(!tables.has(r.table)) throw new Error('Unknown imported table: '+r.table);
      const value=JSON.parse(r.json), keys=Object.keys(value);
      db.prepare(`INSERT INTO ${quote(r.table)} (${keys.map(quote).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(keys.map(k=>value[k]));
    }
    db.exec('DELETE FROM sqlite_sequence');
    for(const r of rows.filter(row=>row.table==='sqlite_sequence')) { const value=JSON.parse(r.json); db.prepare('INSERT INTO sqlite_sequence(name,seq) VALUES(?,?)').run(value.name,value.seq); }
  })();
  for(const t of triggers) db.exec(t.sql);
  db.pragma('foreign_keys=ON');
  if(db.pragma('foreign_key_check').length) throw new Error('Imported data contains broken relationships');
  return db;
}

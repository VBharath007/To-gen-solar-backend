/** Read-only source migration. Never imports credentials or modifies the desktop file. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MemoryDomainDb,snapshot,hydrate} from '../src/sql-compat';
import {runMigrations} from '../backend/database/migrations';
const args=process.argv.slice(2),source=args[0],tenant=args[1];
if(!source||!tenant||!/^[A-Za-z0-9_-]{1,80}$/.test(tenant))throw new Error('Usage: npm run migrate -- database.sqlite NEW_BUSINESS_ID [--commit] [--browser=browser-export.json]');
const bytes=readFileSync(source);if(!bytes.length)throw new Error('Source database is empty. Export the actual desktop app backup; do not migrate the empty database.sqlite from the source ZIP.');let rows:any[];
if(source.endsWith('.json')){
 const backup=JSON.parse(bytes.toString());if(backup.format!=='togen-firestore-v1'||backup.schema!==39)throw new Error('Unsupported backup');rows=backup.rows;const db=hydrate(rows);db.close();
}else{
 const db=new MemoryDomainDb(bytes);
 try{runMigrations(db as any);if(db.pragma('integrity_check')[0]?.integrity_check!=='ok')throw new Error('Source integrity check failed');if(db.pragma('foreign_key_check').length)throw new Error('Source has broken references');
 const browserPath=args.find(x=>x.startsWith('--browser='))?.slice(10);
 if(browserPath){const exportData=JSON.parse(readFileSync(browserPath,'utf8'));for(const [oldKey,newKey]of Object.entries({togen_bank_accounts_data:'accounts',togen_solar_crm_documents_v1:'documents'})){
  const list=typeof exportData[oldKey]==='string'?JSON.parse(exportData[oldKey]):exportData[oldKey];
  if(list){if(!Array.isArray(list))throw new Error('Browser export must contain arrays');db.prepare("INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(newKey,JSON.stringify(list));}
 }
 const mapping=exportData.togen_invoice_bank_map;if(mapping){const map=typeof mapping==='string'?JSON.parse(mapping):mapping;for(const[id,bank]of Object.entries(map))db.prepare('UPDATE invoices SET bank_account_id=? WHERE id=?').run(bank,Number(id));}
 }
 rows=snapshot(db);
 }finally{db.close();}
}
if(rows.length>20000)throw new Error('More than 20,000 rows: requires partitioned repository migration');
for(const row of rows)if(Buffer.byteLength(row.json)>800000)throw new Error(`Large record in ${row.table}; move embedded attachments to Storage before migration`);
const counts:any={};for(const row of rows)counts[row.table]=(counts[row.table]||0)+1;
const report={sourceSha256:createHash('sha256').update(bytes).digest('hex'),target:tenant,rows:rows.length,counts,committed:false};
writeFileSync('migration-report.json',JSON.stringify(report,null,2));console.log(report);
if(args.includes('--commit')){
 const {firestore}=await import('../src/firebase');const root=firestore.doc(`businesses/${tenant}`);
 // create() rejects any existing business, including failed partial imports.
 await root.create({importing:true,schema:39,revision:0});
 try{
  for(let i=0;i<rows.length;i+=300){const batch=firestore.batch();for(const row of rows.slice(i,i+300)){const id=createHash('sha256').update(row.table+':'+row.key).digest('hex');batch.create(root.collection('rows').doc(id),row);}await batch.commit();}
  const saved=await root.collection('rows').get();if(saved.size!==rows.length)throw new Error('Destination count mismatch');
  const expected=new Map(rows.map(r=>[createHash('sha256').update(r.table+':'+r.key).digest('hex'),r.json]));
  for(const d of saved.docs)if(expected.get(d.id)!==d.get('json'))throw new Error('Destination hash mismatch');
  await root.update({importing:false,revision:1,sourceSha256:report.sourceSha256});
  report.committed=true;writeFileSync('migration-report.json',JSON.stringify(report,null,2));console.log('Migration verified. Source unchanged.');
 }catch(e){console.error('Target remains blocked as importing. Use a NEW target ID after correcting the cause.');throw e;}
}else console.log('Dry run only. Review migration-report.json, then add --commit.');

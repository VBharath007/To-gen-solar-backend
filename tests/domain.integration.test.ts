import {describe,it,expect} from 'vitest';
import {newDomainDb,hydrate,snapshot} from '../src/sql-compat';
import {domainContext} from '../backend/database/connection';
import {operations} from '../src/operations';
const run=async(fn:any)=>{const db=newDomainDb();try{return await domainContext.run(db,()=>fn(db));}finally{db.close();}};
const good=(r:any)=>{expect(r.success,JSON.stringify(r)).toBe(true);return r.data;};
describe('Migrated domain end-to-end',()=>{
 it('retains phone duplicate rules, lead conversion and category',async()=>run(async()=>{
  const lead=good(await operations['leads.create']({name:'Test Lead',phone:'9876543210',business_category:'SOLAR_ROOFTOP'}));
  const dup=await operations['customers.create']({name:'Duplicate',phone:'+91 9876543210'});expect(dup.success).toBe(false);
  good(await operations['leads.update']({id:lead.id,status:'Converted'}));
  const customers=good(await operations['customers.list']());expect(customers).toHaveLength(1);expect(customers[0].business_category).toBe('SOLAR_ROOFTOP');
 }));
 it('preserves invoice totals, receipt balances, delete reversal, and row hydration',async()=>run(async(db:any)=>{
  const c=good(await operations['customers.create']({name:'Payment Test',phone:'9123456789'}));
  const invoice=good(operations['invoices.create']({customer_id:c.id,issue_date:'2026-10-21',due_date:'2026-10-28',status:'Sent',lines:[{description:'Panel',quantity:2,unit:'Nos',unit_price:100000,discount:10,tax_rate:18}]}));
  expect(invoice.total_amount).toBe(212400);
  const receipt=good(operations['receipts.create']({customer_id:c.id,invoice_id:invoice.id,amount:100000,payment_date:'2026-10-21',payment_method:'Cash'}));
  expect(good(operations['invoices.get'](invoice.id)).amount_paid).toBe(100000);
  const restored=hydrate(snapshot(db));
  expect(restored.prepare('SELECT amount_paid FROM invoices WHERE id=?').get(invoice.id).amount_paid).toBe(100000);restored.close();
  good(operations['receipts.delete'](receipt.id));expect(good(operations['invoices.get'](invoice.id)).amount_paid).toBe(0);
 }));
 it('retains quotation discount and manual tax semantics and 100% cap',async()=>run(async()=>{
  const dto={items:[{item_type:'Custom',name:'Panel',item_id:null,quantity:1,unit_price:100000,discount:0,tax_rate:18,total:118000}],discount_percent:2,manual_tax_rate:23};
  const result=good(operations['quotations.calculate'](dto));expect(result.grand_total).toBe(121000);expect(result.total_tax).toBe(23000);
  expect(()=>operations['quotations.calculate']({...dto,discount_percent:101})).toThrow();
 }));
 it('persists generated sequence values across Firestore row hydration',async()=>run(async(db:any)=>{
  const c=good(await operations['customers.create']({name:'First',phone:'9123456789'}));
  const restored=hydrate(snapshot(db));
  try {await domainContext.run(restored,async()=>{const next=good(await operations['customers.create']({name:'Second',phone:'9234567890'}));expect(next.id).toBeGreaterThan(c.id);});}finally{restored.close();}
 }));
 it('supports all customer types (Individual, Company, Commercial, Industrial, Agricultural, Government, Other)', async () => run(async () => {
  const types = ['Individual', 'Company', 'Commercial', 'Industrial', 'Agricultural', 'Government', 'Other'];
  let phoneBase = 9500000000;
  for (const t of types) {
   const created = good(await operations['customers.create']({
    name: `Customer ${t}`,
    phone: String(phoneBase++),
    customer_type: t,
    company_name: t !== 'Individual' ? `${t} Pvt Ltd` : null,
   }));
   expect(created.customer_type).toBe(t);
   const fetched = good(await operations['customers.get'](created.id));
   expect(fetched.customer_type).toBe(t);
  }
 }));
});

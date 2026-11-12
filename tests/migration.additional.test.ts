import {describe,it,expect} from 'vitest';
import {newDomainDb,hydrate,snapshot} from '../src/sql-compat';
import {domainContext} from '../backend/database/connection';
import {operations} from '../src/operations';
const good=(r:any)=>{expect(r.success,JSON.stringify(r)).toBe(true);return r.data;};
describe('Cross-module migration regression',()=>{
 it('preserves stable snapshots without changing records during hydration',()=>{
  const db=newDomainDb(),rows=snapshot(db),next=hydrate(rows);
  const sort=(list:any[])=>list.sort((a,b)=>(a.table+a.key).localeCompare(b.table+b.key));
  expect(sort(snapshot(next))).toEqual(sort(rows));db.close();next.close();
 });
 it('creates customer, site, survey, product, package, quotation and project',async()=>{
  const db=newDomainDb();try{await domainContext.run(db,async()=>{
   const c=good(await operations['customers.create']({name:'Solar Client',phone:'9876501234'}));
   const site=good(await operations['sites.create']({customerId:c.id,address:'Solar Road',city:'Madurai'}));
   good(operations['surveys.create']({customer_id:c.id,site_id:site.id,survey_date:'2026-10-22'}));
   const product=good(operations['products.create']({category:'Panel',brand:'Test',model:'550W',specs:'550W Mono',unit:'Nos',price:100000}));
   good(operations['packages.create']({name:'3kW',pricing_method:'fixed',fixed_price:500000,items:[{product_id:product.id,quantity:6}]}));
   const quote=good(operations['quotations.create']({customer_id:c.id,site_id:site.id,status:'Accepted',business_category:'SOLAR_ROOFTOP',items:[{item_type:'Product',item_id:product.id,name:'Panel',quantity:6,unit_price:100000,discount:0,tax_rate:5,total:630000}],discount_percent:0}));
   expect(quote.grand_total).toBe(630000);
   const project=good(operations['projects.create']({customer_id:c.id,site_id:site.id,quotation_ref:quote.reference}));
   expect(project.reference).toBeTruthy();
   const reload=hydrate(snapshot(db));expect(reload.prepare('SELECT COUNT(*) as count FROM projects').get().count).toBe(1);reload.close();
  });}finally{db.close();}
 });
 it('allocates an advance and rejects allocation exceeding the remaining amount',async()=>{
  const db=newDomainDb();try{await domainContext.run(db,async()=>{
   const c=good(await operations['customers.create']({name:'Advance Client',phone:'9876501234'}));
   const inv=good(operations['invoices.create']({customer_id:c.id,issue_date:'2026-10-21',due_date:'2026-10-28',lines:[{description:'Solar',quantity:1,unit:'Nos',unit_price:100000,tax_rate:0,discount:0}]}));
   const receipt=good(operations['receipts.create']({customer_id:c.id,amount:60000,payment_type:'Advance',payment_date:'2026-10-21',payment_method:'Cash'}));
   good(operations['receipts.allocate']({receipt_id:receipt.id,invoice_id:inv.id,allocated_amount:40000}));
   expect(good(operations['receipts.get'](receipt.id)).unallocated).toBe(20000);
   expect(good(operations['invoices.get'](inv.id)).amount_paid).toBe(40000);
   expect(operations['receipts.allocate']({receipt_id:receipt.id,invoice_id:inv.id,allocated_amount:30000}).success).toBe(false);
  });}finally{db.close();}
 });
});

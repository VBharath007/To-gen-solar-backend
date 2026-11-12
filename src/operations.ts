import { CustomerService } from '../backend/modules/customers/customer.service';
import { LeadService } from '../backend/modules/leads/lead.service';
import { InstallationSiteService } from '../backend/modules/customers/installation-site.service';
import { getDb } from '../backend/database/connection';
import { ok, fail } from '../shared/types/api-response.types';
import { calculateQuotation } from './calculations';
import { enrichProjectAnalytics, calculateReportsSummary } from './features/reports/report.analytics';
import { randomUUID } from 'node:crypto';
import * as projects from '../backend/services/project.service';
import * as products from '../backend/services/product.service';
import * as packages from '../backend/services/package.service';
import * as surveys from '../backend/services/survey.service';
import * as quotations from '../backend/services/quotation.service';
import * as invoices from '../backend/services/invoice.service';
import * as payments from '../backend/services/payment.service';
import * as settings from '../backend/services/settings.service';
import { getDashboardMetrics } from '../backend/services/dashboard.service';
import * as categories from '../backend/services/category.service';
const customers=new CustomerService(), leads=new LeadService(), sites=new InstallationSiteService();
export const operations: Record<string,(...args:any[])=>any> = {
 'customers.list': (...a)=>(customers.listCustomers as any)(...a),
 'customers.get': (...a)=>(customers.getCustomer as any)(...a),
 'customers.create': (...a)=>(customers.createCustomer as any)(...a),
 'customers.update': (...a)=>(customers.updateCustomer as any)(...a),
 'customers.delete': (...a)=>(customers.deleteCustomer as any)(...a),
 'leads.list': (...a)=>(leads.listLeads as any)(...a),
 'leads.get': (...a)=>(leads.getLead as any)(...a),
 'leads.create': (...a)=>(leads.createLead as any)(...a),
 'leads.update': (...a)=>(leads.updateLead as any)(...a),
 'leads.delete': (...a)=>(leads.deleteLead as any)(...a),
 'sites.listByCustomer': (...a)=>(sites.listByCustomer as any)(...a),
 'sites.get': (...a)=>(sites.getSite as any)(...a),
 'sites.create': (...a)=>(sites.createSite as any)(...a),
 'sites.update': (...a)=>(sites.updateSite as any)(...a),
 'sites.delete': (...a)=>(sites.deleteSite as any)(...a),
 'sites.list': async()=>{const rows=getDb().prepare('SELECT id FROM installation_sites ORDER BY id DESC').all();return ok(await Promise.all(rows.map(async(r:any)=>(await sites.getSite(r.id) as any).data)));},
 'projects.list': (...a)=>(projects.listProjects as any)(...a),
 'projects.get': (...a)=>(projects.getProject as any)(...a),
 'projects.create': (...a)=>(projects.createProject as any)(...a),
 'projects.update': (...a)=>(projects.updateProject as any)(...a),
 'projects.delete': (...a)=>(projects.deleteProject as any)(...a),
 'products.list': (...a)=>(products.listProducts as any)(...a),
 'products.get': (...a)=>(products.getProduct as any)(...a),
 'products.create': (...a)=>(products.createProduct as any)(...a),
 'products.update': (...a)=>(products.updateProduct as any)(...a),
 'products.delete': (...a)=>(products.deleteProduct as any)(...a),
 'packages.list': (...a)=>(packages.listPackages as any)(...a),
 'packages.get': (...a)=>(packages.getPackage as any)(...a),
 'packages.create': (...a)=>(packages.createPackage as any)(...a),
 'packages.update': (...a)=>(packages.updatePackage as any)(...a),
 'packages.delete': (...a)=>(packages.deletePackage as any)(...a),
 'surveys.list': (...a)=>(surveys.listSurveys as any)(...a),
 'surveys.get': (...a)=>(surveys.getSurvey as any)(...a),
 'surveys.create': (...a)=>(surveys.createSurvey as any)(...a),
 'surveys.update': (...a)=>(surveys.updateSurvey as any)(...a),
 'surveys.delete': (...a)=>(surveys.deleteSurvey as any)(...a),
 'quotations.list': (...a)=>(quotations.listQuotations as any)(...a),
 'quotations.get': (...a)=>(quotations.getQuotation as any)(...a),
 'quotations.create': (...a)=>(quotations.createQuotation as any)(...a),
 'quotations.update': (...a)=>(quotations.updateQuotation as any)(...a),
 'quotations.delete': (...a)=>(quotations.deleteQuotation as any)(...a),
 'invoices.list': (...a)=>(invoices.listInvoices as any)(...a),
 'invoices.get': (...a)=>(invoices.getInvoice as any)(...a),
 'invoices.create': (...a)=>(invoices.createInvoice as any)(...a),
 'invoices.update': (...a)=>(invoices.updateInvoice as any)(...a),
 'invoices.delete': (...a)=>(invoices.deleteInvoice as any)(...a),
 'payments.list': (...a)=>(payments.listPayments as any)(...a),
 'payments.get': (...a)=>(payments.getPayment as any)(...a),
 'payments.create': (...a)=>(payments.createPayment as any)(...a),
 'payments.update': (...a)=>(payments.updatePayment as any)(...a),
 'payments.delete': (...a)=>(payments.deletePayment as any)(...a),
 'products.archive': (...a)=>(products.setProductArchiveStatus as any)(...a),
 'packages.archive': (...a)=>(packages.setPackageArchiveStatus as any)(...a),
 'receipts.list': (...a)=>(payments.listReceipts as any)(...a),
 'receipts.get': (...a)=>(payments.getReceipt as any)(...a),
 'receipts.create': (...a)=>(payments.createReceipt as any)(...a),
 'receipts.allocate': (...a)=>(payments.allocateAdvance as any)(...a),
 'receipts.unallocated': (...a)=>(payments.listUnallocatedAdvances as any)(...a),
 'receipts.update': (...a)=>(payments.updatePayment as any)(...a),
 'receipts.delete': (...a)=>(payments.deletePayment as any)(...a),
 'finance.outstanding': payments.listOutstandingBalances,
 'finance.byCustomer': invoices.getOutstandingByCustomer,
 'dashboard.metrics': getDashboardMetrics,
 'categories.list': categories.listCategories,
 'categories.active': categories.listActiveCategories,
 'settings.all': settings.getAllSettings,
 'settings.profile': settings.updateUserProfile,
 'settings.business': settings.updateBusinessInfo,
 'settings.icPricing': settings.updateIcPricingConfig,
 'settings.getIcPricing': settings.getIcPricingConfig,
 'quotations.calculate': (dto)=>ok(calculateQuotation(dto)),
 'reports.list': ()=>{const r=projects.listProjects();return r.success ? ok(enrichProjectAnalytics(r.data)) : r;},
 'reports.summary': ()=>{const r=projects.listProjects();return r.success ? ok(calculateReportsSummary(enrichProjectAnalytics(r.data))) : r;},
};
const DEFAULT_COMPANY_ACCOUNTS = [
  {
    id: 'acc-canara',
    accountName: 'CANARA BANK',
    bankName: 'Canara Bank',
    branch: 'Alagarkoil, Madurai',
    branchName: 'Alagarkoil, Madurai',
    accountHolder: 'TO-GEN SOLAR AGRO',
    accountNumber: '120029515077',
    ifscCode: 'CNRB0016228',
    type: 'Current',
    upiId: '325547505515077@cnrb',
    notes: 'Official Canara Bank collection account with designated UPI QR payment facility.',
    isPrimary: true,
    status: 'Active',
    createdAt: '2026-06-01T00:00:00.000Z'
  },
  {
    id: 'acc-sbi',
    accountName: 'State Bank of India (SBI)',
    bankName: 'State Bank of India',
    branch: 'Gandhipuram, Coimbatore',
    branchName: 'Gandhipuram, Coimbatore',
    accountHolder: 'To-Gen Solar Agro Private Limited',
    accountNumber: '409283746190',
    ifscCode: 'SBIN0001234',
    type: 'Current',
    upiId: 'togensolar@sbi',
    notes: 'Primary corporate account for customer RTGS/NEFT collections, solar subsidy disbursements, and formal quotation billing.',
    isPrimary: false,
    status: 'Active',
    createdAt: '2026-01-15T00:00:00.000Z'
  },
  {
    id: 'acc-idfc',
    accountName: 'IDFC',
    bankName: 'IDFC FIRST Bank',
    branch: 'Trichy Road Branch, Coimbatore',
    branchName: 'Trichy Road Branch, Coimbatore',
    accountHolder: 'To-Gen Solar Project Operations',
    accountNumber: '001205018392',
    ifscCode: 'ICIC0000012',
    type: 'Overdraft',
    upiId: 'togen.ops@icici',
    notes: 'Operational OD facility dedicated for solar panel procurement, inverters, structure materials, and site labour payouts.',
    isPrimary: false,
    status: 'Active',
    createdAt: '2026-05-20T00:00:00.000Z'
  }
];

function readCollection(key:string):any[] {
 const r=getDb().prepare('SELECT value FROM app_settings WHERE key=?').get(key);
 if(!r && key==='accounts') {
   saveCollection('accounts', DEFAULT_COMPANY_ACCOUNTS);
   return DEFAULT_COMPANY_ACCOUNTS;
 }
 return r ? JSON.parse(r.value) : [];
}
function saveCollection(key:string,value:any[]) {
 getDb().prepare("INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(key,JSON.stringify(value));
}
for(const collection of ['accounts','documents']) {
 operations[collection+'.list']=()=>ok(readCollection(collection));
 operations[collection+'.get']=(id)=>{const row=readCollection(collection).find(x=>x.id===id);return row ? ok(row):fail('NOT_FOUND','Record not found');};
 operations[collection+'.create']=(dto)=>{
   const name = collection==='accounts' ? (dto?.accountName || dto?.bankName) : dto?.title;
   if(!dto || !name) return fail('VALIDATION','Name is required');
   const rows=readCollection(collection), row={
     ...dto,
     id: dto.id || randomUUID(),
     accountName: dto.accountName || dto.bankName || 'Bank Account',
     bankName: dto.bankName || dto.accountName || 'Bank Account',
     branchName: dto.branchName || dto.branch || '',
     branch: dto.branch || dto.branchName || '',
     createdAt: dto.createdAt || new Date().toISOString()
   };
   if(collection==='accounts' && dto.isPrimary) rows.forEach(x=>x.isPrimary=false);
   rows.push(row);saveCollection(collection,rows);return ok(row);
 };
 operations[collection+'.update']=(dto)=>{
   const rows=readCollection(collection), index=rows.findIndex(x=>x.id===dto.id);
   if(index<0)return fail('NOT_FOUND','Record not found');
   if(collection==='accounts'&&dto.isPrimary)rows.forEach(x=>x.isPrimary=false);
   rows[index]={
     ...rows[index],
     ...dto,
     accountName: dto.accountName || dto.bankName || rows[index].accountName,
     bankName: dto.bankName || dto.accountName || rows[index].bankName,
     branchName: dto.branchName || dto.branch || rows[index].branchName,
     branch: dto.branch || dto.branchName || rows[index].branch
   };
   saveCollection(collection,rows);
   return ok(rows[index]);
 };
 operations[collection+'.delete']=(id)=>{const rows=readCollection(collection);if(!rows.some(x=>x.id===id))return fail('NOT_FOUND','Record not found');saveCollection(collection,rows.filter(x=>x.id!==id));return ok({deleted:true});};
}
// The old UI calculated quotes. This boundary centralizes it; Flutter never calculates business totals.
for(const action of ['create','update']) {
 const original=operations['quotations.'+action];
 operations['quotations.'+action]=(dto)=>{
   let input=dto;
   if(action==='update') {const r=quotations.getQuotation(dto.id);if(!r.success)return r;input={...r.data,...dto};}
   try {return original(calculateQuotation(input));}catch(e){return fail('VALIDATION',(e as Error).message);}
 };
}

operations['reports.csv']=()=>{
 const response=operations['reports.list']();if(!response.success)return response;
 const headers=['Project Reference','Customer Name','Site Location','System Capacity (kW)','Installation Stage','Date','Progress (%)','Billed / Contract Value (INR)','Collected Amount (INR)','Balance Due (INR)','Invoice Count','Monthly Generation (kWh)','Annual CO2 Offset (Tons)'];
 const cell=(v:any)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const rows=response.data.map((i:any)=>[i.reference,i.customerName,i.siteName,i.capacityKw,i.stage,i.target_date||'N/A',i.progressPercent+'%',Number(i.contractValue||0).toFixed(2),Number(i.paidAmount||0).toFixed(2),Number(i.balanceAmount||0).toFixed(2),i.invoiceCount,i.estMonthlyKwh,i.co2OffsetTons]);
 return ok([headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n'));
};

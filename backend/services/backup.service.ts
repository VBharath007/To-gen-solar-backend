import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
  rmSync,
  readFileSync,
  cpSync,
} from 'fs';
import { join, basename, dirname } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import Database from 'better-sqlite3';
import { getConfig, isConfigSet } from '../config';
import {
  checkpointDatabase,
  reopenDatabase,
  verifyDatabaseIntegrity,
  getDb,
  isDatabaseInitialized,
} from '../database/connection';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';
import type {
  BackupManifest,
  BackupItem,
  BackupConfig,
  BusinessInfo,
} from '@shared/types/settings.types';
import { logAudit } from './audit.service';
import { formatBytes } from './storage.service';

const execFileAsync = promisify(execFile);

let _backupTimer: NodeJS.Timeout | null = null;

function calculateFileSha256(filePath: string): string {
  const buffer = readFileSync(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

function getStoredBackupConfig(): BackupConfig {
  try {
    if (!isDatabaseInitialized()) {
      return { autoBackupEnabled: true, intervalHours: 24 };
    }
    const db = getDb();
    const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'backup_config'`).get() as { value: string } | undefined;
    if (row?.value) {
      return JSON.parse(row.value);
    }
  } catch {
    // fallback
  }
  return { autoBackupEnabled: true, intervalHours: 24 };
}

function saveStoredBackupConfig(config: BackupConfig): void {
  try {
    if (!isDatabaseInitialized()) return;
    const db = getDb();
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('backup_config', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(JSON.stringify(config));
  } catch (err) {
    console.error('[BackupService.saveStoredBackupConfig]', err);
  }
}

function getAllFromTable(db: Database.Database, tableName: string): Record<string, any>[] {
  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
    if (!tableCheck) return [];
    return db.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, any>[];
  } catch (err) {
    console.warn(`[BackupService] Table ${tableName} query notice:`, err);
    return [];
  }
}

const PAISE_CURRENCY_COLUMNS = new Set([
  'amount',
  'total_amount',
  'tax_amount',
  'amount_paid',
  'unit_price',
  'discount',
  'taxable_value',
  'tax_amount_line',
  'line_total',
  'unallocated',
  'allocated_amount',
  'price',
  'fixed_price',
  'system_cost',
  'subsidy_amount',
  'final_price',
  'contract_value',
  'contractvalue',
  'estimated_cost',
  'labour_rate',
  'totalrevenue',
  'totalpaymentscollected',
  'outstandingbalance',
]);

function objectsToCsv(items: Record<string, any>[]): string {
  if (!items || items.length === 0) return '';
  const headers = Object.keys(items[0]);
  const escapeCsv = (val: any, headerName?: string): string => {
    if (val === null || val === undefined) return '';

    // Convert integer paise currency fields to 2-decimal float format (e.g. 120000 -> 1200.00)
    if (headerName && PAISE_CURRENCY_COLUMNS.has(headerName.toLowerCase())) {
      const num = Number(val);
      if (!isNaN(num)) {
        return (num / 100).toFixed(2);
      }
    }

    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.map((h) => escapeCsv(h)).join(',');
  const rowLines = items.map((row) => headers.map((h) => escapeCsv(row[h], h)).join(','));
  return [headerLine, ...rowLines].join('\r\n');
}

function copyDirIfExists(src: string, dest: string): void {
  try {
    if (existsSync(src)) {
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
  } catch (err) {
    console.warn(`[BackupService] Notice copying ${src} to ${dest}:`, err);
  }
}

function safeWriteCsv(filePath: string, content: string): void {
  try {
    writeFileSync(filePath, content, 'utf8');
  } catch (err: any) {
    if (err?.code === 'EBUSY' || err?.code === 'EPERM') {
      console.warn(`[BackupService] Notice: File is currently open/locked in another program: ${filePath}`);
    } else {
      throw err;
    }
  }
}

function cleanLegacyFiles(dir: string, legacyFileNames: string[]): void {
  for (const f of legacyFileNames) {
    try {
      const p = join(dir, f);
      if (existsSync(p)) {
        rmSync(p, { force: true });
      }
    } catch {
      // ignore if locked
    }
  }
}

function getDirectoryStats(dirPath: string): { filesCount: number; totalSizeBytes: number } {
  let count = 0;
  let size = 0;
  if (!existsSync(dirPath)) return { filesCount: 0, totalSizeBytes: 0 };
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const sub = getDirectoryStats(full);
      count += sub.filesCount;
      size += sub.totalSizeBytes;
    } else if (entry.isFile()) {
      count++;
      try {
        size += statSync(full).size;
      } catch {
        // ignore
      }
    }
  }
  return { filesCount: count, totalSizeBytes: size };
}

/**
 * Creates a complete, verified .tgbak backup archive.
 */
export async function createBackup(customDestinationPath?: string): Promise<ApiResponse<BackupItem>> {
  const config = getConfig();
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dateStr = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const backupFileName = `ToGen_Backup_${dateStr}.tgbak`;

  // Determine target directory
  const storedCfg = getStoredBackupConfig();
  const chosenPath = customDestinationPath || storedCfg.customBackupPath;
  const targetDir = chosenPath && chosenPath.trim() !== ''
    ? chosenPath.trim()
    : join(config.backupsPath, yyyy, mm);

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const finalBackupFile = join(targetDir, backupFileName);
  const tempDir = join(config.backupsPath, `_temp_backup_${Date.now()}`);

  try {
    // 1. Checkpoint WAL to flush all active transactions into crm.sqlite
    checkpointDatabase();

    // 2. Prepare staging folder
    mkdirSync(join(tempDir, 'database'), { recursive: true });

    // Copy live database snapshot
    const tempDbPath = join(tempDir, 'database', 'crm.sqlite');
    cpSync(config.dbFilePath, tempDbPath);

    // 3. Verify copied database integrity
    const verifyDb = new Database(tempDbPath);
    const integrity = verifyDatabaseIntegrity(verifyDb);
    verifyDb.close();

    if (!integrity.ok) {
      throw new Error(`Database snapshot failed integrity check: ${integrity.message}`);
    }

    const dbChecksum = calculateFileSha256(tempDbPath);

    // 4. Copy attachments and business assets for safe database rollback
    if (existsSync(config.attachmentsPath)) {
      const tempAttachmentsDir = join(tempDir, 'attachments');
      mkdirSync(tempAttachmentsDir, { recursive: true });
      cpSync(config.attachmentsPath, tempAttachmentsDir, { recursive: true });
    }

    // 5. Build organized module data structure: "Backuped data of ToGen"
    // Each module gets exactly ONE clear, user-readable Excel (.csv) file.
    // 1. Leads
    // 2. Customers
    // 3. Quotations
    // 4. Products
    // 5. Packages
    // 6. Site Surveys
    // 7. Projects
    // 8. Invoices
    // 9. Payments
    // 10. Reports
    const rootBackupDir = join(targetDir, 'Backuped data of ToGen');
    mkdirSync(rootBackupDir, { recursive: true });

    // Remove legacy Documents folder if it was created in previous backups
    const legacyDocsDir = join(rootBackupDir, 'Documents');
    if (existsSync(legacyDocsDir)) {
      try {
        rmSync(legacyDocsDir, { recursive: true, force: true });
      } catch {
        // ignore if in use
      }
    }

    const liveDb = getDb();

    // 1. Leads (Single leads.csv)
    const leadsDir = join(rootBackupDir, 'Leads');
    mkdirSync(leadsDir, { recursive: true });
    const leadsData = getAllFromTable(liveDb, 'leads');
    writeFileSync(join(leadsDir, 'leads.json'), JSON.stringify(leadsData, null, 2), 'utf8');
    if (leadsData.length > 0) {
      const readableLeads = leadsData.map((l: any) => ({
        'Lead ID': l.id,
        'Name': l.name || '',
        'Phone': l.phone || '',
        'Email': l.email || '',
        'Address': [l.address, l.city, l.state, l.pincode].filter(Boolean).join(', '),
        'Requirement / Category': l.requirement || l.category || 'Solar',
        'Status': l.status || 'New',
        'Source': l.source || 'Direct',
        'Follow-up Date': l.follow_up_date || '',
        'Notes': l.notes || '',
        'Created At': l.created_at || '',
      }));
      safeWriteCsv(join(leadsDir, 'leads.csv'), objectsToCsv(readableLeads));
    }

    // 2. Customers (Single customers.csv)
    const customersDir = join(rootBackupDir, 'Customers');
    mkdirSync(customersDir, { recursive: true });
    cleanLegacyFiles(customersDir, ['installation_sites.csv']);

    const customersData = getAllFromTable(liveDb, 'customers');
    writeFileSync(join(customersDir, 'customers.json'), JSON.stringify(customersData, null, 2), 'utf8');
    const sitesData = getAllFromTable(liveDb, 'installation_sites');
    writeFileSync(join(customersDir, 'installation_sites.json'), JSON.stringify(sitesData, null, 2), 'utf8');

    const customerSitesMap = new Map<number, any[]>();
    for (const site of sitesData) {
      const cid = site.customer_id;
      if (!customerSitesMap.has(cid)) customerSitesMap.set(cid, []);
      customerSitesMap.get(cid)!.push(site);
    }

    if (customersData.length > 0) {
      const readableCustomers = customersData.map((c: any) => {
        const sites = customerSitesMap.get(c.id) || [];
        const sitesSummary = sites.map((s: any) =>
          `${s.site_name || 'Site'}: ${[s.address, s.city, s.state, s.pincode].filter(Boolean).join(', ')}`
        ).join('; ');

        return {
          'Customer ID': c.id,
          'Name': c.name || '',
          'Customer Type': c.customer_type || 'Individual',
          'Business Category': c.business_category || '',
          'Company Name': c.company_name || '',
          'Primary Phone': c.phone || '',
          'Alternate Phone': c.alternate_phone || '',
          'Email': c.email || '',
          'Billing Address': [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', '),
          'GSTIN': c.gstin || '',
          'Installation Sites': sitesSummary || 'No separate site registered',
          'Created At': c.created_at || '',
        };
      });
      safeWriteCsv(join(customersDir, 'customers.csv'), objectsToCsv(readableCustomers));
    }
    copyDirIfExists(join(config.attachmentsPath, 'customers'), join(customersDir, 'attachments'));

    // 3. Quotations (Single quotations.csv)
    const quotationsDir = join(rootBackupDir, 'Quotations');
    mkdirSync(quotationsDir, { recursive: true });
    cleanLegacyFiles(quotationsDir, [
      'quotation_site_photos.csv',
      'quotation_scope.csv',
      'quotation_items.csv',
      'quotation_technical_details.csv',
      'quotation_milestones.csv',
      'quotation_documents.csv',
    ]);

    const quotationsData = getAllFromTable(liveDb, 'quotations');
    writeFileSync(join(quotationsDir, 'quotations.json'), JSON.stringify(quotationsData, null, 2), 'utf8');
    const quotationItemsData = getAllFromTable(liveDb, 'quotation_items');
    writeFileSync(join(quotationsDir, 'quotation_items.json'), JSON.stringify(quotationItemsData, null, 2), 'utf8');
    const quotationTechData = getAllFromTable(liveDb, 'quotation_technical_details');
    writeFileSync(join(quotationsDir, 'quotation_technical_details.json'), JSON.stringify(quotationTechData, null, 2), 'utf8');
    const quotationMilestonesData = getAllFromTable(liveDb, 'quotation_milestones');
    writeFileSync(join(quotationsDir, 'quotation_milestones.json'), JSON.stringify(quotationMilestonesData, null, 2), 'utf8');
    const quotationDocsData = getAllFromTable(liveDb, 'quotation_documents');
    writeFileSync(join(quotationsDir, 'quotation_documents.json'), JSON.stringify(quotationDocsData, null, 2), 'utf8');
    const quotationScopeData = getAllFromTable(liveDb, 'quotation_scope');
    writeFileSync(join(quotationsDir, 'quotation_scope.json'), JSON.stringify(quotationScopeData, null, 2), 'utf8');
    const quotationSitePhotosData = getAllFromTable(liveDb, 'quotation_site_photos');
    writeFileSync(join(quotationsDir, 'quotation_site_photos.json'), JSON.stringify(quotationSitePhotosData, null, 2), 'utf8');

    if (quotationSitePhotosData.length > 0) {
      const sitePhotosDir = join(quotationsDir, 'Site Photos');
      mkdirSync(sitePhotosDir, { recursive: true });
      quotationSitePhotosData.forEach((photo: any) => {
        try {
          if (photo.data_url && typeof photo.data_url === 'string' && photo.data_url.includes('base64,')) {
            const parts = photo.data_url.split('base64,');
            const extMatch = photo.data_url.match(/data:image\/([a-zA-Z0-9]+);/);
            const ext = extMatch ? extMatch[1].replace('jpeg', 'jpg') : 'jpg';
            const buffer = Buffer.from(parts[1], 'base64');
            const safeName = (photo.name || `photo_${photo.photo_order || 1}`)
              .replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `Q${photo.quotation_id || 'x'}_P${photo.photo_order || 1}_${safeName.endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`}`;
            writeFileSync(join(sitePhotosDir, fileName), buffer);
          }
        } catch (err) {
          console.warn('[BackupService] Failed to export site photo image:', err);
        }
      });
    }

    if (quotationsData.length > 0) {
      const customersMap = new Map((getAllFromTable(liveDb, 'customers') || []).map((c: any) => [c.id, c]));
      const sitesMap = new Map((getAllFromTable(liveDb, 'installation_sites') || []).map((s: any) => [s.id, s]));

      const itemsMap = new Map<number, any[]>();
      for (const item of quotationItemsData) {
        const qid = item.quotation_id;
        if (!itemsMap.has(qid)) itemsMap.set(qid, []);
        itemsMap.get(qid)!.push(item);
      }

      const techMap = new Map<number, any>();
      for (const tech of quotationTechData) {
        techMap.set(tech.quotation_id, tech);
      }

      const milestonesMap = new Map<number, any[]>();
      for (const m of quotationMilestonesData) {
        const qid = m.quotation_id;
        if (!milestonesMap.has(qid)) milestonesMap.set(qid, []);
        milestonesMap.get(qid)!.push(m);
      }

      const formatRupees = (paiseVal: any): string => {
        const num = Number(paiseVal);
        return isNaN(num) ? '0.00' : (num / 100).toFixed(2);
      };

      const readableQuotations = quotationsData.map((q: any) => {
        const cust = q.customer_id ? customersMap.get(q.customer_id) : null;
        const site = q.site_id ? sitesMap.get(q.site_id) : null;
        const tech = techMap.get(q.id) || {};
        const items = itemsMap.get(q.id) || [];
        const milestones = milestonesMap.get(q.id) || [];

        const customerName = q.is_manual_customer
          ? (q.manual_customer_name || 'Manual Customer')
          : (cust?.name || 'Unknown');

        const customerPhone = q.is_manual_customer
          ? (q.manual_customer_phone || '')
          : (cust?.phone || '');

        const customerEmail = q.is_manual_customer
          ? (q.manual_customer_email || '')
          : (cust?.email || '');

        const addressParts = [
          site?.address || cust?.address || q.manual_customer_address,
          site?.city || cust?.city,
          site?.state || cust?.state,
          site?.pincode || cust?.pincode,
        ].filter(Boolean);
        const address = addressParts.join(', ');

        const capacity = tech.system_capacity_kw || tech.dc_capacity_kwp
          ? `${tech.system_capacity_kw || tech.dc_capacity_kwp} kW`
          : '';

        const panels = [
          tech.panel_specs,
          tech.panel_wattage_w ? `${tech.panel_wattage_w}W` : '',
          tech.panel_count ? `(${tech.panel_count} Nos)` : '',
        ].filter(Boolean).join(' ');

        const inverter = [
          tech.inverter_specs,
          tech.inverter_capacity_kw ? `${tech.inverter_capacity_kw} kW` : '',
        ].filter(Boolean).join(' ');

        const battery = [
          tech.battery_type,
          tech.battery_capacity ? `${tech.battery_capacity}Ah` : '',
          tech.battery_quantity ? `(${tech.battery_quantity} Nos)` : '',
        ].filter(Boolean).join(' ');

        const structure = tech.structure_type || tech.mounting_structure || '';

        const itemsSummary = items
          .map((it: any) => `${it.name}${it.quantity ? ` (Qty: ${it.quantity})` : ''}`)
          .join('; ');

        const milestonesSummary = milestones
          .map((m: any) => `${m.label || 'Stage'}: ${m.percentage || 0}%`)
          .join('; ');

        return {
          'Quotation No': q.reference || `QT-${q.id}`,
          'Date': q.issue_date || (q.created_at ? q.created_at.split(' ')[0] : ''),
          'Valid Until': q.valid_until || '',
          'Status': q.status || 'Draft',
          'Customer Name': customerName,
          'Phone': customerPhone,
          'Email': customerEmail,
          'Installation Address': address,
          'Category': q.business_category || q.project_type || q.system_type || 'Solar',
          'System Capacity': capacity,
          'Solar Panels': panels,
          'Inverter': inverter,
          'Battery': battery,
          'Structure': structure,
          'Quoted Products & Items': itemsSummary,
          'Subtotal (INR)': formatRupees(q.subtotal),
          'Discount (INR)': formatRupees(q.total_discount),
          'Tax (INR)': formatRupees(q.total_tax),
          'Grand Total (INR)': formatRupees(q.grand_total),
          'Payment Terms': milestonesSummary || q.payment_terms || '',
          'Internal Notes': q.notes_internal || '',
        };
      });

      safeWriteCsv(join(quotationsDir, 'quotations.csv'), objectsToCsv(readableQuotations));
    }
    copyDirIfExists(join(config.exportsPath, 'quotations'), join(quotationsDir, 'exports'));

    // 4. Products (Single products.csv)
    const productsDir = join(rootBackupDir, 'Products');
    mkdirSync(productsDir, { recursive: true });
    cleanLegacyFiles(productsDir, ['business_categories.csv']);

    const productsData = getAllFromTable(liveDb, 'products');
    writeFileSync(join(productsDir, 'products.json'), JSON.stringify(productsData, null, 2), 'utf8');
    const categoriesData = getAllFromTable(liveDb, 'business_categories');
    writeFileSync(join(productsDir, 'business_categories.json'), JSON.stringify(categoriesData, null, 2), 'utf8');
    const categoryMap = new Map(categoriesData.map((cat: any) => [cat.id, cat.name]));

    if (productsData.length > 0) {
      const readableProducts = productsData.map((p: any) => ({
        'Product Code / SKU': p.sku || p.code || `PRD-${p.id}`,
        'Product Name': p.name || '',
        'Category': (p.category_id ? categoryMap.get(p.category_id) : null) || p.category || 'General',
        'Brand / Manufacturer': p.brand || '',
        'Model': p.model || '',
        'HSN / SAC': p.hsn_sac || '',
        'Unit': p.unit || 'Nos',
        'Unit Price (INR)': ((Number(p.unit_price) || 0) / 100).toFixed(2),
        'Tax Rate (%)': `${p.tax_rate || 0}%`,
        'Description': p.description || '',
        'Status': p.is_active === 0 ? 'Inactive' : 'Active',
      }));
      safeWriteCsv(join(productsDir, 'products.csv'), objectsToCsv(readableProducts));
    }

    // 5. Packages (Single packages.csv)
    const packagesDir = join(rootBackupDir, 'Packages');
    mkdirSync(packagesDir, { recursive: true });
    cleanLegacyFiles(packagesDir, ['package_items.csv']);

    const packagesData = getAllFromTable(liveDb, 'packages');
    writeFileSync(join(packagesDir, 'packages.json'), JSON.stringify(packagesData, null, 2), 'utf8');
    const packageItemsData = getAllFromTable(liveDb, 'package_items');
    writeFileSync(join(packagesDir, 'package_items.json'), JSON.stringify(packageItemsData, null, 2), 'utf8');

    const packageItemsMap = new Map<number, any[]>();
    for (const item of packageItemsData) {
      const pkgId = item.package_id;
      if (!packageItemsMap.has(pkgId)) packageItemsMap.set(pkgId, []);
      packageItemsMap.get(pkgId)!.push(item);
    }

    if (packagesData.length > 0) {
      const readablePackages = packagesData.map((pkg: any) => {
        const items = packageItemsMap.get(pkg.id) || [];
        const itemsSummary = items.map((it: any) =>
          `${it.product_name || it.name || 'Component'} (Qty: ${it.quantity || 1})`
        ).join('; ');

        return {
          'Package Code': pkg.code || `PKG-${pkg.id}`,
          'Package Name': pkg.name || '',
          'Category / System Type': pkg.system_type || pkg.category || 'Solar',
          'Capacity (kW)': pkg.capacity_kw ? `${pkg.capacity_kw} kW` : '',
          'Fixed Price (INR)': ((Number(pkg.fixed_price) || 0) / 100).toFixed(2),
          'Included Components': itemsSummary || 'Standard Components',
          'Description': pkg.description || '',
          'Status': pkg.is_active === 0 ? 'Inactive' : 'Active',
        };
      });
      safeWriteCsv(join(packagesDir, 'packages.csv'), objectsToCsv(readablePackages));
    }

    // 6. Site Surveys (Single site_surveys.csv)
    const siteSurveysDir = join(rootBackupDir, 'Site Surveys');
    mkdirSync(siteSurveysDir, { recursive: true });
    const surveysData = getAllFromTable(liveDb, 'site_surveys');
    writeFileSync(join(siteSurveysDir, 'site_surveys.json'), JSON.stringify(surveysData, null, 2), 'utf8');

    if (surveysData.length > 0) {
      const customersMap = new Map((getAllFromTable(liveDb, 'customers') || []).map((c: any) => [c.id, c]));
      const sitesMap = new Map((getAllFromTable(liveDb, 'installation_sites') || []).map((s: any) => [s.id, s]));

      const readableSurveys = surveysData.map((s: any) => {
        const cust = s.customer_id ? customersMap.get(s.customer_id) : null;
        const site = s.site_id ? sitesMap.get(s.site_id) : null;
        const siteAddr = [site?.address, site?.city, site?.state, site?.pincode].filter(Boolean).join(', ') || cust?.address || '';

        return {
          'Survey Reference': s.reference || `SUR-${s.id}`,
          'Survey Date': s.survey_date || '',
          'Customer Name': cust?.name || 'Unknown',
          'Customer Phone': cust?.phone || '',
          'Site Address': siteAddr,
          'Roof Type': s.roof_type || '',
          'Total Roof Area (sqft)': s.roof_area_sqft || '',
          'Shadow-Free Area (sqft)': s.shadow_free_area_sqft || '',
          'Proposed Capacity (kW)': s.proposed_capacity_kw ? `${s.proposed_capacity_kw} kW` : '',
          'Feasibility Status': s.feasibility_status || s.status || 'Pending',
          'Remarks / Notes': s.notes || s.remarks || '',
        };
      });
      safeWriteCsv(join(siteSurveysDir, 'site_surveys.csv'), objectsToCsv(readableSurveys));
    }
    copyDirIfExists(join(config.attachmentsPath, 'surveys'), join(siteSurveysDir, 'attachments'));

    // 7. Projects (Single projects.csv)
    const projectsDir = join(rootBackupDir, 'Projects');
    mkdirSync(projectsDir, { recursive: true });
    const projectsData = getAllFromTable(liveDb, 'projects');
    writeFileSync(join(projectsDir, 'projects.json'), JSON.stringify(projectsData, null, 2), 'utf8');

    if (projectsData.length > 0) {
      const customersMap = new Map((getAllFromTable(liveDb, 'customers') || []).map((c: any) => [c.id, c]));
      const sitesMap = new Map((getAllFromTable(liveDb, 'installation_sites') || []).map((s: any) => [s.id, s]));

      const readableProjects = projectsData.map((p: any) => {
        const cust = p.customer_id ? customersMap.get(p.customer_id) : null;
        const site = p.site_id ? sitesMap.get(p.site_id) : null;
        const contractVal = (Number(p.contract_value) || 0) / 100;
        const paidVal = (Number(p.paid_amount || p.amount_paid) || 0) / 100;
        const balance = Math.max(0, contractVal - paidVal);

        return {
          'Project Code': p.reference || `PRJ-${p.id}`,
          'Customer Name': cust?.name || 'Unknown',
          'Customer Phone': cust?.phone || '',
          'Site Location': [site?.address, site?.city].filter(Boolean).join(', ') || '',
          'Stage / Status': p.stage || 'Planning',
          'System Capacity': p.system_capacity_kw ? `${p.system_capacity_kw} kW` : '',
          'Contract Value (INR)': contractVal.toFixed(2),
          'Paid Amount (INR)': paidVal.toFixed(2),
          'Balance Due (INR)': balance.toFixed(2),
          'Start Date': p.start_date || '',
          'Target Completion Date': p.target_completion_date || '',
          'Progress (%)': `${p.progress_percent || 0}%`,
        };
      });
      safeWriteCsv(join(projectsDir, 'projects.csv'), objectsToCsv(readableProjects));
    }

    // 8. Invoices (Single invoices.csv)
    const invoicesDir = join(rootBackupDir, 'Invoices');
    mkdirSync(invoicesDir, { recursive: true });
    cleanLegacyFiles(invoicesDir, ['invoice_lines.csv', 'invoice_sequences.csv']);

    const invoicesData = getAllFromTable(liveDb, 'invoices');
    writeFileSync(join(invoicesDir, 'invoices.json'), JSON.stringify(invoicesData, null, 2), 'utf8');
    const invoiceLinesData = getAllFromTable(liveDb, 'invoice_lines');
    writeFileSync(join(invoicesDir, 'invoice_lines.json'), JSON.stringify(invoiceLinesData, null, 2), 'utf8');

    const invoiceLinesMap = new Map<number, any[]>();
    for (const line of invoiceLinesData) {
      const invId = line.invoice_id;
      if (!invoiceLinesMap.has(invId)) invoiceLinesMap.set(invId, []);
      invoiceLinesMap.get(invId)!.push(line);
    }

    if (invoicesData.length > 0) {
      const customersMap = new Map((getAllFromTable(liveDb, 'customers') || []).map((c: any) => [c.id, c]));

      const readableInvoices = invoicesData.map((inv: any) => {
        const cust = inv.customer_id ? customersMap.get(inv.customer_id) : null;
        const lines = invoiceLinesMap.get(inv.id) || [];
        const linesSummary = lines.map((l: any) =>
          `${l.description || l.name || 'Line Item'} (Qty: ${l.quantity || 1}, Rate: ₹${((Number(l.unit_price) || 0) / 100).toFixed(2)})`
        ).join('; ');

        const totalAmt = (Number(inv.total_amount) || 0) / 100;
        const paidAmt = (Number(inv.amount_paid) || 0) / 100;
        const balance = Math.max(0, totalAmt - paidAmt);

        return {
          'Invoice Number': inv.invoice_number || `INV-${inv.id}`,
          'Invoice Date': inv.invoice_date || '',
          'Due Date': inv.due_date || '',
          'Customer Name': cust?.name || inv.customer_name || 'Customer',
          'Phone': cust?.phone || '',
          'Billing Address': [cust?.address, cust?.city, cust?.state, cust?.pincode].filter(Boolean).join(', '),
          'Status': inv.status || 'Draft',
          'Invoice Line Items': linesSummary || 'General Billing',
          'Subtotal (INR)': ((Number(inv.subtotal) || 0) / 100).toFixed(2),
          'Tax Amount (INR)': ((Number(inv.tax_amount) || 0) / 100).toFixed(2),
          'Total Amount (INR)': totalAmt.toFixed(2),
          'Amount Paid (INR)': paidAmt.toFixed(2),
          'Balance Due (INR)': balance.toFixed(2),
        };
      });
      safeWriteCsv(join(invoicesDir, 'invoices.csv'), objectsToCsv(readableInvoices));
    }
    copyDirIfExists(join(config.exportsPath, 'invoices'), join(invoicesDir, 'exports'));

    // 9. Payments (Single payments.csv)
    const paymentsDir = join(rootBackupDir, 'Payments');
    mkdirSync(paymentsDir, { recursive: true });
    cleanLegacyFiles(paymentsDir, ['payment_receipts.csv']);

    const paymentsData = getAllFromTable(liveDb, 'payments');
    writeFileSync(join(paymentsDir, 'payments.json'), JSON.stringify(paymentsData, null, 2), 'utf8');
    const paymentReceiptsData = getAllFromTable(liveDb, 'payment_receipts');
    writeFileSync(join(paymentsDir, 'payment_receipts.json'), JSON.stringify(paymentReceiptsData, null, 2), 'utf8');
    const paymentAllocationsData = getAllFromTable(liveDb, 'payment_allocations');
    writeFileSync(join(paymentsDir, 'payment_allocations.json'), JSON.stringify(paymentAllocationsData, null, 2), 'utf8');

    const customersMap = new Map((getAllFromTable(liveDb, 'customers') || []).map((c: any) => [c.id, c]));
    const invoicesMap = new Map((getAllFromTable(liveDb, 'invoices') || []).map((i: any) => [i.id, i]));
    const projectsMap = new Map((getAllFromTable(liveDb, 'projects') || []).map((p: any) => [p.id, p]));

    const readablePayments: Record<string, any>[] = [];

    // Primary: Read from payment_receipts (current live system)
    for (const r of paymentReceiptsData) {
      const inv = r.invoice_id ? invoicesMap.get(r.invoice_id) : null;
      const custId = r.customer_id || inv?.customer_id;
      const cust = custId ? customersMap.get(custId) : null;
      const proj = r.project_id ? projectsMap.get(r.project_id) : (inv?.project_id ? projectsMap.get(inv.project_id) : null);

      const custName = cust?.name || inv?.customer_name || 'Direct Customer';
      const custPhone = cust?.phone || inv?.customer_phone || '';
      const custAddress = [cust?.address, cust?.city, cust?.state, cust?.pincode].filter(Boolean).join(', ') || inv?.customer_address || '';

      const invRef = inv ? (inv.invoice_number || inv.reference || `INV-${inv.id}`) : (r.payment_type === 'Advance' ? 'Advance Payment' : '-');
      const invTotal = inv ? ((Number(inv.total_amount) || 0) / 100).toFixed(2) : '-';
      const invStatus = inv ? (inv.status || 'Pending') : (r.payment_type || 'Advance');
      const projRef = proj ? (proj.reference || proj.name || `PRJ-${proj.id}`) : '-';

      readablePayments.push({
        'Receipt No': r.reference || `REC-${r.id}`,
        'Payment Date': r.payment_date || (r.created_at ? r.created_at.split(' ')[0] : ''),
        'Payment Type': r.payment_type || (r.invoice_id ? 'Invoice Payment' : 'Advance'),
        'Customer Name': custName,
        'Customer Phone': custPhone,
        'Billing Address': custAddress,
        'Invoice Reference': invRef,
        'Invoice Total (INR)': invTotal,
        'Invoice Status': invStatus,
        'Project Reference': projRef,
        'Payment Mode': r.payment_method || 'Bank Transfer',
        'Reference / UTR / Cheque No': r.transaction_id || r.bank_ref || '-',
        'Amount Paid (INR)': ((Number(r.amount) || 0) / 100).toFixed(2),
        'Unallocated Advance (INR)': ((Number(r.unallocated) || 0) / 100).toFixed(2),
        'Notes': r.notes || '',
        'Created At': r.created_at || '',
      });
    }

    // Secondary: Include legacy payments from payments table if any exist and not already in receipts
    for (const p of paymentsData) {
      const alreadyIncluded = readablePayments.some(rp => rp['Receipt No'] === p.reference);
      if (!alreadyIncluded) {
        const inv = p.invoice_id ? invoicesMap.get(p.invoice_id) : null;
        const cust = inv?.customer_id ? customersMap.get(inv.customer_id) : (p.customer_id ? customersMap.get(p.customer_id) : null);
        const invRef = inv ? (inv.invoice_number || inv.reference || `INV-${inv.id}`) : '-';
        const invTotal = inv ? ((Number(inv.total_amount) || 0) / 100).toFixed(2) : '-';
        const invStatus = inv ? (inv.status || 'Paid') : 'Paid';

        readablePayments.push({
          'Receipt No': p.reference || `REC-${p.id}`,
          'Payment Date': p.payment_date || (p.created_at ? p.created_at.split(' ')[0] : ''),
          'Payment Type': 'Invoice Payment',
          'Customer Name': cust?.name || inv?.customer_name || 'Customer',
          'Customer Phone': cust?.phone || inv?.customer_phone || '',
          'Billing Address': [cust?.address, cust?.city, cust?.state, cust?.pincode].filter(Boolean).join(', ') || '',
          'Invoice Reference': invRef,
          'Invoice Total (INR)': invTotal,
          'Invoice Status': invStatus,
          'Project Reference': '-',
          'Payment Mode': p.payment_mode || p.payment_method || 'Bank Transfer',
          'Reference / UTR / Cheque No': p.reference_number || p.transaction_id || '-',
          'Amount Paid (INR)': ((Number(p.amount) || 0) / 100).toFixed(2),
          'Unallocated Advance (INR)': '0.00',
          'Notes': p.notes || '',
          'Created At': p.created_at || '',
        });
      }
    }

    if (readablePayments.length > 0) {
      safeWriteCsv(join(paymentsDir, 'payments.csv'), objectsToCsv(readablePayments));
    } else {
      const emptyHeaders = [
        'Receipt No',
        'Payment Date',
        'Payment Type',
        'Customer Name',
        'Customer Phone',
        'Billing Address',
        'Invoice Reference',
        'Invoice Total (INR)',
        'Invoice Status',
        'Project Reference',
        'Payment Mode',
        'Reference / UTR / Cheque No',
        'Amount Paid (INR)',
        'Unallocated Advance (INR)',
        'Notes',
        'Created At'
      ];
      safeWriteCsv(join(paymentsDir, 'payments.csv'), emptyHeaders.join(',') + '\r\n');
    }
    copyDirIfExists(join(config.exportsPath, 'receipts'), join(paymentsDir, 'exports'));

    // 10. Reports (Single reports_summary.csv)
    const reportsDir = join(rootBackupDir, 'Reports');
    mkdirSync(reportsDir, { recursive: true });
    cleanLegacyFiles(reportsDir, [
      'projects_report.csv',
      'leads_report.csv',
      'quotations_report.csv',
      'revenue_invoices_report.csv',
      'payments_collection_report.csv',
    ]);

    const totalProjects = projectsData.length;
    const totalRevenuePaise = invoicesData.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const totalPaidPaise = paymentsData.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const outstandingPaise = Math.max(0, totalRevenuePaise - totalPaidPaise);

    const reportsSummary = {
      generatedAt: now.toISOString(),
      metrics: {
        totalLeads: leadsData.length,
        totalCustomers: customersData.length,
        totalQuotations: quotationsData.length,
        totalProducts: productsData.length,
        totalPackages: packagesData.length,
        totalSurveys: surveysData.length,
        totalProjects,
        totalInvoices: invoicesData.length,
        totalRevenue: (totalRevenuePaise / 100).toFixed(2),
        totalPaymentsCollected: (totalPaidPaise / 100).toFixed(2),
        outstandingBalance: (outstandingPaise / 100).toFixed(2),
      },
    };
    writeFileSync(join(reportsDir, 'reports_summary.json'), JSON.stringify(reportsSummary, null, 2), 'utf8');

    const readableMetrics = [
      { Metric: 'Total Leads', Value: String(leadsData.length) },
      { Metric: 'Total Customers', Value: String(customersData.length) },
      { Metric: 'Total Quotations', Value: String(quotationsData.length) },
      { Metric: 'Total Products', Value: String(productsData.length) },
      { Metric: 'Total Packages', Value: String(packagesData.length) },
      { Metric: 'Total Site Surveys', Value: String(surveysData.length) },
      { Metric: 'Total Projects', Value: String(totalProjects) },
      { Metric: 'Total Invoices', Value: String(invoicesData.length) },
      { Metric: 'Total Revenue (INR)', Value: (totalRevenuePaise / 100).toFixed(2) },
      { Metric: 'Total Payments Collected (INR)', Value: (totalPaidPaise / 100).toFixed(2) },
      { Metric: 'Outstanding Balance (INR)', Value: (outstandingPaise / 100).toFixed(2) },
      { Metric: 'Report Generated At', Value: now.toLocaleString('en-IN') },
    ];
    safeWriteCsv(join(reportsDir, 'reports_summary.csv'), objectsToCsv(readableMetrics));
    copyDirIfExists(join(config.exportsPath, 'reports'), join(reportsDir, 'exports'));

    // 12. Settings & System Configurations
    const settingsDir = join(rootBackupDir, 'Settings');
    mkdirSync(settingsDir, { recursive: true });
    const settingsData = getAllFromTable(liveDb, 'app_settings');
    writeFileSync(join(settingsDir, 'app_settings.json'), JSON.stringify(settingsData, null, 2), 'utf8');
    if (settingsData.length > 0) {
      writeFileSync(join(settingsDir, 'app_settings.csv'), objectsToCsv(settingsData), 'utf8');
    }
    const auditData = getAllFromTable(liveDb, 'audit_logs');
    writeFileSync(join(settingsDir, 'audit_logs.json'), JSON.stringify(auditData, null, 2), 'utf8');
    if (auditData.length > 0) {
      writeFileSync(join(settingsDir, 'audit_logs.csv'), objectsToCsv(auditData), 'utf8');
    }

    // 13. Full SQLite Database Snapshot
    const databaseDir = join(rootBackupDir, 'Database');
    mkdirSync(databaseDir, { recursive: true });
    cpSync(tempDbPath, join(databaseDir, 'crm.sqlite'));
    writeFileSync(join(databaseDir, 'database_info.json'), JSON.stringify({
      exportedAt: now.toISOString(),
      checksumSha256: dbChecksum,
      sqliteVersion: (liveDb.prepare('SELECT sqlite_version() as ver').get() as any)?.ver || '3.x',
    }, null, 2), 'utf8');

    // 14. Gather business info for manifest
    let businessSnapshot: BusinessInfo | undefined;
    try {
      const row = liveDb.prepare(`SELECT value FROM app_settings WHERE key = 'business_info'`).get() as { value: string } | undefined;
      if (row?.value) {
        businessSnapshot = JSON.parse(row.value);
        writeFileSync(join(settingsDir, 'business_info.json'), JSON.stringify(businessSnapshot, null, 2), 'utf8');
      }
    } catch {
      // ignore
    }

    // 6. Calculate stats across staging and module backup folders
    const dirStats = getDirectoryStats(tempDir);
    const moduleStats = getDirectoryStats(rootBackupDir);

    // 7. Write manifest strictly inside tempDir (never inside rootBackupDir)
    const manifest: BackupManifest = {
      version: '1.0',
      appVersion: '0.1.0',
      schemaVersion: 11,
      createdAt: now.toISOString(),
      dbChecksum,
      businessSnapshot,
      filesCount: dirStats.filesCount + moduleStats.filesCount,
      totalSizeBytes: dirStats.totalSizeBytes + moduleStats.totalSizeBytes,
    };

    writeFileSync(join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // 8. Copy uncompressed "Backuped data of ToGen" folder into staging tempDir for archive bundling
    cpSync(rootBackupDir, join(tempDir, 'Backuped data of ToGen'), { recursive: true });

    // 9. Compress into .tgbak using Windows tar
    await execFileAsync('tar', ['-czf', finalBackupFile, '-C', tempDir, '.']);

    // 10. Clean up temp staging folder (leaves rootBackupDir in targetDir untouched)
    rmSync(tempDir, { recursive: true, force: true });

    const archiveSize = statSync(finalBackupFile).size;

    // 11. Update backup config status in database
    const backupCfg = getStoredBackupConfig();
    const nextBackup = new Date(now.getTime() + (backupCfg.intervalHours || 24) * 3600 * 1000);
    backupCfg.lastBackupTime = now.toISOString();
    backupCfg.nextBackupTime = nextBackup.toISOString();
    backupCfg.lastStatus = 'success';
    backupCfg.lastError = undefined;
    saveStoredBackupConfig(backupCfg);

    logAudit('BACKUP_CREATED', 'backup', backupFileName, {
      file: finalBackupFile,
      size: archiveSize,
      checksum: dbChecksum,
    });

    const backupItem: BackupItem = {
      filename: backupFileName,
      filepath: finalBackupFile,
      createdAt: now.toISOString(),
      sizeBytes: archiveSize,
      sizeFormatted: formatBytes(archiveSize),
      manifest,
      isValid: true,
    };

    return ok(backupItem);
  } catch (err) {
    console.error('[BackupService.createBackup] Backup failed:', err);

    if (existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    const backupCfg = getStoredBackupConfig();
    backupCfg.lastStatus = 'failed';
    backupCfg.lastError = (err as Error).message;
    saveStoredBackupConfig(backupCfg);

    return fail('INTERNAL_ERROR', `Backup creation failed: ${(err as Error).message}`);
  }
}

/**
 * Scans directories recursively for .tgbak archives.
 */
function findBackupFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findBackupFiles(full));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.tgbak')) {
        results.push(full);
      }
    }
  } catch {
    // ignore
  }
  return results;
}

/**
 * Lists all available backup archives.
 */
export async function listBackups(): Promise<ApiResponse<BackupItem[]>> {
  try {
    if (!isConfigSet()) {
      return ok([]);
    }

    const config = getConfig();
    const backupCfg = getStoredBackupConfig();

    const searchDirs = [config.backupsPath];
    if (backupCfg.customBackupPath && existsSync(backupCfg.customBackupPath)) {
      searchDirs.push(backupCfg.customBackupPath);
    }

    const allFiles = new Set<string>();
    for (const dir of searchDirs) {
      for (const file of findBackupFiles(dir)) {
        allFiles.add(file);
      }
    }

    const items: BackupItem[] = [];

    for (const filePath of Array.from(allFiles)) {
      try {
        const stat = statSync(filePath);
        items.push({
          filename: basename(filePath),
          filepath: filePath,
          createdAt: stat.mtime.toISOString(),
          sizeBytes: stat.size,
          sizeFormatted: formatBytes(stat.size),
          isValid: true,
        });
      } catch {
        // ignore unreadable file
      }
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return ok(items);
  } catch (err) {
    console.error('[BackupService.listBackups]', err);
    return fail('INTERNAL_ERROR', 'Failed to list backup archives');
  }
}

/**
 * Inspects a .tgbak archive, backup folder, or sqlite file without restoring it.
 */
export async function validateBackupArchive(
  filePath: string
): Promise<ApiResponse<{ isValid: boolean; manifest?: BackupManifest; error?: string }>> {
  if (!existsSync(filePath)) {
    return fail('NOT_FOUND', 'Backup file or folder not found');
  }

  const stat = statSync(filePath);

  // Case A: User selected a folder (e.g. "Backuped data of ToGen")
  if (stat.isDirectory()) {
    const possibleDbPaths = [
      join(filePath, 'Database', 'crm.sqlite'),
      join(filePath, 'database', 'crm.sqlite'),
      join(filePath, 'crm.sqlite'),
    ];
    const foundDb = possibleDbPaths.find((p) => existsSync(p));
    if (!foundDb) {
      return ok({
        isValid: false,
        error: 'The selected folder does not contain a Database/crm.sqlite file.',
      });
    }

    try {
      const verifyDb = new Database(foundDb);
      const integrity = verifyDatabaseIntegrity(verifyDb);
      verifyDb.close();

      return ok({
        isValid: integrity.ok,
        manifest: {
          version: '1.0',
          appVersion: '0.1.0',
          schemaVersion: 11,
          createdAt: stat.mtime.toISOString(),
          dbChecksum: '',
          filesCount: 1,
          totalSizeBytes: stat.size,
        },
        error: integrity.ok ? undefined : integrity.message,
      });
    } catch (e: any) {
      return ok({ isValid: false, error: e.message });
    }
  }

  // Case B: Direct SQLite file (e.g. crm.sqlite)
  if (filePath.toLowerCase().endsWith('.sqlite') || filePath.toLowerCase().endsWith('.db')) {
    try {
      const verifyDb = new Database(filePath);
      const integrity = verifyDatabaseIntegrity(verifyDb);
      verifyDb.close();

      return ok({
        isValid: integrity.ok,
        manifest: {
          version: '1.0',
          appVersion: '0.1.0',
          schemaVersion: 11,
          createdAt: stat.mtime.toISOString(),
          dbChecksum: '',
          filesCount: 1,
          totalSizeBytes: stat.size,
        },
        error: integrity.ok ? undefined : integrity.message,
      });
    } catch (e: any) {
      return ok({ isValid: false, error: e.message });
    }
  }

  // Case C: Standard .tgbak archive
  const tempBase = isConfigSet() ? getConfig().backupsPath : tmpdir();
  const tempDir = join(tempBase, `_inspect_${Date.now()}`);

  try {
    mkdirSync(tempDir, { recursive: true });

    // Extract manifest only
    await execFileAsync('tar', ['-xzf', filePath, '-C', tempDir, 'manifest.json']);

    const manifestFile = join(tempDir, 'manifest.json');
    if (!existsSync(manifestFile)) {
      throw new Error('Archive does not contain a valid manifest.json');
    }

    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as BackupManifest;

    rmSync(tempDir, { recursive: true, force: true });

    return ok({ isValid: true, manifest });
  } catch (err) {
    if (existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    return ok({ isValid: false, error: (err as Error).message });
  }
}

/**
 * Restores CRM dataset from a selected .tgbak archive, backup folder, or sqlite file with rollback safety.
 */
export async function restoreBackup(
  archiveFilePath: string
): Promise<ApiResponse<{ success: boolean; recoveryBackupPath: string }>> {
  if (!existsSync(archiveFilePath)) {
    return fail('NOT_FOUND', 'Selected backup source was not found on disk');
  }

  const config = getConfig();

  // 1. Create a pre-restore safety backup first
  const safetyRes = await createBackup();
  const recoveryBackupPath = safetyRes.success ? safetyRes.data.filepath : '';

  const tempExtractDir = join(config.userDataPath, `_restore_temp_${Date.now()}`);

  try {
    mkdirSync(tempExtractDir, { recursive: true });

    let extractedDbPath = '';
    let extractedAttachments = '';
    let schemaVersion = 11;

    const stat = statSync(archiveFilePath);

    if (stat.isDirectory()) {
      // Restore directly from a backup folder (e.g. "Backuped data of ToGen")
      const possibleDbPaths = [
        join(archiveFilePath, 'Database', 'crm.sqlite'),
        join(archiveFilePath, 'database', 'crm.sqlite'),
        join(archiveFilePath, 'crm.sqlite'),
      ];
      const foundDb = possibleDbPaths.find((p) => existsSync(p));
      if (!foundDb) {
        throw new Error('Selected backup folder does not contain a Database/crm.sqlite file');
      }
      extractedDbPath = foundDb;

      const possibleAttPaths = [
        join(archiveFilePath, 'attachments'),
        join(archiveFilePath, 'Customers', 'attachments'),
      ];
      extractedAttachments = possibleAttPaths.find((p) => existsSync(p)) || '';
    } else if (archiveFilePath.toLowerCase().endsWith('.sqlite') || archiveFilePath.toLowerCase().endsWith('.db')) {
      // Restore from a direct SQLite database file
      extractedDbPath = archiveFilePath;
      const parentDir = dirname(archiveFilePath);
      const possibleAtt = join(parentDir, '..', 'Customers', 'attachments');
      if (existsSync(possibleAtt)) {
        extractedAttachments = possibleAtt;
      }
    } else {
      // 2. Unpack standard .tgbak archive
      await execFileAsync('tar', ['-xzf', archiveFilePath, '-C', tempExtractDir]);

      // 3. Verify manifest
      const manifestFile = join(tempExtractDir, 'manifest.json');
      if (!existsSync(manifestFile)) {
        throw new Error('Backup archive is corrupt: missing manifest.json');
      }
      const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as BackupManifest;
      schemaVersion = manifest.schemaVersion;

      const defaultDb = join(tempExtractDir, 'database', 'crm.sqlite');
      if (!existsSync(defaultDb)) {
        throw new Error('Backup archive does not contain a database file');
      }
      extractedDbPath = defaultDb;
      extractedAttachments = join(tempExtractDir, 'attachments');
    }

    // 4. Verify restored database file integrity
    const verifyDb = new Database(extractedDbPath);
    const integrity = verifyDatabaseIntegrity(verifyDb);
    verifyDb.close();

    if (!integrity.ok) {
      throw new Error(`Restored database failed integrity check: ${integrity.message}`);
    }

    // 5. Checkpoint and close the active database
    checkpointDatabase();

    // 6. Replace live database with restored database
    cpSync(extractedDbPath, config.dbFilePath, { force: true });

    // 7. Restore attachments if present
    if (extractedAttachments && existsSync(extractedAttachments)) {
      cpSync(extractedAttachments, config.attachmentsPath, { recursive: true, force: true });
    }

    // 8. Reopen database at current location
    reopenDatabase(config.dbFilePath);

    // 9. Clean up staging folder
    if (existsSync(tempExtractDir)) {
      try {
        rmSync(tempExtractDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    logAudit('BACKUP_RESTORED', 'backup', basename(archiveFilePath), {
      sourceArchive: archiveFilePath,
      schemaVersion,
      safetyRecoveryBackup: recoveryBackupPath,
    });

    return ok({
      success: true,
      recoveryBackupPath,
    });
  } catch (err) {
    console.error('[BackupService.restoreBackup] Restore failed:', err);

    if (existsSync(tempExtractDir)) {
      try {
        rmSync(tempExtractDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    // Ensure database remains open
    if (!isDatabaseInitialized()) {
      try {
        reopenDatabase(config.dbFilePath);
      } catch {
        // ignore
      }
    }

    return fail('INTERNAL_ERROR', `Restore failed: ${(err as Error).message}. Active database was preserved.`);
  }
}

/**
 * Background backup scheduler.
 */
export function startBackupScheduler(): void {
  stopBackupScheduler();

  const checkAndRunBackup = async () => {
    try {
      if (!isDatabaseInitialized()) return;
      const config = getStoredBackupConfig();
      if (!config.autoBackupEnabled) return;

      const intervalMs = (config.intervalHours || 24) * 3600 * 1000;
      const lastBackupMs = config.lastBackupTime ? new Date(config.lastBackupTime).getTime() : 0;
      const now = Date.now();

      if (now - lastBackupMs >= intervalMs) {
        console.info('[BackupScheduler] Running scheduled automatic backup...');
        await createBackup(config.customBackupPath);
      }
    } catch (err) {
      console.error('[BackupScheduler] Scheduled backup check failed:', err);
    }
  };

  // Check on launch after a brief delay (15s), then every 30 minutes
  setTimeout(checkAndRunBackup, 15000);
  _backupTimer = setInterval(checkAndRunBackup, 30 * 60 * 1000);
}

export function stopBackupScheduler(): void {
  if (_backupTimer) {
    clearInterval(_backupTimer);
    _backupTimer = null;
  }
}

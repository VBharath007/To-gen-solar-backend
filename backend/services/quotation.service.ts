import { getDb } from '../database/connection';
import type { Quotation, CreateQuotationDto, UpdateQuotationDto } from '@shared/types/quotation.types';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';
import { normalizePhoneNumber } from '@shared/utils/phone';

/**
 * Automatically generates a unique, sequential quotation number for the current year.
 * Format: QRYYYYNN (e.g., QR202601, QR202602, ..., QR202701)
 *
 * Requirements:
 * - Detects current 4-digit year automatically from server/system date.
 * - Starts from 01 for a new year or when no quotes exist for the year.
 * - Safely increments using document_sequences (atomic row-level lock in transaction).
 * - Never reuses deleted quotation numbers (document_sequences only increments).
 * - Enforces uniqueness: checks quotations table to avoid duplicate collisions.
 */
export function generateQuotationNumber(db: any): string {
  const currentYear = new Date().getFullYear();
  const series = `QUO_${currentYear}`;
  const prefix = `QR${currentYear}`;

  // Check if sequence row exists for the current year
  const seqRow = db.prepare('SELECT last_value FROM document_sequences WHERE series = ?').get(series) as { last_value: number } | undefined;

  if (!seqRow) {
    // Look up any existing quotations created for this year (e.g. QR202601) to find current max
    const existingQuotes = db.prepare(`
      SELECT reference FROM quotations WHERE reference LIKE ?
    `).all(`${prefix}%`) as { reference: string }[];

    let maxSeq = 0;
    for (const q of existingQuotes) {
      const numPart = q.reference.slice(prefix.length);
      const val = parseInt(numPart, 10);
      if (!isNaN(val) && val > maxSeq) {
        maxSeq = val;
      }
    }

    db.prepare(`
      INSERT OR IGNORE INTO document_sequences (series, last_value) VALUES (?, ?)
    `).run(series, maxSeq);
  }

  // Atomically increment the sequence
  let row = db.prepare(`
    UPDATE document_sequences 
    SET last_value = last_value + 1 
    WHERE series = ? 
    RETURNING last_value
  `).get(series) as { last_value: number } | undefined;

  let n = row?.last_value ?? 1;
  let reference = `${prefix}${String(n).padStart(2, '0')}`;

  // Duplicate safety check: ensure the quotation number is truly unused
  while (db.prepare('SELECT 1 FROM quotations WHERE reference = ?').get(reference)) {
    const nextRow = db.prepare(`
      UPDATE document_sequences 
      SET last_value = last_value + 1 
      WHERE series = ? 
      RETURNING last_value
    `).get(series) as { last_value: number };
    n = nextRow.last_value;
    reference = `${prefix}${String(n).padStart(2, '0')}`;
  }

  return reference;
}

const generateReference = generateQuotationNumber;

/**
 * Automatically checks and synchronizes expired quotations in the database.
 * Requirement:
 * - A quotation ONLY expires if it was issued (has an issue_date).
 * - Drafts without issue_date never expire and have valid_until = NULL.
 * - 7 days (or validity_days) after issue_date, status becomes 'Expired'.
 */
export function syncExpiredQuotations(db: any): void {
  try {
    // 1. Clear valid_until and reset status for draft quotations that do not have an issue_date
    db.prepare(`
      UPDATE quotations
      SET valid_until = NULL
      WHERE issue_date IS NULL AND status = 'Draft' AND valid_until IS NOT NULL
    `).run();

    // 2. Revert any draft quotations without issue_date that were mistakenly marked Expired
    db.prepare(`
      UPDATE quotations
      SET status = 'Draft',
          valid_until = NULL,
          updated_at = datetime('now')
      WHERE issue_date IS NULL AND status = 'Expired'
    `).run();

    // 3. For ISSUED quotations, ensure valid_until is set to 7 days from issue_date if null
    db.prepare(`
      UPDATE quotations
      SET valid_until = date(issue_date, '+' || COALESCE(validity_days, 7) || ' days')
      WHERE issue_date IS NOT NULL AND valid_until IS NULL
    `).run();

    // 4. Mark ISSUED quotations whose valid_until (or 7 days from issue_date) has passed as Expired
    db.prepare(`
      UPDATE quotations
      SET status = 'Expired',
          updated_at = datetime('now')
      WHERE status = 'Issued'
        AND issue_date IS NOT NULL
        AND date(COALESCE(valid_until, date(issue_date, '+' || COALESCE(validity_days, 7) || ' days'))) < date('now', 'localtime')
    `).run();
  } catch (err) {
    console.error('[QuotationService.syncExpiredQuotations]', err);
  }
}

/**
 * Ensures any existing manual customer quotations have matching customer & site records.
 */
export function syncManualCustomersToCustomerRecords(db: any): void {
  try {
    const unlinkedManualQuotes = db.prepare(`
      SELECT id, manual_customer_name, manual_customer_phone, manual_customer_email, manual_customer_address, customer_id, site_id
      FROM quotations
      WHERE is_manual_customer = 1 AND (customer_id IS NULL OR customer_id = 0) AND manual_customer_name IS NOT NULL
    `).all() as any[];

    for (const q of unlinkedManualQuotes) {
      const resolved = resolveOrCreateManualCustomer(db, q);
      if (resolved.customerId) {
        db.prepare('UPDATE quotations SET customer_id = ?, site_id = ? WHERE id = ?').run(
          resolved.customerId,
          resolved.siteId,
          q.id
        );
      }
    }
  } catch (err) {
    console.error('[QuotationService.syncManualCustomersToCustomerRecords]', err);
  }
}

/**
 * Ensures any quotations whose amounts were stored in Rupees are converted to Paise.
 */
export function syncQuotationAmounts(db: any): void {
  try {
    db.prepare(`
      UPDATE quotations 
      SET grand_total = grand_total * 100,
          subtotal = subtotal * 100,
          total_tax = CASE WHEN total_tax > 0 AND total_tax < 100000 THEN total_tax * 100 ELSE total_tax END,
          total_discount = CASE WHEN total_discount > 0 AND total_discount < 100000 THEN total_discount * 100 ELSE total_discount END
      WHERE grand_total > 0 AND grand_total < 100000
    `).run();
  } catch (err) {
    console.error('[QuotationService.syncQuotationAmounts]', err);
  }
}

export function listQuotations(): ApiResponse<Quotation[]> {
  try {
    const db = getDb();
    syncExpiredQuotations(db);
    syncManualCustomersToCustomerRecords(db);
    syncQuotationAmounts(db);
    const rows = db.prepare(`
      SELECT 
        q.*, 
        COALESCE(c.name, q.manual_customer_name, 'Customer') as customerName, 
        COALESCE(c.phone, q.manual_customer_phone, '') as customerPhone,
        COALESCE(c.email, q.manual_customer_email, '') as customerEmail,
        COALESCE(
          CASE WHEN i.address IS NOT NULL THEN (i.address || ', ' || i.city) ELSE NULL END,
          q.manual_customer_address,
          'N/A'
        ) as siteAddress
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN installation_sites i ON q.site_id = i.id
      ORDER BY q.created_at DESC
    `).all() as Quotation[];
    
    for (const q of rows) {
      if (q.grand_total && q.grand_total > 0 && q.grand_total < 100000) {
        q.grand_total = Math.round(q.grand_total * 100);
      }
      if (q.subtotal && q.subtotal > 0 && q.subtotal < 100000) {
        q.subtotal = Math.round(q.subtotal * 100);
      }
      if (q.total_tax && q.total_tax > 0 && q.total_tax < 100000) {
        q.total_tax = Math.round(q.total_tax * 100);
      }
      if (q.total_discount && q.total_discount > 0 && q.total_discount < 100000) {
        q.total_discount = Math.round(q.total_discount * 100);
      }

      if (q.payment_terms && typeof q.payment_terms === 'string') {
        if (q.payment_terms.includes('10 Days from the date of submission')) {
          q.payment_terms = q.payment_terms.replace(/10 Days from the date of submission/g, `${q.validity_days || 7} Days from the date of submission`);
        }
        if (q.payment_terms.includes('Within 10 Days from the date of receipt of the Purchase Order')) {
          q.payment_terms = q.payment_terms.replace(/Within 10 Days from the date of receipt of the Purchase Order/g, 'Within 7 Days from the date of receipt of the Purchase Order');
        }
      }
    }
    
    return ok(rows);
  } catch (error) {
    console.error('[QuotationService.listQuotations]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch quotations');
  }
}

export function getQuotation(id: number): ApiResponse<Quotation> {
  try {
    const db = getDb();
    syncExpiredQuotations(db);
    syncManualCustomersToCustomerRecords(db);
    syncQuotationAmounts(db);
    const q = db.prepare(`
      SELECT 
        q.*, 
        COALESCE(c.name, q.manual_customer_name, 'Customer') as customerName, 
        COALESCE(c.phone, q.manual_customer_phone, '') as customerPhone,
        COALESCE(c.email, q.manual_customer_email, '') as customerEmail,
        COALESCE(
          CASE WHEN i.address IS NOT NULL THEN (i.address || ', ' || i.city) ELSE NULL END,
          q.manual_customer_address,
          'N/A'
        ) as siteAddress
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN installation_sites i ON q.site_id = i.id
      WHERE q.id = ?
    `).get(id) as Quotation | undefined;

    if (!q) return fail('NOT_FOUND', `Quotation with ID ${id} not found`);

    if (q.grand_total && q.grand_total > 0 && q.grand_total < 100000) {
      q.grand_total = Math.round(q.grand_total * 100);
    }
    if (q.subtotal && q.subtotal > 0 && q.subtotal < 100000) {
      q.subtotal = Math.round(q.subtotal * 100);
    }
    if (q.total_tax && q.total_tax > 0 && q.total_tax < 100000) {
      q.total_tax = Math.round(q.total_tax * 100);
    }
    if (q.total_discount && q.total_discount > 0 && q.total_discount < 100000) {
      q.total_discount = Math.round(q.total_discount * 100);
    }
    if (q.state_subsidy && q.state_subsidy > 0 && q.state_subsidy < 50000) {
      q.state_subsidy = Math.round(q.state_subsidy * 100);
    }
    if (q.central_subsidy && q.central_subsidy > 0 && q.central_subsidy < 50000) {
      q.central_subsidy = Math.round(q.central_subsidy * 100);
    }

    if (q.payment_terms && typeof q.payment_terms === 'string') {
      if (q.payment_terms.includes('10 Days from the date of submission')) {
        q.payment_terms = q.payment_terms.replace(/10 Days from the date of submission/g, `${q.validity_days || 7} Days from the date of submission`);
      }
      if (q.payment_terms.includes('Within 10 Days from the date of receipt of the Purchase Order')) {
        q.payment_terms = q.payment_terms.replace(/Within 10 Days from the date of receipt of the Purchase Order/g, 'Within 7 Days from the date of receipt of the Purchase Order');
      }
    }

    q.items = db.prepare(`SELECT * FROM quotation_items WHERE quotation_id = ?`).all(id) as any[];
    const rawTech = db.prepare(`SELECT * FROM quotation_technical_details WHERE quotation_id = ?`).get(id) as any || null;
    if (rawTech) {
      rawTech.system_capacity_kw = rawTech.system_capacity_kw ?? rawTech.dc_capacity_kwp ?? null;
      rawTech.structure_type = rawTech.structure_type ?? rawTech.mounting_structure ?? null;
      rawTech.area_required_sqft = rawTech.area_required_sqft ?? rawTech.shadow_free_sqft ?? rawTech.roof_area_sqft ?? null;
      rawTech.battery_capacity = rawTech.battery_capacity ?? rawTech.battery_ah ?? null;
      rawTech.battery_quantity = rawTech.battery_quantity ?? rawTech.battery_count ?? null;
    }
    q.technicalDetails = rawTech;
    q.milestones = db.prepare(`SELECT * FROM quotation_milestones WHERE quotation_id = ? ORDER BY sl_no`).all(id) as any[];
    q.documents = null;

    const rawScope = db.prepare(`SELECT * FROM quotation_scope WHERE quotation_id = ?`).get(id) as any;
    if (rawScope) {
      q.scope = {
        ...rawScope,
        roof_access: Boolean(rawScope.roof_access),
        water_supply: Boolean(rawScope.water_supply),
        power_point: Boolean(rawScope.power_point),
        shadow_free: Boolean(rawScope.shadow_free),
        internet_available: Boolean(rawScope.internet_available),
      };
    } else {
      q.scope = null;
    }

    q.sitePhotos = (db.prepare(`SELECT * FROM quotation_site_photos WHERE quotation_id = ? ORDER BY photo_order ASC, id ASC`).all(id) as any[] || []).map((sp: any) => ({
      ...sp,
      description: sp.caption || '',
    }));

    return ok(q);
  } catch (error) {
    console.error('[QuotationService.getQuotation]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch quotation');
  }
}

function normalizeTechDetails(td: any, quotationId: number) {
  if (!td) return null;
  const sysCap = td.system_capacity_kw ?? td.dc_capacity_kwp ?? null;
  const structType = td.structure_type ?? td.mounting_structure ?? null;
  const structMat = td.structure_material ?? null;
  const areaReq = td.area_required_sqft ?? td.shadow_free_sqft ?? td.roof_area_sqft ?? null;
  const panelSpecs = td.panel_specs ?? null;
  const inverterSpecs = td.inverter_specs ?? null;
  const dailyGen = td.daily_generation_est ?? null;
  const batteryType = td.battery_type ?? null;
  const batteryCap = td.battery_capacity ?? td.battery_ah ?? null;
  const batteryQty = td.battery_quantity ?? td.battery_count ?? null;

  const lightType = td.light_type ?? null;
  const slPanelType = td.sl_panel_type ?? null;
  const poleMaterial = td.pole_material ?? null;
  const poleHeightFt = td.pole_height_ft !== undefined && td.pole_height_ft !== null && td.pole_height_ft !== ''
    ? Number(td.pole_height_ft)
    : (td.pole_height_m ? Math.round(Number(td.pole_height_m) * 3.28084 * 10) / 10 : null);
  const wattage = td.luminaire_wattage_w ?? td.wattage ?? null;
  const pumpSysType = td.pump_system_type ?? 'Water Pump';
  const cameraMp = td.camera_mp ?? null;
  const memoryCardCap = td.memory_card_capacity ?? null;
  const structureHeight = td.structure_height !== undefined && td.structure_height !== null && td.structure_height !== '' ? String(td.structure_height) : null;

  return {
    quotation_id: quotationId,
    use_type: td.use_type ?? null,
    dc_capacity_kwp: sysCap,
    system_capacity_kw: sysCap,
    ac_capacity_kw: td.ac_capacity_kw ?? sysCap,
    panel_count: td.panel_count ?? null,
    panel_wattage_w: td.panel_wattage_w ?? null,
    inverter_capacity_kw: td.inverter_capacity_kw ?? (typeof inverterSpecs === 'string' && parseFloat(inverterSpecs) ? parseFloat(inverterSpecs) : null),
    battery_count: batteryQty,
    battery_quantity: batteryQty,
    battery_ah: batteryCap,
    battery_capacity: batteryCap,
    battery_type: batteryType,
    battery_v: td.battery_v ?? null,
    mounting_structure: structType,
    structure_type: structType,
    structure_material: structMat,
    connection_type: td.connection_type ?? null,
    roof_area_sqft: areaReq,
    shadow_free_sqft: areaReq,
    area_required_sqft: areaReq,
    tilt_angle_deg: td.tilt_angle_deg ?? null,
    orientation: td.orientation ?? null,
    luminaire_wattage_w: wattage !== null ? Number(wattage) : null,
    light_type: lightType,
    sl_panel_type: slPanelType,
    pole_material: poleMaterial,
    pole_height_ft: poleHeightFt,
    pole_height_m: td.pole_height_m ?? (poleHeightFt ? Math.round(poleHeightFt * 0.3048 * 10) / 10 : null),
    pole_type: td.pole_type ?? poleMaterial,
    sl_panel_w: td.sl_panel_w ?? null,
    sl_battery_ah: td.sl_battery_ah ?? null,
    pump_system_type: pumpSysType,
    pump_hp: td.pump_hp !== null && td.pump_hp !== undefined && td.pump_hp !== '' ? Number(td.pump_hp) : null,
    pump_rating_kw: td.pump_rating_kw !== null && td.pump_rating_kw !== undefined && td.pump_rating_kw !== '' ? Number(td.pump_rating_kw) : (sysCap !== null ? Number(sysCap) : null),
    vfd_model: td.vfd_model ?? null,
    head_m: td.head_m ?? null,
    flow_lph: td.flow_lph ?? null,
    pump_phase: td.pump_phase ?? null,
    pump_panel_count: td.pump_panel_count ?? null,
    camera_count: td.camera_count ?? null,
    camera_model: td.camera_model ?? null,
    recording_type: td.recording_type ?? null,
    storage_days: td.storage_days ?? null,
    connectivity: td.connectivity ?? null,
    camera_mp: cameraMp,
    memory_card_capacity: memoryCardCap,
    structure_height: structureHeight,
    service_description: td.service_description ?? null,
    service_date_from: td.service_date_from ?? null,
    service_date_to: td.service_date_to ?? null,
    labour_count: td.labour_count ?? null,
    labour_unit: td.labour_unit ?? null,
    labour_rate: td.labour_rate ?? null,
    supply_scope: td.supply_scope ?? null,
    exclusions: td.exclusions ?? null,
    panel_specs: panelSpecs,
    inverter_specs: inverterSpecs,
    daily_generation_est: dailyGen,
  };
}

function resolveOrCreateManualCustomer(
  db: any,
  data: {
    manual_customer_name?: string | null;
    manual_customer_phone?: string | null;
    manual_customer_email?: string | null;
    manual_customer_address?: string | null;
    manual_customer_city?: string | null;
    business_category?: string | null;
    customer_id?: number | null;
    site_id?: number | null;
  }
): { customerId: number | null; siteId: number | null } {
  const cleanName = data.manual_customer_name?.trim() || '';
  if (!cleanName) {
    return { customerId: data.customer_id || null, siteId: data.site_id || null };
  }

  const rawPhone = data.manual_customer_phone?.trim() || '';
  const cleanPhone = rawPhone ? normalizePhoneNumber(rawPhone) : '';
  const cleanEmail = data.manual_customer_email?.trim() || null;
  const rawAddress = data.manual_customer_address?.trim() || '';
  const cleanCity = data.manual_customer_city?.trim() || (rawAddress ? rawAddress.split(',').pop()?.trim() : '') || 'Local';
  const cleanAddress = rawAddress || 'Main Installation Site';

  // 1. If phone is present in leads, remove it from leads so DB trigger doesn't conflict
  if (cleanPhone) {
    const leadRow = db.prepare('SELECT id FROM leads WHERE phone = ?').get(cleanPhone) as { id: number } | undefined;
    if (leadRow) {
      db.prepare('DELETE FROM leads WHERE id = ?').run(leadRow.id);
    }
  }

  // 2. Find or create customer in customers table
  let customerId: number | null = data.customer_id || null;
  let existingCust: any = null;

  if (cleanPhone) {
    existingCust = db.prepare('SELECT id, name, phone, email, address, city, business_category FROM customers WHERE phone = ?').get(cleanPhone);
  }
  if (!existingCust && cleanName) {
    existingCust = db.prepare('SELECT id, name, phone, email, address, city, business_category FROM customers WHERE LOWER(name) = LOWER(?)').get(cleanName);
  }

  if (existingCust) {
    customerId = existingCust.id;
    // Update missing details if any
    const updates: string[] = [];
    const params: any[] = [];
    if (!existingCust.email && cleanEmail) {
      updates.push('email = ?');
      params.push(cleanEmail);
    }
    if (!existingCust.address && rawAddress) {
      updates.push('address = ?');
      params.push(rawAddress);
    }
    if (!existingCust.city && cleanCity && cleanCity !== 'Local') {
      updates.push('city = ?');
      params.push(cleanCity);
    }
    if (!existingCust.business_category && data.business_category) {
      updates.push('business_category = ?');
      params.push(data.business_category);
    }
    if (updates.length > 0) {
      params.push(customerId);
      db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
  } else {
    const phoneToInsert = cleanPhone || '0000000000';
    const custInsert = db.prepare(`
      INSERT INTO customers (name, phone, email, address, city, customer_type, business_category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(cleanName, phoneToInsert, cleanEmail, rawAddress || null, cleanCity || null, (data as any).manual_customer_type || 'Individual', data.business_category || null);
    customerId = custInsert.lastInsertRowid as number;
  }

  // 3. Find or create installation site for this customer in installation_sites table
  let siteId: number | null = data.site_id || null;
  if (customerId) {
    const existingSite = db.prepare('SELECT id FROM installation_sites WHERE customer_id = ? AND LOWER(address) = LOWER(?)').get(customerId, cleanAddress) as { id: number } | undefined;
    if (existingSite) {
      siteId = existingSite.id;
    } else {
      const anySite = db.prepare('SELECT id FROM installation_sites WHERE customer_id = ?').get(customerId) as { id: number } | undefined;
      if (anySite && !rawAddress) {
        siteId = anySite.id;
      } else {
        const siteInsert = db.prepare(`
          INSERT INTO installation_sites (customer_id, address, city)
          VALUES (?, ?, ?)
        `).run(customerId, cleanAddress, cleanCity || 'Local');
        siteId = siteInsert.lastInsertRowid as number;
      }
    }
  }

  return { customerId, siteId };
}

export function createQuotation(dto: CreateQuotationDto): ApiResponse<Quotation> {
  const db = getDb();
  try {
    let newId = 0;
    
    db.transaction(() => {
      const reference = generateReference(db);
      
      let businessSnapshot: string | null = null;
      try {
        const bRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'business_info'`).get() as { value: string } | undefined;
        if (bRow?.value) businessSnapshot = bRow.value;
      } catch { /* ignore */ }

      // Compute backend totals
      const taxInclusive = !!dto.tax_inclusive;
      if (dto.subtotal !== undefined && Number(dto.subtotal) > 0 && Number(dto.subtotal) < 100000) {
        dto.subtotal = Math.round(Number(dto.subtotal) * 100);
      }
      if (dto.grand_total !== undefined && Number(dto.grand_total) > 0 && Number(dto.grand_total) < 100000) {
        dto.grand_total = Math.round(Number(dto.grand_total) * 100);
      }
      if (dto.total_tax !== undefined && Number(dto.total_tax) > 0 && Number(dto.total_tax) < 100000 && dto.grand_total && Number(dto.total_tax) < (Number(dto.grand_total) / 100)) {
        dto.total_tax = Math.round(Number(dto.total_tax) * 100);
      }
      let subtotal = 0, totalTax = 0;
      let computedSubtotal = 0, computedTotalTax = 0;
      
      const processedItems = (dto.items || []).map(item => {
        const qty = Number(item.quantity) || 0;
        const up  = Math.round(Number(item.unit_price) || 0);
        const disc= Math.round(Number(item.discount) || 0);
        const rate= Number(item.tax_rate) || 0;
        
        let gross = Math.round(qty * up);
        let taxable = gross - disc;
        if (taxable < 0) taxable = 0;
        
        let taxAmt = 0, lineTotal = 0;
        if (taxInclusive) {
          taxAmt = Math.round(taxable - taxable / (1 + rate / 100));
          lineTotal = taxable;
          taxable = lineTotal - taxAmt;
        } else {
          taxAmt = Math.round(taxable * rate / 100);
          lineTotal = taxable + taxAmt;
        }
        
        computedSubtotal += taxable;
        computedTotalTax += taxAmt;
        
        return {
          ...item,
          taxable_value: taxable,
          tax_amount_line: taxAmt,
          total: lineTotal,
          cgst_rate: rate / 2,
          sgst_rate: rate / 2,
          igst_rate: 0
        };
      });

      // Prefer explicitly provided subtotal/tax (from manual edits in UI) over computed items sum
      subtotal = dto.subtotal !== undefined ? Number(dto.subtotal) : computedSubtotal;
      totalTax = dto.total_tax !== undefined ? Number(dto.total_tax) : computedTotalTax;

      // Validate total_discount
      const rawDiscount = dto.total_discount !== undefined ? Number(dto.total_discount) : 0;
      if (isNaN(rawDiscount) || !isFinite(rawDiscount)) {
        throw new Error('VALIDATION_ERROR: Please enter a valid discount value.');
      }
      if (rawDiscount < 0) {
        throw new Error('VALIDATION_ERROR: Negative amount is not allowed.');
      }

      const maxDiscountPaise = subtotal > 0 ? Math.floor(subtotal * 0.20) : 0;
      if (rawDiscount > maxDiscountPaise) {
        const maxRupees = maxDiscountPaise / 100;
        const formattedMax = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(maxRupees);
        throw new Error(`VALIDATION_ERROR: Discount cannot exceed 20% of the actual price. Maximum allowed: ${formattedMax}.`);
      }

      const priceAfterDiscount = subtotal - rawDiscount;
      const grandTotal = dto.grand_total !== undefined
        ? Number(dto.grand_total)
        : (taxInclusive && (!dto.items || dto.items.length === 0) ? priceAfterDiscount : priceAfterDiscount + totalTax);

      if (priceAfterDiscount < 0 || grandTotal < 0) {
        throw new Error('VALIDATION_ERROR: Please ensure the grand total is not negative.');
      }

      if (dto.status === 'Expired') {
        throw new Error('VALIDATION_ERROR: Quotation status cannot be manually set to Expired. It expires automatically 7 days after the issue date.');
      }

      const isManualCustomer = !!dto.is_manual_customer;
      let customerId = isManualCustomer ? null : (dto.customer_id || null);
      let siteId = isManualCustomer ? null : (dto.site_id || null);

      const validityDays = dto.validity_days ? Number(dto.validity_days) : 7;
      let calculatedValidUntil: string | null = null;
      if (dto.issue_date) {
        const baseDate = new Date(dto.issue_date);
        calculatedValidUntil = dto.valid_until || new Date(baseDate.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (dto.status === 'Issued') {
        calculatedValidUntil = dto.valid_until || new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      if (isManualCustomer) {
        if (!dto.manual_customer_name || !dto.manual_customer_name.trim()) {
          throw new Error('VALIDATION_ERROR: Customer name is required for manual customer.');
        }
        if (dto.manual_customer_name.trim().length < 3) {
          throw new Error('VALIDATION_ERROR: Customer name must be at least 3 characters.');
        }
        if (!/^[a-zA-Z\s]+$/.test(dto.manual_customer_name.trim())) {
          throw new Error('VALIDATION_ERROR: Customer name can only contain letters and spaces (no numbers or special characters).');
        }
        if (dto.manual_customer_phone) {
          const digits = dto.manual_customer_phone.replace(/\D/g, '');
          if (digits.length !== 10) {
            throw new Error('VALIDATION_ERROR: Phone number must be exactly 10 digits.');
          }
        }

        // Save newly entered customer details into customers & installation_sites database
        const resolved = resolveOrCreateManualCustomer(db, dto);
        customerId = resolved.customerId;
        siteId = resolved.siteId;
      }

      const qInfo = db.prepare(`
        INSERT INTO quotations (
          reference, version, customer_id, site_id, status, issue_date, valid_until,
          subtotal, total_discount, total_tax, grand_total, payment_terms, business_snapshot,
          business_category, system_type, tax_inclusive, validity_days, quotation_type, project_type, notes_internal,
          is_manual_customer, manual_customer_name, manual_customer_phone, manual_customer_email, manual_customer_address,
          state_subsidy, central_subsidy, bank_account_id
        ) VALUES (
          @reference, 1, @customer_id, @site_id, @status, @issue_date, @valid_until,
          @subtotal, @total_discount, @total_tax, @grand_total, @payment_terms, @business_snapshot,
          @business_category, @system_type, @tax_inclusive, @validity_days, @quotation_type, @project_type, @notes_internal,
          @is_manual_customer, @manual_customer_name, @manual_customer_phone, @manual_customer_email, @manual_customer_address,
          @state_subsidy, @central_subsidy, @bank_account_id
        )
      `).run({
        reference,
        customer_id: customerId,
        site_id: siteId,
        status: dto.status || 'Draft',
        issue_date: dto.issue_date || null,
        valid_until: calculatedValidUntil,
        subtotal: subtotal,
        total_discount: rawDiscount,
        total_tax: totalTax,
        grand_total: grandTotal,
        payment_terms: dto.payment_terms || null,
        business_snapshot: businessSnapshot,
        business_category: dto.business_category || null,
        system_type: dto.system_type || null,
        tax_inclusive: taxInclusive ? 1 : 0,
        validity_days: validityDays,
        quotation_type: dto.quotation_type || 'Quotation',
        project_type: dto.project_type || null,
        notes_internal: dto.notes_internal || null,
        is_manual_customer: isManualCustomer ? 1 : 0,
        manual_customer_name: isManualCustomer ? (dto.manual_customer_name?.trim() || null) : null,
        manual_customer_phone: isManualCustomer ? (dto.manual_customer_phone?.trim() || null) : null,
        manual_customer_email: isManualCustomer ? (dto.manual_customer_email?.trim() || null) : null,
        manual_customer_address: isManualCustomer ? (dto.manual_customer_address?.trim() || null) : null,
        state_subsidy: dto.state_subsidy ? (Number(dto.state_subsidy) > 0 && Number(dto.state_subsidy) < 50000 ? Math.round(Number(dto.state_subsidy) * 100) : Math.round(Number(dto.state_subsidy))) : 0,
        central_subsidy: dto.central_subsidy ? (Number(dto.central_subsidy) > 0 && Number(dto.central_subsidy) < 50000 ? Math.round(Number(dto.central_subsidy) * 100) : Math.round(Number(dto.central_subsidy))) : 0,
        bank_account_id: dto.bank_account_id || null,
      });

      newId = qInfo.lastInsertRowid as number;

      // Insert items
      if (processedItems.length > 0) {
        const insertItem = db.prepare(`
          INSERT INTO quotation_items (
            quotation_id, item_type, item_id, name, description, quantity, unit_price, discount, tax_rate, total,
            hsn_sac, taxable_value, cgst_rate, sgst_rate, igst_rate, tax_amount_line, quantity_basis, quantity_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of processedItems) {
          insertItem.run(
            newId, item.item_type, item.item_id, item.name, item.description || null,
            item.quantity, item.unit_price, item.discount || 0, item.tax_rate || 0, item.total,
            item.hsn_sac || null, item.taxable_value, item.cgst_rate, item.sgst_rate, item.igst_rate,
            item.tax_amount_line, item.quantity_basis || 'fixed', item.quantity_notes || null
          );
        }
      }

      // Insert technical details
      if (dto.technicalDetails) {
        const norm = normalizeTechDetails(dto.technicalDetails, newId);
        if (norm) {
          db.prepare(`
            INSERT INTO quotation_technical_details (
              quotation_id, use_type, dc_capacity_kwp, ac_capacity_kw, panel_count, panel_wattage_w,
              inverter_capacity_kw, battery_count, battery_ah, battery_v, mounting_structure, connection_type,
              roof_area_sqft, shadow_free_sqft, tilt_angle_deg, orientation,
              luminaire_wattage_w, pole_height_m, pole_type, sl_panel_w, sl_battery_ah,
              pump_hp, pump_rating_kw, vfd_model, head_m, flow_lph, pump_phase, pump_panel_count,
              camera_count, camera_model, recording_type, storage_days, connectivity,
              service_description, service_date_from, service_date_to, labour_count, labour_unit, labour_rate,
              supply_scope, exclusions,
              system_capacity_kw, daily_generation_est, panel_specs, inverter_specs, structure_type, structure_material, area_required_sqft,
              battery_type, battery_capacity, battery_quantity,
              light_type, sl_panel_type, pole_material, pole_height_ft, pump_system_type, camera_mp, memory_card_capacity,
              structure_height
            ) VALUES (
              @quotation_id, @use_type, @dc_capacity_kwp, @ac_capacity_kw, @panel_count, @panel_wattage_w,
              @inverter_capacity_kw, @battery_count, @battery_ah, @battery_v, @mounting_structure, @connection_type,
              @roof_area_sqft, @shadow_free_sqft, @tilt_angle_deg, @orientation,
              @luminaire_wattage_w, @pole_height_m, @pole_type, @sl_panel_w, @sl_battery_ah,
              @pump_hp, @pump_rating_kw, @vfd_model, @head_m, @flow_lph, @pump_phase, @pump_panel_count,
              @camera_count, @camera_model, @recording_type, @storage_days, @connectivity,
              @service_description, @service_date_from, @service_date_to, @labour_count, @labour_unit, @labour_rate,
              @supply_scope, @exclusions,
              @system_capacity_kw, @daily_generation_est, @panel_specs, @inverter_specs, @structure_type, @structure_material, @area_required_sqft,
              @battery_type, @battery_capacity, @battery_quantity,
              @light_type, @sl_panel_type, @pole_material, @pole_height_ft, @pump_system_type, @camera_mp, @memory_card_capacity,
              @structure_height
            )
          `).run(norm);
        }
      }

      // Insert milestones
      if (dto.milestones && dto.milestones.length > 0) {
        const msInsert = db.prepare(`INSERT INTO quotation_milestones (quotation_id, sl_no, label, percentage, amount, due_trigger) VALUES (?, ?, ?, ?, ?, ?)`);
        dto.milestones.forEach((m: any, idx: number) => {
          const amt = Math.round(grandTotal * (m.percentage / 100));
          msInsert.run(newId, idx + 1, m.label, m.percentage, amt, m.due_trigger || null);
        });
      }



      // Insert customer scope
      if (dto.scope) {
        db.prepare(`
          INSERT INTO quotation_scope (
            quotation_id, notes, roof_access, water_supply, power_point, shadow_free, internet_available
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          newId,
          dto.scope.notes || null,
          dto.scope.roof_access ? 1 : 0,
          dto.scope.water_supply ? 1 : 0,
          dto.scope.power_point ? 1 : 0,
          dto.scope.shadow_free ? 1 : 0,
          dto.scope.internet_available ? 1 : 0
        );
      }

      // Insert site photos (maximum 3 photos)
      if (dto.sitePhotos && dto.sitePhotos.length > 0) {
        const photoInsert = db.prepare(`
          INSERT INTO quotation_site_photos (
            quotation_id, photo_order, name, size, data_url, caption, uploaded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        dto.sitePhotos.slice(0, 3).forEach((p: any, idx: number) => {
          const cap = (p.description !== undefined && p.description !== null && String(p.description).trim().length > 0)
            ? String(p.description).trim()
            : (p.caption ? String(p.caption).trim() : null);
          photoInsert.run(
            newId,
            idx + 1,
            p.name || `Photo ${idx + 1}`,
            p.size ? String(p.size) : '0',
            p.data_url || p.url || '',
            cap,
            p.uploaded_at || new Date().toISOString()
          );
        });
      }

    })();

    return getQuotation(newId);
  } catch (error: any) {
    console.error('[QuotationService.createQuotation]', error);
    if (error.message?.startsWith('VALIDATION_ERROR:')) {
      return fail('VALIDATION_ERROR', error.message.replace('VALIDATION_ERROR: ', ''));
    }
    return fail('INTERNAL_ERROR', error.message || 'Failed to create quotation');
  }
}

export function updateQuotation(dto: UpdateQuotationDto): ApiResponse<Quotation> {
  const db = getDb();
  try {
    db.transaction(() => {
      const current = db.prepare('SELECT status, locked_at, subtotal, total_tax, total_discount, grand_total, validity_days, issue_date FROM quotations WHERE id = ?').get(dto.id) as { status: string, locked_at: string|null, subtotal: number, total_tax: number, total_discount: number, grand_total: number, validity_days?: number, issue_date?: string } | undefined;
      if (!current) throw new Error('NOT_FOUND');

      if (dto.status === 'Expired') {
        throw new Error('VALIDATION_ERROR: Quotation status cannot be manually set to Expired. It expires automatically 7 days after the issue date.');
      }

      const updates: string[] = [];
      const params: Record<string, any> = { id: dto.id };

      const updatableFields = [
        'customer_id', 'site_id', 'status', 'issue_date', 'valid_until', 'payment_terms',
        'business_category', 'system_type', 'tax_inclusive', 'validity_days', 'quotation_type',
        'project_type', 'notes_internal',
        'is_manual_customer', 'manual_customer_name', 'manual_customer_phone', 'manual_customer_email', 'manual_customer_address',
        'state_subsidy', 'central_subsidy', 'bank_account_id'
      ] as const;
      for (const field of updatableFields) {
        if ((dto as any)[field] !== undefined) {
          updates.push(`${field} = @${field}`);
          if (field === 'is_manual_customer' || field === 'tax_inclusive') {
            params[field] = (dto as any)[field] ? 1 : 0;
          } else if (field === 'state_subsidy' || field === 'central_subsidy') {
            const sVal = Number((dto as any)[field]);
            params[field] = (sVal > 0 && sVal < 50000) ? Math.round(sVal * 100) : (isNaN(sVal) ? 0 : Math.round(sVal));
          } else {
            params[field] = (dto as any)[field];
          }
        }
      }

      if (dto.is_manual_customer && dto.manual_customer_name) {
        const resolved = resolveOrCreateManualCustomer(db, dto);
        if (resolved.customerId) {
          params.customer_id = resolved.customerId;
          if (!updates.includes('customer_id = @customer_id')) {
            updates.push('customer_id = @customer_id');
          }
        }
        if (resolved.siteId) {
          params.site_id = resolved.siteId;
          if (!updates.includes('site_id = @site_id')) {
            updates.push('site_id = @site_id');
          }
        }
      }

      if (dto.status === 'Issued') {
        const issueDate = dto.issue_date || new Date().toISOString();
        params.issue_date = issueDate;
        if (!updates.includes('issue_date = @issue_date')) {
          updates.push('issue_date = @issue_date');
        }
        const vDays = dto.validity_days ? Number(dto.validity_days) : (current.validity_days || 7);
        const bDate = new Date(issueDate);
        params.valid_until = new Date(bDate.getTime() + vDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        if (!updates.includes('valid_until = @valid_until')) {
          updates.push('valid_until = @valid_until');
        }
      } else if (dto.issue_date !== undefined && dto.valid_until === undefined) {
        const vDays = dto.validity_days ? Number(dto.validity_days) : (current.validity_days || 7);
        const bDate = new Date(dto.issue_date);
        params.valid_until = new Date(bDate.getTime() + vDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        updates.push('valid_until = @valid_until');
      }

      const taxInclusive = dto.tax_inclusive !== undefined ? !!dto.tax_inclusive : false;
      if (dto.subtotal !== undefined && Number(dto.subtotal) > 0 && Number(dto.subtotal) < 100000) {
        dto.subtotal = Math.round(Number(dto.subtotal) * 100);
      }
      if (dto.grand_total !== undefined && Number(dto.grand_total) > 0 && Number(dto.grand_total) < 100000) {
        dto.grand_total = Math.round(Number(dto.grand_total) * 100);
      }
      if (dto.total_tax !== undefined && Number(dto.total_tax) > 0 && Number(dto.total_tax) < 100000 && dto.grand_total && Number(dto.total_tax) < (Number(dto.grand_total) / 100)) {
        dto.total_tax = Math.round(Number(dto.total_tax) * 100);
      }
      let subtotal = current.subtotal || 0;
      let totalTax = current.total_tax || 0;

      if (dto.items !== undefined) {
        let computedSubtotal = 0;
        let computedTotalTax = 0;
        const processedItems = (dto.items || []).map(item => {
          const qty = Number(item.quantity) || 0;
          const up  = Math.round(Number(item.unit_price) || 0);
          const disc= Math.round(Number(item.discount) || 0);
          const rate= Number(item.tax_rate) || 0;
          
          let gross = Math.round(qty * up);
          let taxable = gross - disc;
          if (taxable < 0) taxable = 0;
          
          let taxAmt = 0, lineTotal = 0;
          if (taxInclusive) {
            taxAmt = Math.round(taxable - taxable / (1 + rate / 100));
            lineTotal = taxable;
            taxable = lineTotal - taxAmt;
          } else {
            taxAmt = Math.round(taxable * rate / 100);
            lineTotal = taxable + taxAmt;
          }
          
          computedSubtotal += taxable;
          computedTotalTax += taxAmt;
          
          return {
            ...item,
            taxable_value: taxable,
            tax_amount_line: taxAmt,
            total: lineTotal,
            cgst_rate: rate / 2,
            sgst_rate: rate / 2,
            igst_rate: 0
          };
        });

        db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(dto.id);
        if (processedItems.length > 0) {
          const insertItem = db.prepare(`
            INSERT INTO quotation_items (
              quotation_id, item_type, item_id, name, description, quantity, unit_price, discount, tax_rate, total,
              hsn_sac, taxable_value, cgst_rate, sgst_rate, igst_rate, tax_amount_line, quantity_basis, quantity_notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const item of processedItems) {
            insertItem.run(
              dto.id, item.item_type, item.item_id, item.name, item.description || null,
              item.quantity, item.unit_price, item.discount || 0, item.tax_rate || 0, item.total,
              item.hsn_sac || null, item.taxable_value, item.cgst_rate, item.sgst_rate, item.igst_rate,
              item.tax_amount_line, item.quantity_basis || 'fixed', item.quantity_notes || null
            );
          }
        }

        // Prefer explicitly provided subtotal/tax (from manual edits in UI) over computed items sum
        subtotal = dto.subtotal !== undefined ? Number(dto.subtotal) : computedSubtotal;
        totalTax = dto.total_tax !== undefined ? Number(dto.total_tax) : computedTotalTax;

        updates.push('subtotal = @subtotal', 'total_tax = @total_tax');
        params.subtotal = subtotal;
        params.total_tax = totalTax;
      } else {
        if (dto.subtotal !== undefined) {
          subtotal = Number(dto.subtotal);
          updates.push('subtotal = @subtotal');
          params.subtotal = subtotal;
        }
        if (dto.total_tax !== undefined) {
          totalTax = Number(dto.total_tax);
          updates.push('total_tax = @total_tax');
          params.total_tax = totalTax;
        }
      }

      // Handle discount & grand total
      const rawDiscount = dto.total_discount !== undefined ? Number(dto.total_discount) : (current.total_discount || 0);
      if (isNaN(rawDiscount) || !isFinite(rawDiscount)) {
        throw new Error('VALIDATION_ERROR: Please enter a valid discount value.');
      }
      if (rawDiscount < 0) {
        throw new Error('VALIDATION_ERROR: Discount cannot be negative.');
      }

      const maxDiscountPaise = subtotal > 0 ? Math.floor(subtotal * 0.20) : 0;
      if (rawDiscount > maxDiscountPaise) {
        const maxRupees = maxDiscountPaise / 100;
        const formattedMax = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(maxRupees);
        throw new Error(`VALIDATION_ERROR: Discount cannot exceed 20% of the actual price. Maximum allowed: ${formattedMax}.`);
      }

      const priceAfterDiscount = subtotal - rawDiscount;
      const grandTotal = dto.grand_total !== undefined
        ? Number(dto.grand_total)
        : (taxInclusive && (!dto.items || dto.items.length === 0) ? priceAfterDiscount : priceAfterDiscount + totalTax);

      if (priceAfterDiscount < 0 || grandTotal < 0) {
        throw new Error('VALIDATION_ERROR: Please ensure the grand total is not negative.');
      }

      updates.push('total_discount = @total_discount', 'grand_total = @grand_total');
      params.total_discount = rawDiscount;
      params.grand_total = grandTotal;

      if (dto.status === 'Issued' && !current.locked_at) {
        updates.push(`locked_at = @locked_at`);
        params.locked_at = new Date().toISOString();
      }

      updates.push(`updated_at = datetime('now')`);

      if (updates.length > 0) {
        db.prepare(`UPDATE quotations SET ${updates.join(', ')} WHERE id = @id`).run(params);
      }

      // Update technical details if provided
      if (dto.technicalDetails !== undefined) {
        db.prepare('DELETE FROM quotation_technical_details WHERE quotation_id = ?').run(dto.id);
        if (dto.technicalDetails) {
          const norm = normalizeTechDetails(dto.technicalDetails, dto.id);
          if (norm) {
            db.prepare(`
              INSERT INTO quotation_technical_details (
                quotation_id, use_type, dc_capacity_kwp, ac_capacity_kw, panel_count, panel_wattage_w,
                inverter_capacity_kw, battery_count, battery_ah, battery_v, mounting_structure, connection_type,
                roof_area_sqft, shadow_free_sqft, tilt_angle_deg, orientation,
                luminaire_wattage_w, pole_height_m, pole_type, sl_panel_w, sl_battery_ah,
                pump_hp, pump_rating_kw, vfd_model, head_m, flow_lph, pump_phase, pump_panel_count,
                camera_count, camera_model, recording_type, storage_days, connectivity,
                service_description, service_date_from, service_date_to, labour_count, labour_unit, labour_rate,
                supply_scope, exclusions,
                system_capacity_kw, daily_generation_est, panel_specs, inverter_specs, structure_type, structure_material, area_required_sqft,
                battery_type, battery_capacity, battery_quantity,
                light_type, sl_panel_type, pole_material, pole_height_ft, pump_system_type, camera_mp, memory_card_capacity,
                structure_height
              ) VALUES (
                @quotation_id, @use_type, @dc_capacity_kwp, @ac_capacity_kw, @panel_count, @panel_wattage_w,
                @inverter_capacity_kw, @battery_count, @battery_ah, @battery_v, @mounting_structure, @connection_type,
                @roof_area_sqft, @shadow_free_sqft, @tilt_angle_deg, @orientation,
                @luminaire_wattage_w, @pole_height_m, @pole_type, @sl_panel_w, @sl_battery_ah,
                @pump_hp, @pump_rating_kw, @vfd_model, @head_m, @flow_lph, @pump_phase, @pump_panel_count,
                @camera_count, @camera_model, @recording_type, @storage_days, @connectivity,
                @service_description, @service_date_from, @service_date_to, @labour_count, @labour_unit, @labour_rate,
                @supply_scope, @exclusions,
                @system_capacity_kw, @daily_generation_est, @panel_specs, @inverter_specs, @structure_type, @structure_material, @area_required_sqft,
                @battery_type, @battery_capacity, @battery_quantity,
                @light_type, @sl_panel_type, @pole_material, @pole_height_ft, @pump_system_type, @camera_mp, @memory_card_capacity,
                @structure_height
              )
            `).run(norm);
          }
        }
      }

      // Update milestones if provided
      if (dto.milestones !== undefined) {
        db.prepare('DELETE FROM quotation_milestones WHERE quotation_id = ?').run(dto.id);
        if (dto.milestones && dto.milestones.length > 0) {
          const msInsert = db.prepare(`INSERT INTO quotation_milestones (quotation_id, sl_no, label, percentage, amount, due_trigger) VALUES (?, ?, ?, ?, ?, ?)`);
          dto.milestones.forEach((m: any, idx: number) => {
            const amt = Math.round(grandTotal * (m.percentage / 100));
            msInsert.run(dto.id, idx + 1, m.label, m.percentage, amt, m.due_trigger || null);
          });
        }
      }



      // Update scope if provided
      if (dto.scope !== undefined) {
        db.prepare('DELETE FROM quotation_scope WHERE quotation_id = ?').run(dto.id);
        if (dto.scope) {
          db.prepare(`
            INSERT INTO quotation_scope (
              quotation_id, notes, roof_access, water_supply, power_point, shadow_free, internet_available
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            dto.id,
            dto.scope.notes || null,
            dto.scope.roof_access ? 1 : 0,
            dto.scope.water_supply ? 1 : 0,
            dto.scope.power_point ? 1 : 0,
            dto.scope.shadow_free ? 1 : 0,
            dto.scope.internet_available ? 1 : 0
          );
        }
      }

      // Update site photos if provided (maximum 3 photos)
      if (dto.sitePhotos !== undefined) {
        db.prepare('DELETE FROM quotation_site_photos WHERE quotation_id = ?').run(dto.id);
        if (dto.sitePhotos && dto.sitePhotos.length > 0) {
          const photoInsert = db.prepare(`
            INSERT INTO quotation_site_photos (
              quotation_id, photo_order, name, size, data_url, caption, uploaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          dto.sitePhotos.slice(0, 3).forEach((p: any, idx: number) => {
            const cap = (p.description !== undefined && p.description !== null && String(p.description).trim().length > 0)
              ? String(p.description).trim()
              : (p.caption ? String(p.caption).trim() : null);
            photoInsert.run(
              dto.id,
              idx + 1,
              p.name || `Photo ${idx + 1}`,
              p.size ? String(p.size) : '0',
              p.data_url || p.url || '',
              cap,
              p.uploaded_at || new Date().toISOString()
            );
          });
        }
      }
    })();

    return getQuotation(dto.id);
  } catch (error: any) {
    console.error('[QuotationService.updateQuotation]', error);
    if (error.message?.startsWith('VALIDATION_ERROR:')) return fail('VALIDATION_ERROR', error.message.replace('VALIDATION_ERROR: ', ''));
    if (error.message === 'NOT_FOUND') return fail('NOT_FOUND', 'Quotation not found');
    return fail('INTERNAL_ERROR', error.message || 'Failed to update quotation');
  }
}

export function deleteQuotation(id: number): ApiResponse<{ success: boolean }> {
  const db = getDb();
  try {
    const existing = db.prepare('SELECT id, reference FROM quotations WHERE id = ?').get(id) as { id: number; reference: string } | undefined;
    if (!existing) {
      return fail('NOT_FOUND', `Quotation with ID ${id} not found`);
    }

    db.transaction(() => {
      db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').run(id);
      db.prepare('DELETE FROM quotation_technical_details WHERE quotation_id = ?').run(id);
      db.prepare('DELETE FROM quotation_milestones WHERE quotation_id = ?').run(id);

      db.prepare('DELETE FROM quotation_scope WHERE quotation_id = ?').run(id);
      db.prepare('DELETE FROM quotation_site_photos WHERE quotation_id = ?').run(id);
      db.prepare('UPDATE invoices SET quotation_id = NULL WHERE quotation_id = ?').run(id);
      db.prepare('UPDATE crm_documents SET quotation_id = NULL WHERE quotation_id = ?').run(id);
      db.prepare('DELETE FROM quotations WHERE id = ?').run(id);
    })();

    return ok({ success: true });
  } catch (error: any) {
    console.error('[QuotationService.deleteQuotation]', error);
    return fail('INTERNAL_ERROR', error.message || 'Failed to delete quotation');
  }
}


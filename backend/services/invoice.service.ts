import { getDb } from '../database/connection';
import type { Invoice, CreateInvoiceDto, UpdateInvoiceDto } from '@shared/types/finance.types';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';
import { formatNotesToPlainText } from '@shared/utils/notesFormatter';
import { syncProjectPaymentStatus } from './project.service';

// ─── Safe sequence generator (transaction-safe, no COUNT+1) ──────────────────
function nextRef(db: any, series: string): string {
  const year = new Date().getFullYear();
  const row = db.prepare(`
    UPDATE document_sequences SET last_value = last_value + 1 WHERE series = ? RETURNING last_value
  `).get(series) as { last_value: number } | undefined;
  const n = row?.last_value ?? 1;
  return `${series}-${year}-${String(n).padStart(4, '0')}`;
}

// ─── Validate invoice lines (backend enforcement) ───────────────────────────
function validateInvoiceLines(lines: any[]): void {
  if (lines.length > 500) {
    throw new Error('VALIDATION_ERROR: Maximum 500 items are allowed in an invoice.');
  }

  for (const line of lines) {
    if (line.quantity === undefined || line.quantity === null || line.quantity === '' || isNaN(Number(line.quantity)) || Number(line.quantity) < 1) {
      throw new Error('VALIDATION_ERROR: Quantity must be at least 1.');
    }

    const qty = Number(line.quantity);
    if (!Number.isInteger(qty)) {
      throw new Error('VALIDATION_ERROR: Quantity must be a whole number (no decimals).');
    }
    if (qty > 500) {
      throw new Error('VALIDATION_ERROR: Maximum allowed quantity is 500.');
    }

    if (line.unit !== undefined && line.unit !== null && line.unit !== '') {
      const unitNum = Number(line.unit);
      if (!isNaN(unitNum)) {
        if (!Number.isInteger(unitNum)) {
          throw new Error('VALIDATION_ERROR: Unit must be a whole number (no decimals).');
        }
        if (unitNum < 1) {
          throw new Error('VALIDATION_ERROR: Unit must be at least 1.');
        }
        if (unitNum > 99999) {
          throw new Error('VALIDATION_ERROR: Maximum allowed unit is 99,999.');
        }
      }
    }

    if (!line.unit_price || Number(line.unit_price) <= 0) {
      throw new Error('VALIDATION_ERROR: Line item rate must be greater than zero');
    }

    // unit_price in backend DTO is paise (so 10 Crore rupees = 10,00,00,000 paise)
    // or if passed in raw rupees, check against both
    const priceNum = Number(line.unit_price);
    const maxRatePaise = 100000000 * 100; // 10 Crore in paise
    if (priceNum > maxRatePaise) {
      throw new Error('VALIDATION_ERROR: Rate cannot exceed ₹10 Crore (100,00,00,000).');
    }

    // Discount percentage check: max 60%
    if (line.discount !== undefined && line.discount !== null && line.discount !== '') {
      const discNum = Number(line.discount);
      if (isNaN(discNum) || discNum < 0) {
        throw new Error('VALIDATION_ERROR: Discount cannot be negative.');
      }
      if (discNum > 60) {
        throw new Error('VALIDATION_ERROR: Discount cannot exceed 60%.');
      }
    }
  }
}

// ─── Compute line totals (backend authority) ──────────────────────────────────
function computeLineTotals(line: any, taxInclusive: boolean) {
  const isLineInclusive = line.tax_type ? line.tax_type === 'Inclusive' : taxInclusive;
  const qty = Number(line.quantity) || 0;
  const unitVal = parseFloat(String(line.unit || '1'));
  const unitMultiplier = !isNaN(unitVal) && unitVal > 0 ? unitVal : (line.unit === '0' || line.unit === 0 ? 0 : 1);
  const unitPrice = Math.round(Number(line.unit_price) || 0); // paise
  const discountRate = Math.min(60, Math.max(0, Number(line.discount) || 0)); // discount percentage (max 60%)
  const taxRate = Number(line.tax_rate) || 0; // percent

  let grossBeforeDiscount = Math.round(qty * unitMultiplier * unitPrice);
  let discountAmount = Math.round((grossBeforeDiscount * discountRate) / 100);
  let taxableValue = grossBeforeDiscount - discountAmount;
  if (taxableValue < 0) taxableValue = 0;

  let taxAmount = 0;
  let lineTotal = 0;

  if (isLineInclusive) {
    // Price already includes tax — back-calculate tax
    lineTotal = taxableValue; // already all-in
    taxAmount = Math.round(lineTotal - lineTotal / (1 + taxRate / 100));
    taxableValue = lineTotal - taxAmount;
  } else {
    taxAmount = Math.round(taxableValue * taxRate / 100);
    lineTotal = taxableValue + taxAmount;
  }

  // If explicit line_total was provided by client:
  if (line.line_total !== undefined && line.line_total !== null && Number(line.line_total) > 0) {
    lineTotal = Math.round(Number(line.line_total));
    if (line.taxable_value !== undefined && line.taxable_value !== null) {
      taxableValue = Math.round(Number(line.taxable_value));
    }
    if (line.tax_amount !== undefined && line.tax_amount !== null) {
      taxAmount = Math.round(Number(line.tax_amount));
    }
  }

  const cgstRate = line.cgst_rate != null ? Number(line.cgst_rate) : taxRate / 2;
  const sgstRate = line.sgst_rate != null ? Number(line.sgst_rate) : taxRate / 2;
  const igstRate = Number(line.igst_rate) || 0;

  return { taxableValue, taxAmount, lineTotal, cgstRate, sgstRate, igstRate };
}

// ─── Read helpers ────────────────────────────────────────────────────────────
function getInvoiceRaw(db: any, id: number): Invoice | undefined {
  return db.prepare(`
    SELECT i.*,
      COALESCE(c.name, 'Direct Customer')  as customer_name,
      c.phone as customer_phone,
      c.address as customer_address,
      c.city  as customer_city,
      c.state as customer_state,
      c.pincode as customer_pincode,
      c.gstin as customer_gstin,
      p.reference as project_reference,
      q.reference as quotation_reference
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN projects p ON i.project_id = p.id
    LEFT JOIN quotations q ON i.quotation_id = q.id
    WHERE i.id = ?
  `).get(id) as Invoice | undefined;
}

export function listInvoices(): ApiResponse<Invoice[]> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT i.*,
        COALESCE(c.name, 'Direct Customer')  as customer_name,
        c.phone as customer_phone,
        c.address as customer_address,
        c.city  as customer_city,
        c.state as customer_state,
        c.pincode as customer_pincode,
        c.gstin as customer_gstin,
        p.reference as project_reference,
        q.reference as quotation_reference
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      LEFT JOIN quotations q ON i.quotation_id = q.id
      ORDER BY i.issue_date DESC, i.id DESC
    `).all() as Invoice[];
    return ok(rows);
  } catch (error) {
    console.error('[InvoiceService.listInvoices]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch invoices');
  }
}

export function getInvoice(id: number): ApiResponse<Invoice> {
  try {
    const db = getDb();
    const row = getInvoiceRaw(db, id);
    if (!row) return fail('NOT_FOUND', `Invoice ${id} not found`);
    // Attach line items
    const lines = db.prepare(`SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY sl_no`).all(id);
    return ok({ ...row, lines } as any);
  } catch (error) {
    console.error('[InvoiceService.getInvoice]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch invoice');
  }
}

export function createInvoice(dto: CreateInvoiceDto): ApiResponse<Invoice> {
  try {
    const db = getDb();
    let newId = 0;

    db.transaction(() => {
      const reference = nextRef(db, 'INV');
      const taxInclusive = !!(dto as any).tax_inclusive;

      // Snapshots
      let sellerSnapshot: string | null = null;
      let customerSnapshot: string | null = null;
      try {
        const bRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'business_info'`).get() as { value: string } | undefined;
        if (bRow?.value) sellerSnapshot = bRow.value;
      } catch { /* ignore */ }
      try {
        const cRow = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(dto.customer_id);
        if (cRow) customerSnapshot = JSON.stringify(cRow);
      } catch { /* ignore */ }

      // Compute backend totals from lines (if provided)
      const rawLines: any[] = (dto as any).lines ?? [];
      let subtotal = 0, totalTax = 0;

      if (rawLines.length > 0) {
        validateInvoiceLines(rawLines);
      } else if (rawLines.length > 500) {
        throw new Error('VALIDATION_ERROR: Maximum 500 items are allowed in an invoice.');
      }

      const processedLines = rawLines.map((line, idx) => {
        const { taxableValue, taxAmount, lineTotal, cgstRate, sgstRate, igstRate } =
          computeLineTotals(line, taxInclusive);
        subtotal += taxableValue;
        totalTax += taxAmount;
        return { ...line, sl_no: idx + 1, taxableValue, taxAmount, lineTotal, cgstRate, sgstRate, igstRate };
      });

      const grandTotal = subtotal + totalTax;
      const hasLines = rawLines.length > 0;

      const finalAmount = (dto.amount !== undefined && dto.amount !== null) ? Number(dto.amount) : (hasLines ? subtotal : 0);
      const finalTax = (dto.tax_amount !== undefined && dto.tax_amount !== null) ? Number(dto.tax_amount) : (hasLines ? totalTax : 0);
      const finalTotal = (dto.total_amount !== undefined && dto.total_amount !== null) ? Number(dto.total_amount) : (hasLines ? grandTotal : 0);

      if (finalTotal > 1000000000 * 100) {
        throw new Error('VALIDATION_ERROR: Total invoice amount cannot exceed ₹100 Crore.');
      }

      const notesFormatted = dto.notes ? formatNotesToPlainText(dto.notes) : null;

      const info = db.prepare(`
        INSERT INTO invoices (
          reference, project_id, customer_id, quotation_id, invoice_type,
          issue_date, due_date, place_of_supply, tax_inclusive,
          amount, tax_amount, total_amount, status, has_line_items,
          notes, seller_snapshot, customer_snapshot, bank_account_id
        ) VALUES (
          @reference, @project_id, @customer_id, @quotation_id, @invoice_type,
          @issue_date, @due_date, @place_of_supply, @tax_inclusive,
          @amount, @tax_amount, @total_amount, @status, @has_line_items,
          @notes, @seller_snapshot, @customer_snapshot, @bank_account_id
        )
      `).run({
        reference,
        project_id: (dto as any).project_id ?? null,
        customer_id: dto.customer_id,
        quotation_id: (dto as any).quotation_id ?? null,
        invoice_type: (dto as any).invoice_type ?? 'Tax Invoice',
        issue_date: dto.issue_date,
        due_date: dto.due_date,
        place_of_supply: (dto as any).place_of_supply ?? 'Tamil Nadu',
        tax_inclusive: taxInclusive ? 1 : 0,
        amount: finalAmount,
        tax_amount: finalTax,
        total_amount: finalTotal,
        status: dto.status && dto.status !== 'Draft' ? dto.status : 'Pending',
        has_line_items: hasLines ? 1 : 0,
        notes: notesFormatted,
        seller_snapshot: sellerSnapshot,
        customer_snapshot: customerSnapshot,
        bank_account_id: (dto as any).bank_account_id ?? null,
      });

      newId = info.lastInsertRowid as number;

      // Insert line items
      if (hasLines) {
        const lineInsert = db.prepare(`
          INSERT INTO invoice_lines (
            invoice_id, sl_no, description, specification, hsn_sac,
            quantity, unit, unit_price, discount, tax_type,
            taxable_value, tax_rate, cgst_rate, sgst_rate, igst_rate,
            tax_amount, line_total
          ) VALUES (
            @invoice_id, @sl_no, @description, @specification, @hsn_sac,
            @quantity, @unit, @unit_price, @discount, @tax_type,
            @taxable_value, @tax_rate, @cgst_rate, @sgst_rate, @igst_rate,
            @tax_amount, @line_total
          )
        `);

        for (const line of processedLines) {
          lineInsert.run({
            invoice_id: newId,
            sl_no: line.sl_no,
            description: line.description,
            specification: line.specification ?? null,
            hsn_sac: line.hsn_sac ?? null,
            quantity: line.quantity,
            unit: line.unit ?? '1',
            unit_price: line.unit_price,
            discount: line.discount ?? 0,
            tax_type: line.tax_type ?? 'Exclusive',
            taxable_value: line.taxableValue,
            tax_rate: line.tax_rate ?? 0,
            cgst_rate: line.cgstRate,
            sgst_rate: line.sgstRate,
            igst_rate: line.igstRate,
            tax_amount: line.taxAmount,
            line_total: line.lineTotal,
          });
        }
      }

      if (dto.project_id) {
        syncProjectPaymentStatus(db, dto.project_id);
      }
    })();

    return getInvoice(newId);
  } catch (error: any) {
    console.error('[InvoiceService.createInvoice]', error);
    if (error.message?.startsWith('VALIDATION_ERROR')) {
      return fail('VALIDATION_ERROR', error.message.split(': ')[1]);
    }
    return fail('INTERNAL_ERROR', 'Failed to create invoice');
  }
}

export function updateInvoice(dto: UpdateInvoiceDto): ApiResponse<Invoice> {
  try {
    const db = getDb();

    const existing = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(dto.id) as any;
    if (!existing) return fail('NOT_FOUND', `Invoice ${dto.id} not found`);

    let finalAmount = dto.amount;
    let finalTax = dto.tax_amount;
    let finalTotal = dto.total_amount;

    db.transaction(() => {
      const updates: string[] = [];
      const params: Record<string, any> = { id: dto.id };

      // Process lines if provided
      const rawLines: any[] | undefined = (dto as any).lines;
      const taxInclusive = (dto as any).tax_inclusive !== undefined
        ? !!(dto as any).tax_inclusive
        : !!existing.tax_inclusive;

      if (Array.isArray(rawLines)) {
        if (rawLines.length > 0) {
          validateInvoiceLines(rawLines);
        } else if (rawLines.length > 500) {
          throw new Error('VALIDATION_ERROR: Maximum 500 items are allowed in an invoice.');
        }

        let subtotal = 0, totalTax = 0;
        const processedLines = rawLines.map((line, idx) => {
          const { taxableValue, taxAmount, lineTotal, cgstRate, sgstRate, igstRate } =
            computeLineTotals(line, taxInclusive);
          subtotal += taxableValue;
          totalTax += taxAmount;
          return { ...line, sl_no: idx + 1, taxableValue, taxAmount, lineTotal, cgstRate, sgstRate, igstRate };
        });

        if (rawLines.length > 0) {
          finalAmount = (dto.amount !== undefined && dto.amount !== null) ? Number(dto.amount) : subtotal;
          finalTax = (dto.tax_amount !== undefined && dto.tax_amount !== null) ? Number(dto.tax_amount) : totalTax;
          finalTotal = (dto.total_amount !== undefined && dto.total_amount !== null) ? Number(dto.total_amount) : (subtotal + totalTax);
        }

        if (finalTotal !== undefined && finalTotal > 1000000000 * 100) {
          throw new Error('VALIDATION_ERROR: Total invoice amount cannot exceed ₹100 Crore.');
        }

        // Replace invoice lines
        db.prepare(`DELETE FROM invoice_lines WHERE invoice_id = ?`).run(dto.id);

        if (rawLines.length > 0) {
          const lineInsert = db.prepare(`
            INSERT INTO invoice_lines (
              invoice_id, sl_no, description, specification, hsn_sac,
              quantity, unit, unit_price, discount, tax_type,
              taxable_value, tax_rate, cgst_rate, sgst_rate, igst_rate,
              tax_amount, line_total
            ) VALUES (
              @invoice_id, @sl_no, @description, @specification, @hsn_sac,
              @quantity, @unit, @unit_price, @discount, @tax_type,
              @taxable_value, @tax_rate, @cgst_rate, @sgst_rate, @igst_rate,
              @tax_amount, @line_total
            )
          `);

          for (const line of processedLines) {
            lineInsert.run({
              invoice_id: dto.id,
              sl_no: line.sl_no,
              description: line.description,
              specification: line.specification ?? null,
              hsn_sac: line.hsn_sac ?? null,
              quantity: line.quantity,
              unit: line.unit ?? '1',
              unit_price: line.unit_price,
              discount: line.discount ?? 0,
              tax_type: line.tax_type ?? 'Exclusive',
              taxable_value: line.taxableValue,
              tax_rate: line.tax_rate ?? 0,
              cgst_rate: line.cgstRate,
              sgst_rate: line.sgstRate,
              igst_rate: line.igstRate,
              tax_amount: line.taxAmount,
              line_total: line.lineTotal,
            });
          }
        }

        params.amount = finalAmount ?? existing.amount;
        params.tax_amount = finalTax ?? existing.tax_amount;
        params.total_amount = finalTotal ?? existing.total_amount;
        params.has_line_items = rawLines.length > 0 ? 1 : 0;
        updates.push('amount = @amount', 'tax_amount = @tax_amount', 'total_amount = @total_amount', 'has_line_items = @has_line_items');
      } else if (dto.amount !== undefined) {
        params.amount = dto.amount;
        params.tax_amount = dto.tax_amount ?? existing.tax_amount;
        params.total_amount = dto.total_amount ?? existing.total_amount;
        updates.push('amount = @amount', 'tax_amount = @tax_amount', 'total_amount = @total_amount');
      }

      if (dto.notes !== undefined) {
        dto.notes = formatNotesToPlainText(dto.notes);
      }

      // Allowed non-financial fields
      const allowedFields = ['issue_date', 'due_date', 'status', 'notes', 'place_of_supply', 'invoice_type', 'quotation_id', 'bank_account_id'] as const;
      for (const field of allowedFields) {
        if ((dto as any)[field] !== undefined) {
          updates.push(`${field} = @${field}`);
          params[field] = (dto as any)[field];
        }
      }

      // If status changed to Sent and locked_at not set, set locked_at
      if (dto.status === 'Sent' && !existing.locked_at) {
        updates.push(`locked_at = @locked_at`);
        params.locked_at = new Date().toISOString();
      }

      if (updates.length > 0) {
        db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = @id`).run(params);
      }

      const pId = existing.project_id;
      if (pId) {
        syncProjectPaymentStatus(db, pId);
      }
    })();

    return getInvoice(dto.id);
  } catch (error: any) {
    console.error('[InvoiceService.updateInvoice]', error);
    if (error.message?.startsWith('VALIDATION_ERROR')) {
      return fail('VALIDATION_ERROR', error.message.split(': ')[1]);
    }
    return fail('INTERNAL_ERROR', 'Failed to update invoice');
  }
}

/** Lists invoices with outstanding balance for a customer */
export function getOutstandingByCustomer(customerId: number): ApiResponse<any[]> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT i.id, i.reference, i.issue_date, i.due_date,
             i.total_amount, i.amount_paid,
             (i.total_amount - i.amount_paid) as outstanding,
             i.status
      FROM invoices i
      WHERE i.customer_id = ?
        AND i.status NOT IN ('Paid', 'Cancelled')
      ORDER BY i.due_date ASC
    `).all(customerId);
    return ok(rows as any[]);
  } catch (error) {
    console.error('[InvoiceService.getOutstandingByCustomer]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch outstanding balances');
  }
}

export function deleteInvoice(id: number): ApiResponse<void> {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT project_id, status FROM invoices WHERE id = ?').get(id) as { project_id?: number; status: string } | undefined;
    
    if (!existing) {
      return fail('NOT_FOUND', `Invoice with ID ${id} not found`);
    }

    if (existing.status === 'Paid') {
      return fail('VALIDATION_ERROR', 'Cannot delete an invoice that is already marked as Paid. Please cancel it or remove associated payments first.');
    }

    db.transaction(() => {
      // Delete invoice lines first
      db.prepare('DELETE FROM invoice_lines WHERE invoice_id = ?').run(id);
      
      // Delete the invoice itself
      const info = db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
      
      if (info.changes === 0) {
        throw new Error('NOT_FOUND');
      }

      // Sync project payment status if applicable
      if (existing.project_id) {
        syncProjectPaymentStatus(db, existing.project_id);
      }
    })();

    return ok(undefined);
  } catch (error: any) {
    console.error('[InvoiceService.deleteInvoice]', error);
    if (error.message === 'NOT_FOUND') {
      return fail('NOT_FOUND', 'Invoice not found');
    }
    // Handle foreign key constraint error (e.g., payments existing)
    if (String(error).includes('FOREIGN KEY')) {
      return fail('CONFLICT', 'Cannot delete invoice because it has associated payments or receipts. Please remove them first.');
    }
    return fail('INTERNAL_ERROR', 'Failed to delete invoice');
  }
}

import { getDb } from '../database/connection';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';
import { syncProjectPaymentStatus } from './project.service';

function nextRef(db: any, series: string): string {
  const year = new Date().getFullYear();
  const row = db.prepare(`
    UPDATE document_sequences SET last_value = last_value + 1 WHERE series = ? RETURNING last_value
  `).get(series) as { last_value: number } | undefined;
  const n = row?.last_value ?? 1;
  return `${series}-${year}-${String(n).padStart(4, '0')}`;
}

// ─── Receipt (advance or invoice-linked payment) ────────────────────────────

export function listReceipts(): ApiResponse<any[]> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT r.*, 
             COALESCE(c.name, (SELECT name FROM customers WHERE id = i.customer_id), 'Direct Customer') as customer_name,
             i.reference as invoice_reference,
             i.status as invoice_status,
             p.reference as project_reference
      FROM payment_receipts r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN invoices i ON r.invoice_id = i.id
      LEFT JOIN projects p ON r.project_id = p.id
      ORDER BY r.payment_date DESC, r.id DESC
    `).all();
    return ok(rows as any[]);
  } catch (error) {
    console.error('[PaymentService.listReceipts]', error);
    return fail('INTERNAL_ERROR', 'Failed to list receipts');
  }
}

export function getReceipt(id: number): ApiResponse<any> {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT r.*, 
             COALESCE(c.name, (SELECT name FROM customers WHERE id = i.customer_id), 'Direct Customer') as customer_name,
             i.reference as invoice_reference,
             i.status as invoice_status
      FROM payment_receipts r
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN invoices i ON r.invoice_id = i.id
      WHERE r.id = ?
    `).get(id);
    if (!row) return fail('NOT_FOUND', `Receipt ${id} not found`);
    return ok(row as any);
  } catch (error) {
    console.error('[PaymentService.getReceipt]', error);
    return fail('INTERNAL_ERROR', 'Failed to get receipt');
  }
}

export function createReceipt(dto: {
  customer_id?: number;
  project_id?: number | null;
  invoice_id?: number | null;
  payment_type?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_id?: string;
  bank_ref?: string;
  notes?: string;
}): ApiResponse<any> {
  try {
    const db = getDb();
    let newId = 0;

    if (!dto.amount || isNaN(dto.amount) || dto.amount <= 0) {
      return fail('VALIDATION_ERROR', 'Payment amount must be greater than zero');
    }

    let minPaymentDate = '2020-01-01';
    let customerId = dto.customer_id;
    let projectId = dto.project_id;

    if (dto.invoice_id) {
      const invRow = db.prepare(`SELECT customer_id, project_id, issue_date FROM invoices WHERE id = ?`).get(dto.invoice_id) as any;
      if (invRow) {
        if (!customerId) customerId = invRow.customer_id;
        if (projectId === undefined) projectId = invRow.project_id;
        if (invRow.issue_date) {
          minPaymentDate = invRow.issue_date.split('T')[0];
        }
      }
    }

    if (dto.payment_date && dto.payment_date < minPaymentDate) {
      return fail('VALIDATION_ERROR', `Payment date cannot be earlier than invoice issue date (${minPaymentDate})`);
    }

    if (!customerId) {
      const firstCust = db.prepare(`SELECT id FROM customers LIMIT 1`).get() as any;
      customerId = firstCust?.id || 1;
    }

    db.transaction(() => {
      // Validate invoice if linked
      if (dto.invoice_id) {
        const inv = db.prepare(`SELECT id, total_amount, amount_paid FROM invoices WHERE id = ?`).get(dto.invoice_id) as any;
        if (!inv) throw new Error('VALIDATION_ERROR: Invoice not found');

        // Prevent over-payment
        const outstanding = inv.total_amount - inv.amount_paid;
        if (dto.amount > outstanding) {
          throw new Error(`VALIDATION_ERROR: Payment amount (${dto.amount}) exceeds outstanding balance (${outstanding} paise)`);
        }
      }

      const series = dto.payment_type === 'Advance' ? 'ADV' : 'PAY';
      const reference = nextRef(db, series);
      const unallocated = dto.invoice_id ? 0 : dto.amount; // advance = fully unallocated

      const info = db.prepare(`
        INSERT INTO payment_receipts (
          reference, customer_id, project_id, invoice_id, payment_type,
          amount, payment_date, payment_method, transaction_id, bank_ref,
          unallocated, notes
        ) VALUES (
          @reference, @customer_id, @project_id, @invoice_id, @payment_type,
          @amount, @payment_date, @payment_method, @transaction_id, @bank_ref,
          @unallocated, @notes
        )
      `).run({
        reference,
        customer_id:    customerId,
        project_id:     projectId ?? null,
        invoice_id:     dto.invoice_id ?? null,
        payment_type:   dto.payment_type ?? 'Receipt',
        amount:         dto.amount,
        payment_date:   dto.payment_date,
        payment_method: dto.payment_method,
        transaction_id: dto.transaction_id ?? null,
        bank_ref:       dto.bank_ref ?? null,
        unallocated,
        notes:          dto.notes ?? null,
      });

      newId = info.lastInsertRowid as number;

      // If linked to invoice directly, update invoice amount_paid and status
      if (dto.invoice_id) {
        db.prepare(`
          UPDATE invoices
          SET amount_paid = amount_paid + @amount,
              status = CASE
                WHEN amount_paid + @amount >= total_amount THEN 'Paid'
                WHEN amount_paid + @amount > 0 THEN 'Partial'
                ELSE 'Pending'
              END
          WHERE id = @invoice_id
        `).run({ amount: dto.amount, invoice_id: dto.invoice_id });

        const invRow = db.prepare(`SELECT project_id FROM invoices WHERE id = ?`).get(dto.invoice_id) as any;
        if (invRow?.project_id) {
          syncProjectPaymentStatus(db, invRow.project_id);
        }
      } else if (projectId) {
        syncProjectPaymentStatus(db, projectId);
      }
    })();

    return getReceipt(newId);
  } catch (error: any) {
    console.error('[PaymentService.createReceipt]', error);
    if (error.message?.startsWith('VALIDATION_ERROR')) {
      return fail('VALIDATION_ERROR', error.message.split(': ')[1]);
    }
    return fail('INTERNAL_ERROR', 'Failed to create receipt');
  }
}

/** Allocate an advance receipt to an invoice */
export function allocateAdvance(dto: {
  receipt_id: number;
  invoice_id: number;
  allocated_amount: number;
  notes?: string;
}): ApiResponse<any> {
  try {
    const db = getDb();

    db.transaction(() => {
      const receipt = db.prepare(`SELECT * FROM payment_receipts WHERE id = ?`).get(dto.receipt_id) as any;
      if (!receipt) throw new Error('VALIDATION_ERROR: Receipt not found');
      if (receipt.unallocated < dto.allocated_amount) {
        throw new Error(`VALIDATION_ERROR: Unallocated balance (${receipt.unallocated}) is less than allocation (${dto.allocated_amount})`);
      }

      const invoice = db.prepare(`SELECT id, total_amount, amount_paid FROM invoices WHERE id = ?`).get(dto.invoice_id) as any;
      if (!invoice) throw new Error('VALIDATION_ERROR: Invoice not found');

      const outstanding = invoice.total_amount - invoice.amount_paid;
      if (dto.allocated_amount > outstanding) {
        throw new Error(`VALIDATION_ERROR: Allocation (${dto.allocated_amount}) exceeds invoice outstanding (${outstanding})`);
      }

      // Check for existing allocation
      const existing = db.prepare(`SELECT id FROM payment_allocations WHERE receipt_id = ? AND invoice_id = ?`).get(dto.receipt_id, dto.invoice_id);
      if (existing) throw new Error('VALIDATION_ERROR: This advance is already allocated to this invoice. Increase the existing allocation instead.');

      db.prepare(`
        INSERT INTO payment_allocations (receipt_id, invoice_id, allocated_amount, notes)
        VALUES (@receipt_id, @invoice_id, @allocated_amount, @notes)
      `).run({
        receipt_id:       dto.receipt_id,
        invoice_id:       dto.invoice_id,
        allocated_amount: dto.allocated_amount,
        notes:            dto.notes ?? null,
      });

      // Reduce unallocated on receipt
      db.prepare(`UPDATE payment_receipts SET unallocated = unallocated - @amt WHERE id = @id`).run({ amt: dto.allocated_amount, id: dto.receipt_id });

      // Update invoice paid amount
      db.prepare(`
        UPDATE invoices
        SET amount_paid = amount_paid + @amount,
            status = CASE
              WHEN amount_paid + @amount >= total_amount THEN 'Paid'
              WHEN amount_paid + @amount > 0 THEN 'Partial'
              ELSE 'Pending'
            END
        WHERE id = @invoice_id
      `).run({ amount: dto.allocated_amount, invoice_id: dto.invoice_id });

      const invRow = db.prepare(`SELECT project_id FROM invoices WHERE id = ?`).get(dto.invoice_id) as any;
      if (invRow?.project_id) {
        syncProjectPaymentStatus(db, invRow.project_id);
      }
    })();

    return ok({ success: true });
  } catch (error: any) {
    console.error('[PaymentService.allocateAdvance]', error);
    if (error.message?.startsWith('VALIDATION_ERROR')) {
      return fail('VALIDATION_ERROR', error.message.split(': ')[1]);
    }
    return fail('INTERNAL_ERROR', 'Failed to allocate advance');
  }
}

/** Outstanding balance summary per customer */
export function listOutstandingBalances(): ApiResponse<any[]> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        c.id as customer_id,
        c.name as customer_name,
        c.phone,
        SUM(i.total_amount)  as total_invoiced,
        SUM(i.amount_paid)   as total_received,
        SUM(i.total_amount - i.amount_paid) as outstanding,
        COUNT(CASE WHEN (i.total_amount - i.amount_paid) > 0 THEN 1 END) as open_invoices
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id AND i.status != 'Cancelled'
      GROUP BY c.id
      HAVING outstanding > 0
      ORDER BY outstanding DESC
    `).all();
    return ok(rows as any[]);
  } catch (error) {
    console.error('[PaymentService.listOutstandingBalances]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch outstanding balances');
  }
}

/** Unallocated advances per customer */
export function listUnallocatedAdvances(customerId?: number): ApiResponse<any[]> {
  try {
    const db = getDb();
    const query = customerId
      ? `SELECT r.*, c.name as customer_name FROM payment_receipts r JOIN customers c ON r.customer_id = c.id WHERE r.unallocated > 0 AND r.customer_id = ? ORDER BY r.payment_date`
      : `SELECT r.*, c.name as customer_name FROM payment_receipts r JOIN customers c ON r.customer_id = c.id WHERE r.unallocated > 0 ORDER BY r.payment_date`;
    const rows = customerId ? db.prepare(query).all(customerId) : db.prepare(query).all();
    return ok(rows as any[]);
  } catch (error) {
    console.error('[PaymentService.listUnallocatedAdvances]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch unallocated advances');
  }
}

// ─── Legacy payment functions (keep for compatibility) ─────────────────────
export function listPayments(): ApiResponse<any[]> { return listReceipts(); }
export function getPayment(id: number): ApiResponse<any> { return getReceipt(id); }

export function createPayment(dto: {
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_id?: string;
  notes?: string;
  customer_id?: number;
  project_id?: number | null;
  payment_type?: string;
  bank_ref?: string;
}): ApiResponse<any> {
  const db = getDb();
  let custId = dto.customer_id;
  let projId = dto.project_id;

  if (dto.invoice_id) {
    const inv = db.prepare(`SELECT customer_id, project_id FROM invoices WHERE id = ?`).get(dto.invoice_id) as any;
    if (inv) {
      if (!custId) custId = inv.customer_id;
      if (projId === undefined) projId = inv.project_id;
    }
  }

  if (!custId) {
    const firstCust = db.prepare(`SELECT id FROM customers LIMIT 1`).get() as any;
    custId = firstCust?.id || 1;
  }

  return createReceipt({
    ...dto,
    customer_id: custId,
    project_id: projId ?? null,
  });
}

export function updatePayment(dto: any): ApiResponse<any> {
  if (dto.amount !== undefined) return fail('VALIDATION_ERROR', 'Updating payment amount is not supported. Delete and re-create the payment.');
  try {
    const db = getDb();
    db.prepare(`UPDATE payment_receipts SET notes = @notes WHERE id = @id`).run({ notes: dto.notes ?? null, id: dto.id });
    return getReceipt(dto.id);
  } catch (error) {
    return fail('INTERNAL_ERROR', 'Failed to update payment');
  }
}

export function deletePayment(id: number): ApiResponse<{ success: boolean }> {
  try {
    const db = getDb();
    const r = db.prepare(`SELECT * FROM payment_receipts WHERE id = ?`).get(id) as any;
    if (!r) return fail('NOT_FOUND', `Receipt ${id} not found`);
    if (r.invoice_id) {
      db.prepare(`
        UPDATE invoices 
        SET amount_paid = MAX(0, amount_paid - @amt),
            status = CASE
              WHEN MAX(0, amount_paid - @amt) >= total_amount THEN 'Paid'
              WHEN MAX(0, amount_paid - @amt) > 0 THEN 'Partial'
              ELSE 'Pending'
            END
        WHERE id = @iid
      `).run({ amt: r.amount, iid: r.invoice_id });
    }
    db.prepare(`DELETE FROM payment_receipts WHERE id = ?`).run(id);
    return ok({ success: true });
  } catch (error) {
    return fail('INTERNAL_ERROR', 'Failed to delete payment');
  }
}

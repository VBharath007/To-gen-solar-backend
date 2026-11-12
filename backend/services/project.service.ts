import { getDb } from '../database/connection';
import type { Project, CreateProjectDto, UpdateProjectDto } from '@shared/types/project.types';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';

export function syncProjectPaymentStatus(db: any, projectId: number | null | undefined): void {
  if (!projectId) return;
  try {
    db.prepare(`
      UPDATE projects
      SET payment_status = (
        SELECT CASE
          WHEN (
            COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = @pid AND status != 'Cancelled'), 0) = 0
            AND COALESCE((SELECT SUM(amount) FROM payment_receipts WHERE project_id = @pid), 0) = 0
          ) THEN 'Pending'
          WHEN (
            COALESCE((SELECT SUM(amount_paid) FROM invoices WHERE project_id = @pid AND status != 'Cancelled'), 0) >=
            COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = @pid AND status != 'Cancelled'), 0)
            AND COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = @pid AND status != 'Cancelled'), 0) > 0
          ) THEN 'Paid'
          WHEN (
            COALESCE((SELECT SUM(amount_paid) FROM invoices WHERE project_id = @pid AND status != 'Cancelled'), 0) > 0
            OR COALESCE((SELECT SUM(amount) FROM payment_receipts WHERE project_id = @pid), 0) > 0
          ) THEN 'Partial'
          ELSE 'Pending'
        END
      )
      WHERE id = @pid
    `).run({ pid: projectId });
  } catch (err) {
    console.error('[syncProjectPaymentStatus] Error:', err);
  }
}

export function syncAllProjectPaymentStatuses(db: any): void {
  try {
    db.prepare(`
      UPDATE projects
      SET payment_status = (
        SELECT CASE
          WHEN (
            COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = projects.id AND status != 'Cancelled'), 0) = 0
            AND COALESCE((SELECT SUM(amount) FROM payment_receipts WHERE project_id = projects.id), 0) = 0
          ) THEN 'Pending'
          WHEN (
            COALESCE((SELECT SUM(amount_paid) FROM invoices WHERE project_id = projects.id AND status != 'Cancelled'), 0) >=
            COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = projects.id AND status != 'Cancelled'), 0)
            AND COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = projects.id AND status != 'Cancelled'), 0) > 0
          ) THEN 'Paid'
          WHEN (
            COALESCE((SELECT SUM(amount_paid) FROM invoices WHERE project_id = projects.id AND status != 'Cancelled'), 0) > 0
            OR COALESCE((SELECT SUM(amount) FROM payment_receipts WHERE project_id = projects.id), 0) > 0
          ) THEN 'Partial'
          ELSE 'Pending'
        END
      )
    `).run();
  } catch (err) {
    console.error('[syncAllProjectPaymentStatuses] Error:', err);
  }
}

export function listProjects(): ApiResponse<Project[]> {
  try {
    const db = getDb();
    syncAllProjectPaymentStatuses(db);
    const rows = db
      .prepare(`
        SELECT p.*,
               q.id as quotation_id,
               q.reference as quotationReference,
               (
                 SELECT CASE
                   WHEN (
                     COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0) = 0
                     AND COALESCE((SELECT SUM(amount) FROM payment_receipts WHERE project_id = p.id), 0) = 0
                   ) THEN 'Pending'
                   WHEN (
                     COALESCE((SELECT SUM(amount_paid) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0) >=
                     COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0)
                     AND COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0) > 0
                   ) THEN 'Paid'
                   WHEN (
                     COALESCE((SELECT SUM(amount_paid) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0) > 0
                     OR COALESCE((SELECT SUM(amount) FROM payment_receipts WHERE project_id = p.id), 0) > 0
                   ) THEN 'Partial'
                   ELSE 'Pending'
                 END
               ) as payment_status,
               c.name as customerName, (s.address || ', ' || s.city) as siteName,
               COALESCE(
                 (SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id),
                 0
               ) / 100.0 as invoicedAmount,
               COALESCE(
                 (SELECT SUM(amount_paid) FROM invoices WHERE project_id = p.id),
                 0
               ) / 100.0 as collectedAmount,
               COALESCE(
                 (SELECT COUNT(*) FROM invoices WHERE project_id = p.id),
                 0
               ) as invoiceCount,
               COALESCE(
                 (SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id) / 100.0,
                 q.grand_total / 100.0,
                 0
               ) as contractValue,
               COALESCE(
                 NULLIF(qtd.dc_capacity_kwp, 0),
                 NULLIF(qtd.ac_capacity_kw, 0),
                 NULLIF(qtd.system_capacity_kw, 0),
                 3.0
               ) as capacityKw
        FROM projects p
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN installation_sites s ON p.site_id = s.id
        LEFT JOIN quotations q ON (
          p.quotation_ref IS NOT NULL AND p.quotation_ref != '' AND p.quotation_ref = q.reference
        )
        LEFT JOIN quotation_technical_details qtd ON q.id = qtd.quotation_id
        ORDER BY p.created_at DESC
      `)
      .all() as Project[];

    return ok(rows);
  } catch (error) {
    console.error('[ProjectService.listProjects]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch projects');
  }
}

export function getProject(id: number): ApiResponse<Project> {
  try {
    const db = getDb();
    syncProjectPaymentStatus(db, id);
    const row = db
      .prepare(`
        SELECT p.*,
               q.id as quotation_id,
               q.reference as quotationReference,
               (
                 SELECT CASE
                   WHEN (
                     COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0) = 0
                     AND COALESCE((SELECT SUM(amount) FROM payment_receipts WHERE project_id = p.id), 0) = 0
                   ) THEN 'Pending'
                   WHEN (
                     COALESCE((SELECT SUM(amount_paid) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0) >=
                     COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0)
                     AND COALESCE((SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0) > 0
                   ) THEN 'Paid'
                   WHEN (
                     COALESCE((SELECT SUM(amount_paid) FROM invoices WHERE project_id = p.id AND status != 'Cancelled'), 0) > 0
                     OR COALESCE((SELECT SUM(amount) FROM payment_receipts WHERE project_id = p.id), 0) > 0
                   ) THEN 'Partial'
                   ELSE 'Pending'
                 END
               ) as payment_status,
               c.name as customerName, (s.address || ', ' || s.city) as siteName,
               COALESCE(
                 (SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id),
                 0
               ) / 100.0 as invoicedAmount,
               COALESCE(
                 (SELECT SUM(amount_paid) FROM invoices WHERE project_id = p.id),
                 0
               ) / 100.0 as collectedAmount,
               COALESCE(
                 (SELECT COUNT(*) FROM invoices WHERE project_id = p.id),
                 0
               ) as invoiceCount,
               COALESCE(
                 (SELECT SUM(total_amount) FROM invoices WHERE project_id = p.id) / 100.0,
                 q.grand_total / 100.0,
                 0
               ) as contractValue,
               COALESCE(
                 NULLIF(qtd.dc_capacity_kwp, 0),
                 NULLIF(qtd.ac_capacity_kw, 0),
                 NULLIF(qtd.system_capacity_kw, 0),
                 3.0
               ) as capacityKw
        FROM projects p
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN installation_sites s ON p.site_id = s.id
        LEFT JOIN quotations q ON (
          p.quotation_ref IS NOT NULL AND p.quotation_ref != '' AND p.quotation_ref = q.reference
        )
        LEFT JOIN quotation_technical_details qtd ON q.id = qtd.quotation_id
        WHERE p.id = ?
      `)
      .get(id) as Project | undefined;

    if (!row) {
      return fail('NOT_FOUND', `Project with ID ${id} not found`);
    }

    return ok(row);
  } catch (error) {
    console.error('[ProjectService.getProject]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch project');
  }
}

/**
 * Automatically generates a unique, sequential project number for the current year.
 * Format: PRJYYYYNN (e.g., PRJ202601, PRJ202602, ..., PRJ202701)
 *
 * Requirements:
 * - PRJ = fixed project prefix
 * - YYYY = current 4-digit year detected automatically from server date
 * - NN = sequential project number starting from 01
 * - Sequence resets to 01 when the year changes (e.g., PRJ202701)
 * - Atomic increment in document_sequences (concurrent safe)
 * - Deleted project numbers are never reused (document_sequences only increments)
 * - Enforces uniqueness against projects table
 */
export function generateProjectNumber(db: any): string {
  const currentYear = new Date().getFullYear();
  const series = `PRJ_${currentYear}`;
  const prefix = `PRJ${currentYear}`;

  // Check if sequence row exists for the current year
  const seqRow = db.prepare('SELECT last_value FROM document_sequences WHERE series = ?').get(series) as { last_value: number } | undefined;

  if (!seqRow) {
    // Look up any existing projects created for this year (e.g. PRJ202601) to find current max
    const existingProjects = db.prepare(`
      SELECT reference FROM projects WHERE reference LIKE ?
    `).all(`${prefix}%`) as { reference: string }[];

    let maxSeq = 0;
    for (const p of existingProjects) {
      const numPart = p.reference.slice(prefix.length);
      const val = parseInt(numPart, 10);
      if (!isNaN(val) && val > maxSeq) {
        maxSeq = val;
      }
    }

    db.prepare(`
      INSERT OR IGNORE INTO document_sequences (series, last_value) VALUES (?, ?)
    `).run(series, maxSeq);
  }

  // Atomically increment the sequence counter in document_sequences
  let row = db.prepare(`
    UPDATE document_sequences 
    SET last_value = last_value + 1 
    WHERE series = ? 
    RETURNING last_value
  `).get(series) as { last_value: number } | undefined;

  let n = row?.last_value ?? 1;
  let reference = `${prefix}${String(n).padStart(2, '0')}`;

  // Duplicate safety check: ensure the project number is truly unused
  while (db.prepare('SELECT 1 FROM projects WHERE reference = ?').get(reference)) {
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

export function createProject(dto: CreateProjectDto): ApiResponse<Project> {
  try {
    const db = getDb();
    
    // Validate that the site belongs to the customer
    const site = db.prepare('SELECT customer_id FROM installation_sites WHERE id = ?').get(dto.site_id) as { customer_id: number } | undefined;
    if (!site) {
       return fail('VALIDATION_ERROR', 'Installation site does not exist');
    }
    if (site.customer_id !== dto.customer_id) {
       return fail('VALIDATION_ERROR', 'Selected installation site does not belong to the selected customer');
    }

    let newId = 0;

    db.transaction(() => {
      // Auto-generate project number in PRJYYYYNN format
      const finalReference = generateProjectNumber(db);

      const info = db
        .prepare(`
          INSERT INTO projects (
            reference, customer_id, site_id, quotation_ref, target_date, stage, payment_status
          ) VALUES (
            @reference, @customer_id, @site_id, @quotation_ref, @target_date, @stage, @payment_status
          )
        `)
        .run({
          reference: finalReference,
          customer_id: dto.customer_id,
          site_id: dto.site_id,
          quotation_ref: dto.quotation_ref || null,
          target_date: dto.target_date || null,
          stage: dto.stage || 'Not started',
          payment_status: 'Pending',
        });

      newId = info.lastInsertRowid as number;
      syncProjectPaymentStatus(db, newId);
    })();

    return getProject(newId);
  } catch (error) {
    console.error('[ProjectService.createProject]', error);
    return fail('INTERNAL_ERROR', 'Failed to create project');
  }
}

export function updateProject(dto: UpdateProjectDto): ApiResponse<void> {
  try {
    const db = getDb();
    
    if (dto.customer_id && dto.site_id) {
        // Validate that the site belongs to the customer
        const site = db.prepare('SELECT customer_id FROM installation_sites WHERE id = ?').get(dto.site_id) as { customer_id: number } | undefined;
        if (!site) {
           return fail('VALIDATION_ERROR', 'Installation site does not exist');
        }
        if (Number(site.customer_id) !== Number(dto.customer_id)) {
           return fail('VALIDATION_ERROR', 'Selected installation site does not belong to the selected customer');
        }
    }

    // Prepare dynamic update string (project reference is immutable once created)
    const updates: string[] = [];
    const params: Record<string, any> = { id: dto.id };
    if (dto.customer_id !== undefined) {
      updates.push('customer_id = @customer_id');
      params.customer_id = dto.customer_id;
    }
    if (dto.site_id !== undefined) {
      updates.push('site_id = @site_id');
      params.site_id = dto.site_id;
    }
    if (dto.quotation_ref !== undefined) {
      updates.push('quotation_ref = @quotation_ref');
      params.quotation_ref = dto.quotation_ref;
    }
    if (dto.target_date !== undefined) {
      updates.push('target_date = @target_date');
      params.target_date = dto.target_date;
    }
    if (dto.stage !== undefined) {
      updates.push('stage = @stage');
      params.stage = dto.stage;
    }
    if (dto.payment_status !== undefined) {
      updates.push('payment_status = @payment_status');
      params.payment_status = dto.payment_status;
    }

    if (updates.length === 0) {
      return ok(undefined);
    }

    const setClause = updates.join(', ');
    const query = `UPDATE projects SET ${setClause} WHERE id = @id`;

    const info = db.prepare(query).run(params);

    if (info.changes === 0) {
      return fail('NOT_FOUND', `Project with ID ${dto.id} not found`);
    }

    syncProjectPaymentStatus(db, dto.id);

    return ok(undefined);
  } catch (error) {
    console.error('[ProjectService.updateProject]', error);
    return fail('INTERNAL_ERROR', 'Failed to update project');
  }
}

export function deleteProject(id: number): ApiResponse<{ deleted: boolean }> {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id, reference FROM projects WHERE id = ?').get(id) as { id: number; reference: string } | undefined;
    if (!existing) {
      return fail('NOT_FOUND', `Project with ID ${id} not found`);
    }

    // Execute deletion inside a transaction, unlinking related records first to satisfy foreign keys
    db.transaction(() => {
      // 1. Unlink any invoices referencing this project
      try {
        db.prepare('UPDATE invoices SET project_id = NULL WHERE project_id = ?').run(id);
      } catch (e) {
        console.warn('[ProjectService.deleteProject] Unlink invoices:', e);
      }

      // 2. Unlink any payment receipts referencing this project
      try {
        db.prepare('UPDATE payment_receipts SET project_id = NULL WHERE project_id = ?').run(id);
      } catch (e) {
        console.warn('[ProjectService.deleteProject] Unlink payment_receipts:', e);
      }

      // 3. Unlink quotation technical details
      try {
        db.prepare('UPDATE quotation_technical_details SET project_id = NULL WHERE project_id = ?').run(id);
      } catch (e) {
        console.warn('[ProjectService.deleteProject] Unlink quotation_technical_details:', e);
      }

      // 4. Unlink crm_documents
      try {
        db.prepare('UPDATE crm_documents SET project_id = NULL WHERE project_id = ?').run(id);
      } catch (e) {
        console.warn('[ProjectService.deleteProject] Unlink crm_documents:', e);
      }

      // 5. Delete the project
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    })();

    return ok({ deleted: true });
  } catch (error: any) {
    console.error('[ProjectService.deleteProject]', error);
    return fail('INTERNAL_ERROR', 'Failed to delete project: ' + (error?.message || error));
  }
}

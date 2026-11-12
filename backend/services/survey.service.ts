import { getDb } from '../database/connection';
import type { SiteSurvey, CreateSiteSurveyDto, UpdateSiteSurveyDto } from '@shared/types/survey.types';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';

export function listSurveys(): ApiResponse<SiteSurvey[]> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT s.*, c.name as customerName, (i.address || ', ' || i.city) as siteAddress
      FROM site_surveys s
      JOIN customers c ON s.customer_id = c.id
      JOIN installation_sites i ON s.site_id = i.id
      ORDER BY s.survey_date DESC
    `).all() as SiteSurvey[];
    
    return ok(rows);
  } catch (error) {
    console.error('[SurveyService.listSurveys]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch surveys');
  }
}

export function getSurvey(id: number): ApiResponse<SiteSurvey> {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT s.*, c.name as customerName, (i.address || ', ' || i.city) as siteAddress
      FROM site_surveys s
      JOIN customers c ON s.customer_id = c.id
      JOIN installation_sites i ON s.site_id = i.id
      WHERE s.id = ?
    `).get(id) as SiteSurvey | undefined;

    if (!row) return fail('NOT_FOUND', `Survey with ID ${id} not found`);
    return ok(row);
  } catch (error) {
    console.error('[SurveyService.getSurvey]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch survey');
  }
}

export function createSurvey(dto: CreateSiteSurveyDto): ApiResponse<SiteSurvey> {
  try {
    const db = getDb();
    
    const customerId = Number(dto.customer_id);
    if (!customerId || isNaN(customerId) || customerId <= 0) {
      return fail('VALIDATION_ERROR', 'Please select a valid customer.');
    }

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as { id: number; address: string | null; city: string | null } | undefined;
    if (!customer) {
      return fail('VALIDATION_ERROR', 'Selected customer does not exist.');
    }

    let siteId = Number(dto.site_id);

    // If siteId was not provided or invalid, find or auto-create an installation site for this customer
    if (!siteId || isNaN(siteId) || siteId <= 0) {
      const existingSite = db.prepare('SELECT id FROM installation_sites WHERE customer_id = ? LIMIT 1').get(customerId) as { id: number } | undefined;
      if (existingSite) {
        siteId = existingSite.id;
      } else {
        // Auto-create installation site from customer's address
        const siteAddr = customer.address?.trim() || 'Primary Installation Site';
        const siteCity = customer.city?.trim() || 'Local';
        const newSiteInfo = db.prepare(`
          INSERT INTO installation_sites (customer_id, address, city, postcode, site_notes)
          VALUES (?, ?, ?, ?, ?)
        `).run(customerId, siteAddr, siteCity, null, 'Primary Installation Site');
        siteId = newSiteInfo.lastInsertRowid as number;
      }
    } else {
      // Validate that the chosen site exists and belongs to the customer
      const site = db.prepare('SELECT customer_id FROM installation_sites WHERE id = ?').get(siteId) as { customer_id: number } | undefined;
      if (!site) {
        return fail('VALIDATION_ERROR', 'Selected installation site does not exist.');
      }
      if (Number(site.customer_id) !== customerId) {
        return fail('VALIDATION_ERROR', 'Selected site does not belong to this customer.');
      }
    }

    const info = db.prepare(`
      INSERT INTO site_surveys (customer_id, site_id, survey_date, status, cancellation_reason, roof_type, roof_area_sqft, electrical_phase, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customerId,
      siteId,
      dto.survey_date || new Date().toISOString().split('T')[0],
      dto.status || 'Scheduled',
      dto.cancellation_reason ? String(dto.cancellation_reason).trim() : null,
      dto.roof_type || null,
      dto.roof_area_sqft ? Number(dto.roof_area_sqft) : null,
      dto.electrical_phase || null,
      dto.notes || null
    );

    return getSurvey(info.lastInsertRowid as number);
  } catch (error) {
    console.error('[SurveyService.createSurvey]', error);
    return fail('INTERNAL_ERROR', `Failed to create survey: ${(error as Error).message}`);
  }
}

export function updateSurvey(dto: UpdateSiteSurveyDto): ApiResponse<SiteSurvey> {
  try {
    const db = getDb();
    
    const surveyId = Number(dto.id);
    if (!surveyId || isNaN(surveyId)) {
      return fail('VALIDATION_ERROR', 'Invalid survey ID');
    }

    const updates: string[] = [];
    const params: Record<string, any> = { id: surveyId };

    if (dto.customer_id !== undefined) {
      updates.push('customer_id = @customer_id');
      params.customer_id = Number(dto.customer_id);
    }
    if (dto.site_id !== undefined) {
      updates.push('site_id = @site_id');
      params.site_id = Number(dto.site_id);
    }
    if (dto.survey_date !== undefined) {
      updates.push('survey_date = @survey_date');
      params.survey_date = dto.survey_date;
    }
    if (dto.status !== undefined) {
      updates.push('status = @status');
      params.status = dto.status;
    }
    if (dto.cancellation_reason !== undefined) {
      updates.push('cancellation_reason = @cancellation_reason');
      params.cancellation_reason = dto.cancellation_reason ? String(dto.cancellation_reason).trim() : null;
    }
    if (dto.roof_type !== undefined) {
      updates.push('roof_type = @roof_type');
      params.roof_type = dto.roof_type || null;
    }
    if (dto.roof_area_sqft !== undefined) {
      updates.push('roof_area_sqft = @roof_area_sqft');
      params.roof_area_sqft = dto.roof_area_sqft ? Number(dto.roof_area_sqft) : null;
    }
    if (dto.electrical_phase !== undefined) {
      updates.push('electrical_phase = @electrical_phase');
      params.electrical_phase = dto.electrical_phase || null;
    }
    if (dto.notes !== undefined) {
      updates.push('notes = @notes');
      params.notes = dto.notes || null;
    }

    if (updates.length > 0) {
      const setClause = updates.join(', ');
      const info = db.prepare(`UPDATE site_surveys SET ${setClause} WHERE id = @id`).run(params);
      if (info.changes === 0) return fail('NOT_FOUND', `Survey with ID ${surveyId} not found`);
    }

    return getSurvey(surveyId);
  } catch (error) {
    console.error('[SurveyService.updateSurvey]', error);
    return fail('INTERNAL_ERROR', `Failed to update survey: ${(error as Error).message}`);
  }
}

export function deleteSurvey(id: number): ApiResponse<void> {
  try {
    const db = getDb();
    const surveyId = Number(id);
    if (!surveyId || isNaN(surveyId)) {
      return fail('VALIDATION_ERROR', 'Invalid survey ID');
    }

    const info = db.prepare('DELETE FROM site_surveys WHERE id = ?').run(surveyId);
    if (info.changes === 0) {
      return fail('NOT_FOUND', `Survey with ID ${surveyId} not found`);
    }

    return ok(undefined);
  } catch (error) {
    console.error('[SurveyService.deleteSurvey]', error);
    return fail('INTERNAL_ERROR', 'Failed to delete survey');
  }
}


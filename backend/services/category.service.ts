import { getDb } from '../database/connection';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';

export interface BusinessCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  status: 'Active' | 'PendingConfirmation';
  sort_order: number;
  created_at: string;
}

export function listCategories(): ApiResponse<BusinessCategory[]> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM business_categories ORDER BY sort_order ASC
    `).all() as BusinessCategory[];
    return ok(rows);
  } catch (error) {
    console.error('[CategoryService.listCategories]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch business categories');
  }
}

export function listActiveCategories(): ApiResponse<BusinessCategory[]> {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM business_categories WHERE status = 'Active' ORDER BY sort_order ASC
    `).all() as BusinessCategory[];
    return ok(rows);
  } catch (error) {
    console.error('[CategoryService.listActiveCategories]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch active categories');
  }
}

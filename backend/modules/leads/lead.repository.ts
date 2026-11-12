import { getDb } from '../../database/connection';
import type { Lead, CreateLeadDto, UpdateLeadDto } from '@shared/types/lead.types';

/**
 * Handles all SQLite queries for Leads.
 * Note: getDb() should only be called inside the method body to ensure it returns the active connection.
 */
export class LeadRepository {
  /**
   * Fetch all leads.
   * Typical CRM orders by most recent first.
   */
  list(): Lead[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM leads ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    // Map snake_case to camelCase
    return rows.map(this.mapRowToLead);
  }

  /**
   * Fetch a single lead by ID.
   */
  getById(id: number): Lead | null {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM leads WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;
    return this.mapRowToLead(row);
  }

  /**
   * Create a new lead.
   */
  create(dto: CreateLeadDto): Lead {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO leads (name, phone, email, source, status, business_category, notes)
      VALUES (@name, @phone, @email, @source, @status, @business_category, @notes)
    `);

    const info = stmt.run({
      name: dto.name,
      phone: dto.phone,
      email: dto.email ?? null,
      source: dto.source ?? null,
      status: dto.status ?? 'New',
      business_category: dto.business_category ?? null,
      notes: dto.notes ?? null,
    });

    const newLead = this.getById(info.lastInsertRowid as number);
    if (!newLead) throw new Error('Failed to create lead.');
    return newLead;
  }

  /**
   * Update an existing lead.
   */
  update(dto: UpdateLeadDto): Lead {
    const db = getDb();
    const fields: string[] = [];
    const params: Record<string, any> = { id: dto.id };

    if (dto.name !== undefined) {
      fields.push('name = @name');
      params.name = dto.name;
    }
    if (dto.phone !== undefined) {
      fields.push('phone = @phone');
      params.phone = dto.phone;
    }
    if (dto.email !== undefined) {
      fields.push('email = @email');
      params.email = dto.email;
    }
    if (dto.source !== undefined) {
      fields.push('source = @source');
      params.source = dto.source;
    }
    if (dto.status !== undefined) {
      fields.push('status = @status');
      params.status = dto.status;
    }
    if (dto.business_category !== undefined) {
      fields.push('business_category = @business_category');
      params.business_category = dto.business_category;
    }
    if (dto.notes !== undefined) {
      fields.push('notes = @notes');
      params.notes = dto.notes;
    }

    if (fields.length === 0) {
      const existing = this.getById(dto.id);
      if (!existing) throw new Error('Lead not found.');
      return existing;
    }

    const query = `UPDATE leads SET ${fields.join(', ')} WHERE id = @id`;
    const stmt = db.prepare(query);
    const info = stmt.run(params);

    if (info.changes === 0) {
      throw new Error(`Lead with ID ${dto.id} not found.`);
    }

    const updatedLead = this.getById(dto.id);
    if (!updatedLead) throw new Error('Failed to fetch updated lead.');
    return updatedLead;
  }

  /**
   * Delete a lead by ID.
   */
  delete(id: number): void {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM leads WHERE id = ?');
    stmt.run(id);
  }

  /**
   * Maps a SQLite row (snake_case) to a TypeScript Lead object (camelCase).
   */
  private mapRowToLead(row: any): Lead {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      source: row.source,
      status: row.status,
      business_category: row.business_category ?? null,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

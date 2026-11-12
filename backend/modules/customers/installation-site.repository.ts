import { getDb } from '../../database/connection';
import type { InstallationSite, CreateInstallationSiteDto, UpdateInstallationSiteDto } from '@shared/types/installation-site.types';

export class InstallationSiteRepository {
  public listByCustomerId(customerId: number): InstallationSite[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM installation_sites WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
    return rows.map(this.mapRowToSite);
  }

  public getById(id: number): InstallationSite | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM installation_sites WHERE id = ?').get(id);
    return row ? this.mapRowToSite(row) : undefined;
  }

  public create(dto: CreateInstallationSiteDto): InstallationSite {
    const db = getDb();
    const cols = (db.prepare('PRAGMA table_info(installation_sites)').all() as { name: string }[]).map(c => c.name);

    const insertCols = ['customer_id', 'address', 'city'];
    const insertVals = ['@customerId', '@address', '@city'];
    const params: Record<string, any> = {
      customerId: dto.customerId,
      address: dto.address,
      city: dto.city,
    };

    const addField = (colName: string, val: any) => {
      if (cols.includes(colName)) {
        insertCols.push(colName);
        insertVals.push(`@${colName}`);
        params[colName] = val ?? null;
      }
    };

    addField('postcode', dto.postcode);
    addField('state', dto.state);
    addField('site_notes', dto.siteNotes);
    addField('utility_provider', dto.utility_provider);
    addField('discom_name', dto.utility_provider);
    addField('consumer_number', dto.consumer_number);
    addField('electricity_conn_no', dto.consumer_number);
    addField('sanctioned_load_kw', dto.sanctioned_load_kw);
    addField('tariff_category', dto.tariff_category);
    addField('tariff_code', dto.tariff_category);
    addField('connection_phase', dto.connection_phase);
    addField('phase', dto.connection_phase);
    addField('average_monthly_bill', dto.average_monthly_bill);

    const stmt = db.prepare(`
      INSERT INTO installation_sites (${insertCols.join(', ')})
      VALUES (${insertVals.join(', ')})
    `);
    
    const info = stmt.run(params);
    return this.getById(info.lastInsertRowid as number)!;
  }

  public update(dto: UpdateInstallationSiteDto): InstallationSite | undefined {
    const db = getDb();
    const current = this.getById(dto.id);
    if (!current) return undefined;

    const cols = (db.prepare('PRAGMA table_info(installation_sites)').all() as { name: string }[]).map(c => c.name);
    const updates: string[] = [];
    const params: Record<string, any> = { id: dto.id };

    const addUpdate = (colName: string, val: any) => {
      if (cols.includes(colName) && val !== undefined) {
        updates.push(`${colName} = @${colName}`);
        params[colName] = val ?? null;
      }
    };

    addUpdate('address', dto.address);
    addUpdate('city', dto.city);
    addUpdate('state', dto.state);
    addUpdate('postcode', dto.postcode);
    addUpdate('site_notes', dto.siteNotes);
    addUpdate('utility_provider', dto.utility_provider);
    addUpdate('discom_name', dto.utility_provider);
    addUpdate('consumer_number', dto.consumer_number);
    addUpdate('electricity_conn_no', dto.consumer_number);
    addUpdate('sanctioned_load_kw', dto.sanctioned_load_kw);
    addUpdate('tariff_category', dto.tariff_category);
    addUpdate('tariff_code', dto.tariff_category);
    addUpdate('connection_phase', dto.connection_phase);
    addUpdate('phase', dto.connection_phase);
    addUpdate('average_monthly_bill', dto.average_monthly_bill);

    if (updates.length > 0) {
      db.prepare(`UPDATE installation_sites SET ${updates.join(', ')} WHERE id = @id`).run(params);
    }

    return this.getById(dto.id);
  }

  public delete(id: number): boolean {
    const db = getDb();
    const info = db.prepare('DELETE FROM installation_sites WHERE id = ?').run(id);
    return info.changes > 0;
  }

  private mapRowToSite(row: any): InstallationSite {
    return {
      id: row.id,
      customerId: row.customer_id,
      address: row.address,
      city: row.city,
      state: row.state ?? null,
      postcode: row.postcode ?? null,
      siteNotes: row.site_notes ?? null,
      utility_provider: row.utility_provider ?? row.discom_name ?? null,
      consumer_number: row.consumer_number ?? row.electricity_conn_no ?? null,
      sanctioned_load_kw: row.sanctioned_load_kw != null ? Number(row.sanctioned_load_kw) : null,
      tariff_category: row.tariff_category ?? row.tariff_code ?? null,
      connection_phase: (row.connection_phase || (row.phase === '3 Phase' || row.phase === 'Three Phase' ? '3-Phase' : row.phase ? '1-Phase' : null)) as '1-Phase' | '3-Phase' | null,
      average_monthly_bill: row.average_monthly_bill != null ? Number(row.average_monthly_bill) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

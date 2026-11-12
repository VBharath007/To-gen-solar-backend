import { getDb } from '../../database/connection';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@shared/types/customer.types';

export class CustomerRepository {
  public list(): Customer[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
    return rows.map(this.mapRowToCustomer);
  }

  public getById(id: number): Customer | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    return row ? this.mapRowToCustomer(row) : undefined;
  }

  public create(dto: CreateCustomerDto): Customer {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO customers (
        name, email, phone, address, city, state, pincode, gstin, pan, customer_type, company_name, alternate_phone, business_category, notes
      )
      VALUES (
        @name, @email, @phone, @address, @city, @state, @pincode, @gstin, @pan, @customer_type, @company_name, @alternate_phone, @business_category, @notes
      )
    `);
    
    const info = stmt.run({
      name: dto.name,
      email: dto.email ? dto.email : null,
      phone: dto.phone,
      address: dto.address ? dto.address : null,
      city: dto.city ? dto.city : null,
      state: dto.state ? dto.state : null,
      pincode: dto.pincode ? dto.pincode : null,
      gstin: dto.gstin ? dto.gstin : null,
      pan: dto.pan ? dto.pan : null,
      customer_type: dto.customer_type || 'Individual',
      company_name: dto.company_name ? dto.company_name : null,
      alternate_phone: dto.alternate_phone ? dto.alternate_phone : null,
      business_category: dto.business_category ? dto.business_category : null,
      notes: dto.notes ? dto.notes : null,
    });

    return this.getById(info.lastInsertRowid as number)!;
  }

  public update(dto: UpdateCustomerDto): Customer | undefined {
    const db = getDb();
    const current = this.getById(dto.id);
    if (!current) return undefined;

    const stmt = db.prepare(`
      UPDATE customers 
      SET 
        name = @name,
        email = @email,
        phone = @phone,
        address = @address,
        city = @city,
        state = @state,
        pincode = @pincode,
        gstin = @gstin,
        pan = @pan,
        customer_type = @customer_type,
        company_name = @company_name,
        alternate_phone = @alternate_phone,
        business_category = @business_category,
        notes = @notes
      WHERE id = @id
    `);

    stmt.run({
      id: dto.id,
      name: dto.name !== undefined ? dto.name : current.name,
      email: dto.email !== undefined ? (dto.email || null) : current.email,
      phone: dto.phone !== undefined ? dto.phone : current.phone,
      address: dto.address !== undefined ? (dto.address || null) : current.address,
      city: dto.city !== undefined ? (dto.city || null) : current.city,
      state: dto.state !== undefined ? (dto.state || null) : current.state,
      pincode: dto.pincode !== undefined ? (dto.pincode || null) : current.pincode,
      gstin: dto.gstin !== undefined ? (dto.gstin || null) : current.gstin,
      pan: dto.pan !== undefined ? (dto.pan || null) : current.pan,
      customer_type: dto.customer_type !== undefined ? dto.customer_type : current.customer_type,
      company_name: dto.company_name !== undefined ? (dto.company_name || null) : current.company_name,
      alternate_phone: dto.alternate_phone !== undefined ? (dto.alternate_phone || null) : current.alternate_phone,
      business_category: dto.business_category !== undefined ? (dto.business_category || null) : current.business_category,
      notes: dto.notes !== undefined ? (dto.notes || null) : current.notes,
    });

    return this.getById(dto.id);
  }

  public delete(id: number): boolean {
    const db = getDb();
    const info = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    return info.changes > 0;
  }

  private mapRowToCustomer(row: any): Customer {
    return {
      id: row.id,
      name: row.name,
      email: row.email ?? null,
      phone: row.phone,
      address: row.address ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      pincode: row.pincode ?? null,
      gstin: row.gstin ?? null,
      pan: row.pan ?? null,
      customer_type: row.customer_type || 'Individual',
      company_name: row.company_name ?? null,
      alternate_phone: row.alternate_phone ?? null,
      business_category: row.business_category ?? null,
      notes: row.notes ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

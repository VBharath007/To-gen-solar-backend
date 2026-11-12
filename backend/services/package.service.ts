import { getDb } from '../database/connection';
import type { Package, CreatePackageDto, UpdatePackageDto } from '@shared/types/package.types';
import type { Product } from '@shared/types/product.types';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';

export function listPackages(includeArchived = false): ApiResponse<Package[]> {
  try {
    const db = getDb();
    const query = includeArchived 
      ? `SELECT p.*,
           (SELECT COALESCE(SUM(pi.quantity * pr.price), 0)
            FROM package_items pi
            JOIN products pr ON pi.product_id = pr.id
            WHERE pi.package_id = p.id) as aggregate_price
         FROM packages p ORDER BY p.created_at DESC`
      : `SELECT p.*,
           (SELECT COALESCE(SUM(pi.quantity * pr.price), 0)
            FROM package_items pi
            JOIN products pr ON pi.product_id = pr.id
            WHERE pi.package_id = p.id) as aggregate_price
         FROM packages p WHERE p.is_archived = 0 ORDER BY p.created_at DESC`;
      
    const rows = db.prepare(query).all() as Package[];
    return ok(rows);
  } catch (error) {
    console.error('[PackageService.listPackages]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch packages');
  }
}

export function getPackage(id: number): ApiResponse<Package> {
  try {
    const db = getDb();
    const pkg = db.prepare(`
      SELECT p.*,
        (SELECT COALESCE(SUM(pi.quantity * pr.price), 0)
         FROM package_items pi
         JOIN products pr ON pi.product_id = pr.id
         WHERE pi.package_id = p.id) as aggregate_price
      FROM packages p WHERE p.id = ?
    `).get(id) as Package | undefined;

    if (!pkg) return fail('NOT_FOUND', `Package with ID ${id} not found`);

    // Fetch items with product details
    const items = db.prepare(`
      SELECT * FROM package_items WHERE package_id = ?
    `).all(id) as any[];

    const productStmt = db.prepare('SELECT * FROM products WHERE id = ?');

    pkg.items = items.map(row => ({
      id: row.id,
      package_id: row.package_id,
      product_id: row.product_id,
      quantity: row.quantity,
      quantity_basis: (row.quantity_basis as 'fixed' | 'as_required') || 'fixed',
      quantity_notes: row.quantity_notes || null,
      product: productStmt.get(row.product_id) as Product | undefined
    }));

    return ok(pkg);
  } catch (error) {
    console.error('[PackageService.getPackage]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch package details');
  }
}

export function createPackage(dto: CreatePackageDto): ApiResponse<Package> {
  if (dto.fixed_price !== undefined && dto.fixed_price !== null) {
    if (dto.fixed_price < 0) {
      return fail('VALIDATION_ERROR', 'Fixed price cannot be negative.');
    }
    if (dto.fixed_price > 10000000000) { // 10 crore in paise
      return fail('VALIDATION_ERROR', 'Fixed price cannot exceed ₹10 Crore (100,000,000).');
    }
  }

  const db = getDb();
  
  try {
    let newPackageId = 0;
    
    db.transaction(() => {
      // 1. Insert package
      const pkgInfo = db.prepare(`
        INSERT INTO packages (name, description, dc_capacity_kw, ac_capacity_kw, pricing_method, fixed_price)
        VALUES (@name, @description, @dc_capacity_kw, @ac_capacity_kw, @pricing_method, @fixed_price)
      `).run({
        name: dto.name,
        description: dto.description || null,
        dc_capacity_kw: dto.dc_capacity_kw || 0,
        ac_capacity_kw: dto.ac_capacity_kw || 0,
        pricing_method: dto.pricing_method,
        fixed_price: dto.fixed_price ?? null
      });
      
      newPackageId = pkgInfo.lastInsertRowid as number;

      // 2. Insert items
      const insertItem = db.prepare(`
        INSERT INTO package_items (package_id, product_id, quantity)
        VALUES (?, ?, ?)
      `);

      for (const item of (dto.items || [])) {
        if (item.quantity <= 0) throw new Error(`Invalid quantity for product ${item.product_id}`);
        insertItem.run(newPackageId, item.product_id, item.quantity);
      }
    })();

    return getPackage(newPackageId);
  } catch (error: any) {
    console.error('[PackageService.createPackage]', error);
    if (error.message.includes('FOREIGN KEY constraint failed')) {
       return fail('VALIDATION_ERROR', 'One or more selected products do not exist.');
    }
    return fail('INTERNAL_ERROR', error.message || 'Failed to create package');
  }
}

export function updatePackage(dto: UpdatePackageDto): ApiResponse<Package> {
  if (dto.fixed_price !== undefined && dto.fixed_price !== null) {
    if (dto.fixed_price < 0) {
      return fail('VALIDATION_ERROR', 'Fixed price cannot be negative.');
    }
    if (dto.fixed_price > 10000000000) { // 10 crore in paise
      return fail('VALIDATION_ERROR', 'Fixed price cannot exceed ₹10 Crore (100,000,000).');
    }
  }

  const db = getDb();
  
  try {
    db.transaction(() => {
      // 1. Update main package details
      const updates: string[] = [];
      const params: Record<string, any> = { id: dto.id };

      const updatableFields = ['name', 'description', 'dc_capacity_kw', 'ac_capacity_kw', 'pricing_method', 'fixed_price', 'is_archived'] as const;
      
      for (const field of updatableFields) {
        if (dto[field] !== undefined) {
          updates.push(`${field} = @${field}`);
          if (field === 'is_archived') {
            params[field] = dto[field] ? 1 : 0;
          } else {
            params[field] = dto[field];
          }
        }
      }

      if (updates.length > 0) {
        const setClause = updates.join(', ');
        const info = db.prepare(`UPDATE packages SET ${setClause} WHERE id = @id`).run(params);
        if (info.changes === 0) throw new Error('NOT_FOUND');
      }

      // 2. Update items if provided (Replace all strategy for simplicity)
      if (dto.items !== undefined) {
        db.prepare('DELETE FROM package_items WHERE package_id = ?').run(dto.id);
        
        const insertItem = db.prepare(`
          INSERT INTO package_items (package_id, product_id, quantity)
          VALUES (?, ?, ?)
        `);

        for (const item of (dto.items || [])) {
          if (Number(item.quantity) > 0) {
            insertItem.run(dto.id, item.product_id, item.quantity);
          }
        }
      }
    })();

    return getPackage(dto.id);
  } catch (error: any) {
    console.error('[PackageService.updatePackage]', error);
    if (error.message === 'NOT_FOUND') return fail('NOT_FOUND', `Package with ID ${dto.id} not found`);
    if (error.message.includes('FOREIGN KEY constraint failed')) {
      return fail('VALIDATION_ERROR', 'One or more selected products do not exist.');
    }
    return fail('INTERNAL_ERROR', error.message || 'Failed to update package');
  }
}

export function setPackageArchiveStatus(id: number, isArchived: boolean): ApiResponse<{ archived: boolean }> {
  try {
    const db = getDb();
    const info = db.prepare('UPDATE packages SET is_archived = ? WHERE id = ?').run(isArchived ? 1 : 0, id);
    
    if (info.changes === 0) {
      return fail('NOT_FOUND', `Package with ID ${id} not found`);
    }

    return ok({ archived: isArchived });
  } catch (error) {
    console.error('[PackageService.setPackageArchiveStatus]', error);
    return fail('INTERNAL_ERROR', 'Failed to update package archive status');
  }
}

export function deletePackage(id: number): ApiResponse<{ deleted: boolean }> {
  try {
    const db = getDb();
    let result = false;

    db.transaction(() => {
      // Remove package items first
      db.prepare('DELETE FROM package_items WHERE package_id = ?').run(id);
      // Remove package
      const info = db.prepare('DELETE FROM packages WHERE id = ?').run(id);
      if (info.changes === 0) {
        throw new Error('NOT_FOUND');
      }
      result = true;
    })();

    return ok({ deleted: result });
  } catch (error: any) {
    console.error('[PackageService.deletePackage]', error);
    if (error.message === 'NOT_FOUND') {
      return fail('NOT_FOUND', `Package with ID ${id} not found`);
    }
    return fail('INTERNAL_ERROR', error.message || 'Failed to delete package');
  }
}


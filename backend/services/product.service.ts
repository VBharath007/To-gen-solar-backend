import { getDb } from '../database/connection';
import type { Product, CreateProductDto, UpdateProductDto } from '@shared/types/product.types';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';

export function listProducts(includeArchived = false): ApiResponse<Product[]> {
  try {
    const db = getDb();
    const query = includeArchived 
      ? 'SELECT * FROM products ORDER BY category ASC, brand ASC'
      : 'SELECT * FROM products WHERE is_archived = 0 ORDER BY category ASC, brand ASC';
      
    const rows = db.prepare(query).all() as Product[];
    return ok(rows);
  } catch (error) {
    console.error('[ProductService.listProducts]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch products');
  }
}

export function getProduct(id: number): ApiResponse<Product> {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;

    if (!row) return fail('NOT_FOUND', `Product with ID ${id} not found`);
    return ok(row);
  } catch (error) {
    console.error('[ProductService.getProduct]', error);
    return fail('INTERNAL_ERROR', 'Failed to fetch product');
  }
}

export function createProduct(dto: CreateProductDto): ApiResponse<Product> {
  try {
    const db = getDb();
    
    // Basic validation
    if (dto.price !== undefined && dto.price !== null) {
      if (dto.price < 0) {
        return fail('VALIDATION_ERROR', 'Price cannot be negative');
      }
      if (dto.price > 1000000000) { // 1 Crore in paise
        return fail('VALIDATION_ERROR', 'Price cannot exceed ₹1 Crore (10,000,000)');
      }
    }
    if (!dto.specs || !dto.specs.trim()) {
      return fail('VALIDATION_ERROR', 'Specifications are required');
    }

    const info = db.prepare(`
      INSERT INTO products (
        category, brand, model, specs, unit, price, tax_rate,
        component_type, hsn_sac, cgst_rate, sgst_rate, igst_rate, warranty_years,
        datasheet_url, is_inventory_tracked, current_stock, minimum_stock,
        sku, barcode, dimensions_mm, weight_kg
      )
      VALUES (
        @category, @brand, @model, @specs, @unit, @price, @tax_rate,
        @component_type, @hsn_sac, @cgst_rate, @sgst_rate, @igst_rate, @warranty_years,
        @datasheet_url, @is_inventory_tracked, @current_stock, @minimum_stock,
        @sku, @barcode, @dimensions_mm, @weight_kg
      )
    `).run({
      category: dto.category,
      brand: dto.brand,
      model: dto.model,
      specs: dto.specs || null,
      unit: dto.unit,
      price: dto.price ?? null,
      tax_rate: dto.tax_rate ?? null,
      component_type: dto.component_type || null,
      hsn_sac: dto.hsn_sac || null,
      cgst_rate: dto.cgst_rate ?? null,
      sgst_rate: dto.sgst_rate ?? null,
      igst_rate: dto.igst_rate ?? null,
      warranty_years: dto.warranty_years ?? null,
      datasheet_url: dto.datasheet_url || null,
      is_inventory_tracked: dto.is_inventory_tracked ? 1 : 0,
      current_stock: dto.current_stock ?? 0,
      minimum_stock: dto.minimum_stock ?? 0,
      sku: dto.sku || null,
      barcode: dto.barcode || null,
      dimensions_mm: dto.dimensions_mm || null,
      weight_kg: dto.weight_kg ?? null,
    });

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid) as Product;
    return ok(newProduct);
  } catch (error) {
    console.error('[ProductService.createProduct]', error);
    return fail('INTERNAL_ERROR', 'Failed to create product');
  }
}

export function updateProduct(dto: UpdateProductDto): ApiResponse<Product> {
  try {
    const db = getDb();
    
    if (dto.price !== undefined && dto.price !== null) {
      if (dto.price < 0) {
        return fail('VALIDATION_ERROR', 'Price cannot be negative');
      }
      if (dto.price > 1000000000) { // 1 Crore in paise
        return fail('VALIDATION_ERROR', 'Price cannot exceed ₹1 Crore (10,000,000)');
      }
    }
    if (dto.specs !== undefined && (!dto.specs || !dto.specs.trim())) {
      return fail('VALIDATION_ERROR', 'Specifications cannot be empty');
    }

    const updates: string[] = [];
    const params: Record<string, any> = { id: dto.id };

    const updatableFields = [
      'category', 'brand', 'model', 'specs', 'unit', 'price', 'tax_rate', 'is_archived',
      'component_type', 'hsn_sac', 'cgst_rate', 'sgst_rate', 'igst_rate', 'warranty_years',
      'datasheet_url', 'is_inventory_tracked', 'current_stock', 'minimum_stock',
      'sku', 'barcode', 'dimensions_mm', 'weight_kg'
    ] as const;
    
    for (const field of updatableFields) {
      if (dto[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        if (field === 'is_archived' || field === 'is_inventory_tracked') {
          params[field] = dto[field] ? 1 : 0;
        } else {
          params[field] = dto[field];
        }
      }
    }

    if (updates.length === 0) {
      return getProduct(dto.id);
    }

    const setClause = updates.join(', ');
    const query = `UPDATE products SET ${setClause} WHERE id = @id`;

    const info = db.prepare(query).run(params);
    if (info.changes === 0) {
      return fail('NOT_FOUND', `Product with ID ${dto.id} not found`);
    }

    return getProduct(dto.id);
  } catch (error) {
    console.error('[ProductService.updateProduct]', error);
    return fail('INTERNAL_ERROR', 'Failed to update product');
  }
}

export function setProductArchiveStatus(id: number, isArchived: boolean): ApiResponse<{ archived: boolean }> {
  try {
    const db = getDb();
    const info = db.prepare('UPDATE products SET is_archived = ? WHERE id = ?').run(isArchived ? 1 : 0, id);
    
    if (info.changes === 0) {
      return fail('NOT_FOUND', `Product with ID ${id} not found`);
    }

    return ok({ archived: isArchived });
  } catch (error) {
    console.error('[ProductService.setProductArchiveStatus]', error);
    return fail('INTERNAL_ERROR', 'Failed to update archive status');
  }
}

export function deleteProduct(id: number): ApiResponse<void> {
  try {
    const db = getDb();
    const info = db.prepare('DELETE FROM products WHERE id = ?').run(id);
    
    if (info.changes === 0) {
      return fail('NOT_FOUND', `Product with ID ${id} not found`);
    }

    return ok(undefined);
  } catch (error) {
    console.error('[ProductService.deleteProduct]', error);
    // Might fail due to foreign key constraints if used in packages/quotations
    if (String(error).includes('FOREIGN KEY')) {
      return fail('CONFLICT', 'Cannot delete product because it is currently used in packages or quotations. Please archive it instead.');
    }
    return fail('INTERNAL_ERROR', 'Failed to delete product');
  }
}

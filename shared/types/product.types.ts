export interface Product {
  id: number;
  category: string;
  brand: string;
  model: string;
  specs: string | null;
  unit: string;
  price: number | null;
  tax_rate: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  
  // Extended fields
  component_type: string | null;
  hsn_sac: string | null;
  cgst_rate: number | null;
  sgst_rate: number | null;
  igst_rate: number | null;
  warranty_years: number | null;
  datasheet_url: string | null;
  is_inventory_tracked: boolean;
  current_stock: number;
  minimum_stock: number;
  sku: string | null;
  barcode: string | null;
  dimensions_mm: string | null;
  weight_kg: number | null;
}

export interface CreateProductDto {
  category: string;
  brand: string;
  model: string;
  specs?: string;
  unit: string;
  price?: number;
  tax_rate?: number;
  
  component_type?: string;
  hsn_sac?: string;
  cgst_rate?: number;
  sgst_rate?: number;
  igst_rate?: number;
  warranty_years?: number;
  datasheet_url?: string;
  is_inventory_tracked?: boolean;
  current_stock?: number;
  minimum_stock?: number;
  sku?: string;
  barcode?: string;
  dimensions_mm?: string;
  weight_kg?: number;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {
  id: number;
  is_archived?: boolean;
}

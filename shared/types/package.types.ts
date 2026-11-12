import type { Product } from './product.types';

export interface PackageItem {
  id: number;
  package_id: number;
  product_id: number;
  quantity: number;
  quantity_basis: 'fixed' | 'as_required';
  quantity_notes: string | null;
  product?: Product; // Populated when fetching package details
}

export interface Package {
  id: number;
  name: string;
  description: string | null;
  dc_capacity_kw: number;
  ac_capacity_kw: number;
  pricing_method: 'aggregate' | 'fixed';
  fixed_price: number | null;
  aggregate_price?: number;
  is_archived: boolean;
  
  business_category: string | null;
  bom_version: number;
  import_source: string | null;
  import_status: 'Active' | 'Draft' | 'PendingReview';
  
  created_at: string;
  updated_at: string;
  items?: PackageItem[]; // Populated when fetching details
}

export interface CreatePackageItemDto {
  product_id: number;
  quantity: number;
  quantity_basis?: 'fixed' | 'as_required';
  quantity_notes?: string;
}

export interface CreatePackageDto {
  name: string;
  description?: string;
  dc_capacity_kw?: number;
  ac_capacity_kw?: number;
  pricing_method: 'aggregate' | 'fixed';
  fixed_price?: number;
  
  business_category?: string;
  bom_version?: number;
  import_source?: string;
  import_status?: 'Active' | 'Draft' | 'PendingReview';
  
  items: CreatePackageItemDto[];
}

export interface UpdatePackageDto extends Partial<Omit<CreatePackageDto, 'items'>> {
  id: number;
  is_archived?: boolean | number;
  items?: CreatePackageItemDto[];
}

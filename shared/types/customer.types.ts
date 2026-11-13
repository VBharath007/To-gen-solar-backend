export type CustomerType =
  | 'Individual'
  | 'Company'
  | 'Business'
  | 'Commercial'
  | 'Industrial'
  | 'Agricultural'
  | 'Government'
  | 'Residential'
  | 'Other'
  | (string & {});

/** A customer record returned from the database. */
export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  pan: string | null;
  customer_type: CustomerType;
  company_name: string | null;
  alternate_phone: string | null;
  business_category: string | null;
  notes: string | null;
  /** ISO 8601 UTC string from SQLite datetime('now') */
  createdAt: string;
  /** ISO 8601 UTC string, updated by the customers_updated_at trigger */
  updatedAt: string;
}

/** Fields required to create a new customer. */
export interface CreateCustomerDto {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  customer_type?: CustomerType;
  company_name?: string | null;
  alternate_phone?: string | null;
  business_category?: string | null;
  notes?: string | null;
}

/** Fields accepted when updating a customer; all domain fields are optional. */
export interface UpdateCustomerDto extends Partial<Omit<CreateCustomerDto, 'name' | 'phone'>> {
  id: number;
  name?: string;
  phone?: string;
}

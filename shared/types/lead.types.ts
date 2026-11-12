export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Converted';

export type LeadSource = 'Website' | 'Referral' | 'Social Media' | 'Direct' | 'Other';

/** A lead record returned from the database. */
export interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  source: LeadSource | null;
  status: LeadStatus;
  business_category: string | null;
  notes: string | null;
  /** ISO 8601 UTC string from SQLite datetime('now') */
  createdAt: string;
  /** ISO 8601 UTC string, updated by the leads_updated_at trigger */
  updatedAt: string;
}

/** Fields required to create a new lead. */
export interface CreateLeadDto {
  name: string;
  phone: string;
  email?: string | null;
  source?: LeadSource | null;
  status?: LeadStatus;
  business_category?: string | null;
  notes?: string | null;
}

/** Fields accepted when updating a lead; all domain fields are optional. */
export interface UpdateLeadDto extends Partial<Omit<CreateLeadDto, 'name' | 'phone'>> {
  id: number;
  name?: string;
  phone?: string;
}

export interface InstallationSite {
  id: number;
  customerId: number;
  address: string;
  city: string;
  state: string | null;
  postcode: string | null;
  siteNotes: string | null;
  
  // Electricity / Utility connection details
  utility_provider: string | null;
  consumer_number: string | null;
  sanctioned_load_kw: number | null;
  tariff_category: string | null;
  connection_phase: '1-Phase' | '3-Phase' | null;
  average_monthly_bill: number | null;
  
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstallationSiteDto {
  customerId: number;
  address: string;
  city: string;
  state?: string | null;
  postcode?: string | null;
  siteNotes?: string | null;
  
  utility_provider?: string | null;
  consumer_number?: string | null;
  sanctioned_load_kw?: number | null;
  tariff_category?: string | null;
  connection_phase?: '1-Phase' | '3-Phase' | null;
  average_monthly_bill?: number | null;
}

export interface UpdateInstallationSiteDto extends Partial<Omit<CreateInstallationSiteDto, 'customerId'>> {
  id: number;
}

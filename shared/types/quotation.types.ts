export interface QuotationItem {
  id?: number;
  quotation_id?: number;
  item_type: 'Product' | 'Package' | 'Custom';
  item_id: number | null;
  name: string;
  description?: string;
  hsn_sac?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  taxable_value?: number;
  tax_rate: number;
  cgst_rate?: number;
  sgst_rate?: number;
  igst_rate?: number;
  tax_amount_line?: number;
  total: number;
  quantity_basis?: 'fixed' | 'as_required';
  quantity_notes?: string;
  brand?: string;
}

export interface QuotationMilestone {
  id?: number;
  quotation_id?: number;
  sl_no: number;
  label: string;
  percentage: number;
  amount?: number;
  due_trigger?: string;
}

export interface QuotationTechnicalDetails {
  id?: number;
  quotation_id?: number;
  
  // Solar Rooftop
  use_type?: 'Residential' | 'Commercial' | 'Industrial';
  dc_capacity_kwp?: number;
  ac_capacity_kw?: number;
  panel_count?: number;
  panel_wattage_w?: number;
  inverter_capacity_kw?: number;
  battery_count?: number;
  battery_ah?: number;
  battery_v?: number;
  battery_type?: string;
  battery_capacity?: number;
  battery_quantity?: number;
  mounting_structure?: string;
  connection_type?: string;
  roof_area_sqft?: number;
  shadow_free_sqft?: number;
  tilt_angle_deg?: number;
  orientation?: string;
  system_capacity_kw?: number;
  daily_generation_est?: number;
  panel_specs?: string;
  inverter_specs?: string;
  inverter_quantity?: number;
  inverter_count?: number;
  structure_type?: string;
  structure_material?: string;
  structure_quantity?: number;
  structure_count?: number;
  structure_specs?: string;
  area_required_sqft?: number;

  // Solar Street Light
  luminaire_wattage_w?: number;
  wattage?: number;
  light_type?: 'All-in-One' | 'Semi-Integrated' | string;
  sl_panel_type?: 'Poly' | 'Mono' | string;
  pole_material?: 'GI' | 'MS' | string;
  pole_height_ft?: number;
  pole_height_m?: number;
  pole_type?: string;
  sl_panel_w?: number;
  sl_battery_ah?: number;
  light_count?: number;

  // Solar Water Pump
  pump_system_type?: string;
  pump_hp?: number;
  pump_rating_kw?: number;
  vfd_model?: string;
  head_m?: number;
  flow_lph?: number;
  pump_phase?: string;
  pump_panel_count?: number;
  structure_height?: string | number;

  // Solar CCTV
  camera_count?: number;
  camera_model?: string;
  recording_type?: string;
  storage_days?: number;
  connectivity?: string;
  camera_mp?: string;
  memory_card_capacity?: string;

  // I&C Service
  service_description?: string;
  service_date_from?: string;
  service_date_to?: string;
  labour_count?: number;
  labour_unit?: string;
  labour_rate?: number;

  // Common
  supply_scope?: string;
  exclusions?: string;
}

export interface QuotationDocuments {
  id?: number;
  quotation_id?: number;
  aadhar_number?: string | null;
  aadhar_name?: string | null;
  pan_number?: string | null;
  pan_name?: string | null;
  eb_consumer_number?: string | null;
  eb_tariff?: string | null;
  bank_account_no?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  bank_account_holder?: string | null;
  email_id?: string | null;
  alt_email?: string | null;
}

export interface QuotationScope {
  id?: number;
  quotation_id?: number;
  notes?: string | null;
  roof_access?: boolean | number;
  water_supply?: boolean | number;
  power_point?: boolean | number;
  shadow_free?: boolean | number;
  internet_available?: boolean | number;
}

export interface QuotationSitePhoto {
  id?: number;
  quotation_id?: number;
  photo_order?: number;
  name?: string | null;
  size?: string | null;
  data_url: string;
  caption?: string | null;
  uploaded_at?: string | null;
}

export interface Quotation {
  id: number;
  reference: string;
  version: number;
  customer_id: number | null;
  site_id: number | null;
  is_manual_customer?: boolean | number;
  manual_customer_name?: string | null;
  manual_customer_phone?: string | null;
  manual_customer_email?: string | null;
  manual_customer_address?: string | null;
  manual_customer_city?: string | null;
  status: 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Rejected' | 'Expired' | 'Issued';
  issue_date: string | null;
  valid_until: string | null;
  subtotal: number;
  total_discount: number;
  total_tax: number;
  grand_total: number;
  payment_terms: string | null;
  business_snapshot: string | null;
  business_category?: string | null;
  system_type?: string | null;
  tax_inclusive?: boolean;
  validity_days?: number;
  quotation_type?: 'Quotation' | 'Government Subsidy' | 'Commercial' | 'Proforma Invoice' | 'Performa Invoice' | string;
  project_type?: string | null;
  notes_internal?: string | null;
  locked_at?: string | null;
  state_subsidy?: number | null;
  central_subsidy?: number | null;
  bank_account_id?: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  siteAddress?: string;
  items?: QuotationItem[];
  technicalDetails?: QuotationTechnicalDetails | null;
  milestones?: QuotationMilestone[];
  documents?: QuotationDocuments | null;
  scope?: QuotationScope | null;
  sitePhotos?: QuotationSitePhoto[];
}

export interface CreateQuotationDto {
  customer_id?: number | null;
  site_id?: number | null;
  is_manual_customer?: boolean;
  manual_customer_name?: string;
  manual_customer_phone?: string;
  manual_customer_email?: string;
  manual_customer_address?: string;
  manual_customer_city?: string;
  status?: Quotation['status'];
  issue_date?: string;
  valid_until?: string;
  subtotal: number;
  total_discount: number;
  total_tax: number;
  grand_total: number;
  payment_terms?: string;
  business_category?: string;
  system_type?: string;
  tax_inclusive?: boolean;
  validity_days?: number;
  quotation_type?: 'Quotation' | 'Government Subsidy' | 'Commercial' | 'Proforma Invoice' | 'Performa Invoice' | string;
  project_type?: string;
  notes_internal?: string;
  state_subsidy?: number;
  central_subsidy?: number;
  bank_account_id?: string;
  items: QuotationItem[];
  technicalDetails?: QuotationTechnicalDetails;
  milestones?: QuotationMilestone[];
  documents?: QuotationDocuments;
  scope?: QuotationScope;
  sitePhotos?: QuotationSitePhoto[];
}

export interface UpdateQuotationDto extends Partial<CreateQuotationDto> {
  id: number;
}


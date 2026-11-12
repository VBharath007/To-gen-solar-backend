export interface Project {
  id: number;
  reference: string;
  customer_id: number;
  site_id: number;
  quotation_ref: string | null;
  target_date: string | null;
  stage: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  
  // Joined fields for display
  quotation_id?: number | null;
  quotationReference?: string;
  customerName?: string;
  siteName?: string;
  invoicedAmount?: number;
  collectedAmount?: number;
  invoiceCount?: number;
  contractValue?: number;
  capacityKw?: number;
}

export interface CreateProjectDto {
  reference?: string;
  customer_id: number;
  site_id: number;
  quotation_ref?: string | null;
  target_date?: string | null;
  stage?: string;
  payment_status?: string;
}

export interface UpdateProjectDto extends Partial<CreateProjectDto> {
  id: number;
}

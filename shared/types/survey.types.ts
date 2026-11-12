export interface SiteSurvey {
  id: number;
  customer_id: number;
  site_id: number;
  survey_date: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  cancellation_reason?: string | null;
  roof_type: string | null;
  roof_area_sqft: number | null;
  electrical_phase: 'Single' | 'Three' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  customerName?: string;
  siteAddress?: string;
}

export interface CreateSiteSurveyDto {
  customer_id: number;
  site_id: number;
  survey_date: string;
  status?: 'Scheduled' | 'Completed' | 'Cancelled';
  cancellation_reason?: string | null;
  roof_type?: string;
  roof_area_sqft?: number;
  electrical_phase?: 'Single' | 'Three';
  notes?: string;
}

export interface UpdateSiteSurveyDto extends Partial<CreateSiteSurveyDto> {
  id: number;
}

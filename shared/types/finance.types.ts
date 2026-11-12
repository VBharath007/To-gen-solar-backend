export interface InvoiceLine {
  id: number;
  invoice_id: number;
  sl_no: number;
  description: string;
  specification?: string;
  hsn_sac?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  taxable_value: number;
  tax_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  tax_amount: number;
  tax_type?: string;
  line_total: number;
}

export interface Invoice {
  id: number;
  reference: string;
  project_id: number | null;
  customer_id: number;
  quotation_id: number | null;
  invoice_type: 'Invoice' | 'Tax Invoice' | 'Proforma Invoice' | 'Advance Receipt' | 'Proforma' | 'Credit Note' | string;
  issue_date: string;
  due_date: string;
  place_of_supply: string;
  tax_inclusive: boolean;
  amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  status: 'Draft' | 'Sent' | 'Pending' | 'Partial' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled';
  has_line_items: boolean;
  notes: string | null;
  bank_account_id?: string | null;
  business_snapshot?: string | null;
  seller_snapshot?: string | null;
  customer_snapshot?: string | null;
  locked_at?: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  customer_pincode?: string;
  customer_gstin?: string;
  project_reference?: string;
  quotation_reference?: string;
  lines?: InvoiceLine[];
}

export interface CreateInvoiceDto {
  project_id?: number | null;
  customer_id: number;
  quotation_id?: number | null;
  invoice_type?: 'Invoice' | 'Tax Invoice' | 'Proforma Invoice' | 'Advance Receipt' | 'Proforma' | 'Credit Note' | string;
  issue_date: string;
  due_date: string;
  place_of_supply?: string;
  tax_inclusive?: boolean;
  amount?: number;       // fallback for legacy
  tax_amount?: number;   // fallback for legacy
  total_amount?: number; // fallback for legacy
  status?: 'Draft' | 'Sent' | 'Pending' | 'Partial' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled';
  notes?: string;
  bank_account_id?: string | null;
  lines?: Partial<InvoiceLine>[];
}

export interface UpdateInvoiceDto extends Partial<CreateInvoiceDto> {
  id: number;
}

// Legacy Payment interface (re-aliasing to new Receipts concept)
export interface Payment {
  id: number;
  reference: string;
  customer_id: number;
  project_id: number | null;
  invoice_id: number | null; // Nullable for advances
  payment_type: 'Receipt' | 'Advance' | 'Refund';
  amount: number;
  payment_date: string;
  payment_method: 'Bank Transfer' | 'UPI' | 'Cash' | 'Cheque' | 'NEFT' | 'RTGS';
  transaction_id: string | null;
  bank_ref: string | null;
  unallocated: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  invoice_reference?: string;
  invoice_status?: string;
  customer_name?: string;
  project_reference?: string;
}

export interface CreatePaymentDto {
  customer_id: number;
  project_id?: number | null;
  invoice_id?: number | null;
  payment_type?: 'Receipt' | 'Advance' | 'Refund';
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_id?: string;
  bank_ref?: string;
  notes?: string;
}

export interface UpdatePaymentDto extends Partial<CreatePaymentDto> {
  id: number;
}

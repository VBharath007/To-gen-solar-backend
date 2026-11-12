export type DocumentCategory = 
  | 'Contracts' 
  | 'Permits & NOC' 
  | 'Technical / SLD' 
  | 'Site Reports' 
  | 'Warranties' 
  | 'Invoices & Receipts';

export type DocumentStatus = 'Approved' | 'Verified' | 'Pending Review' | 'Draft';

export interface SolarDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  fileType: 'PDF' | 'DWG' | 'DOCX' | 'JPG' | 'PNG';
  fileSize: string;
  customerName: string;
  projectRef?: string;
  uploadDate: string;
  status: DocumentStatus;
  uploadedBy: string;
  fileUrl?: string;
  description?: string;
  version?: string;
}

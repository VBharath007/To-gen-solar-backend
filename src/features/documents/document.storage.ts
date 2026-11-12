import { SolarDocument, DocumentCategory } from './document.types';

const STORAGE_KEY = 'togen_solar_crm_documents_v1';

export const INITIAL_DOCUMENTS: SolarDocument[] = [
  {
    id: 'DOC-1001',
    title: 'Grid Interconnection NOC & Feasibility Approval',
    category: 'Contracts',
    fileType: 'PDF',
    fileSize: '2.4 MB',
    customerName: 'Sunrise Retail',
    projectRef: 'TG-2024-003',
    uploadDate: '2025-03-20',
    status: 'Approved',
    uploadedBy: 'John Doe',
    version: 'v2.1',
    description: 'Official utility grid connection approval and transformer capacity sanction letter.'
  },
  {
    id: 'DOC-1002',
    title: '25kW Single Line Diagram (SLD) & Protection Scheme',
    category: 'Site Reports',
    fileType: 'DWG',
    fileSize: '5.8 MB',
    customerName: 'Sunrise Retail',
    projectRef: 'TG-2024-003',
    uploadDate: '2025-03-12',
    status: 'Approved',
    uploadedBy: 'Solar Design Eng.',
    version: 'v1.4',
    description: 'Detailed schematic drawing of AC/DC distribution, string inverters, and SPD protection.'
  },
  {
    id: 'DOC-1003',
    title: 'Solar Power Purchase & EPC Agreement',
    category: 'Contracts',
    fileType: 'PDF',
    fileSize: '1.9 MB',
    customerName: 'Maple Apartments',
    projectRef: 'TG-2024-004',
    uploadDate: '2025-03-18',
    status: 'Verified',
    uploadedBy: 'Legal Dept',
    version: 'v1.0',
    description: 'Signed turnkey engineering, procurement, and construction contract.'
  },
  {
    id: 'DOC-1004',
    title: 'Drone Roof Topography & Shadow Analysis Geo-Report',
    category: 'Site Reports',
    fileType: 'PDF',
    fileSize: '7.2 MB',
    customerName: 'Riverside School',
    projectRef: 'TG-2024-002',
    uploadDate: '2025-03-05',
    status: 'Approved',
    uploadedBy: 'Surveyor Team',
    version: 'v1.2',
    description: 'High-resolution 3D shadow analysis model and tilt angle solar irradiance report.'
  },
  {
    id: 'DOC-1005',
    title: 'Tier-1 Mono-PERC Panels 25-Year Performance Warranty',
    category: 'Contracts',
    fileType: 'PDF',
    fileSize: '1.2 MB',
    customerName: 'Greenfield Residence',
    projectRef: 'TG-2024-001',
    uploadDate: '2025-02-28',
    status: 'Approved',
    uploadedBy: 'Procurement Desk',
    version: 'v1.0',
    description: 'OEM factory warranty certificates for 550W photovoltaic modules and linear power guarantee.'
  },
  {
    id: 'DOC-1006',
    title: 'Electrical Inspectorate CEIG Compliance Filing',
    category: 'Site Reports',
    fileType: 'PDF',
    fileSize: '3.1 MB',
    customerName: 'Lakeside Farm',
    projectRef: 'TG-2024-005',
    uploadDate: '2025-03-24',
    status: 'Pending Review',
    uploadedBy: 'Compliance Officer',
    version: 'v0.9',
    description: 'Statutory electrical safety submission and earthing resistance audit paperwork.'
  },
  {
    id: 'DOC-1007',
    title: 'Civil Structure Load-Bearing & 160km/h Wind Test',
    category: 'Site Reports',
    fileType: 'PDF',
    fileSize: '4.5 MB',
    customerName: 'Riverside School',
    projectRef: 'TG-2024-002',
    uploadDate: '2025-02-14',
    status: 'Verified',
    uploadedBy: 'Structural Eng.',
    version: 'v1.1',
    description: 'Aluminum mounting structure safety audit and cyclone wind uplift resistance certificate.'
  },
  {
    id: 'DOC-1008',
    title: 'Commercial Commissioning & Handover Certificate',
    category: 'Contracts',
    fileType: 'DOCX',
    fileSize: '890 KB',
    customerName: 'Sunrise Retail',
    projectRef: 'TG-2024-003',
    uploadDate: '2025-03-25',
    status: 'Draft',
    uploadedBy: 'John Doe',
    version: 'v0.5',
    description: 'Draft client handover protocol, meter readings, and maintenance schedule handover.'
  },
  {
    id: 'DOC-1009',
    title: 'Bi-Directional Net Metering DISCOM Application',
    category: 'Contracts',
    fileType: 'PDF',
    fileSize: '1.6 MB',
    customerName: 'Greenfield Residence',
    projectRef: 'TG-2024-001',
    uploadDate: '2025-03-10',
    status: 'Pending Review',
    uploadedBy: 'Customer Liaison',
    version: 'v1.0',
    description: 'Export-import bi-directional solar energy meter registration and testing receipt.'
  }
];

export function getStoredDocuments(): SolarDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DOCUMENTS));
      return INITIAL_DOCUMENTS;
    }
    const parsed = JSON.parse(raw);
    const sanitized = parsed.map((doc: SolarDocument) => {
      if ((doc.category as string) === 'Permits & NOC' || (doc.category as string) === 'Warranties') {
        return { ...doc, category: 'Contracts' as DocumentCategory };
      }
      if ((doc.category as string) === 'Technical / SLD') {
        return { ...doc, category: 'Site Reports' as DocumentCategory };
      }
      return doc;
    });
    return sanitized;
  } catch (err) {
    console.error('Failed to load documents from storage', err);
    return INITIAL_DOCUMENTS;
  }
}

export function saveStoredDocuments(docs: SolarDocument[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch (err) {
    console.error('Failed to save documents to storage', err);
  }
}

export function addDocument(doc: Omit<SolarDocument, 'id' | 'uploadDate'>): SolarDocument {
  const docs = getStoredDocuments();
  const nextId = `DOC-${1000 + docs.length + 1}`;
  const now = new Date().toISOString().split('T')[0];
  const newDoc: SolarDocument = {
    ...doc,
    id: nextId,
    uploadDate: now
  };
  const updated = [newDoc, ...docs];
  saveStoredDocuments(updated);
  return newDoc;
}

export function deleteDocument(id: string): boolean {
  const docs = getStoredDocuments();
  const filtered = docs.filter(d => d.id !== id);
  saveStoredDocuments(filtered);
  return filtered.length !== docs.length;
}

export function updateDocument(id: string, updates: Partial<SolarDocument>): SolarDocument | null {
  const docs = getStoredDocuments();
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) return null;
  docs[idx] = { ...docs[idx], ...updates };
  saveStoredDocuments(docs);
  return docs[idx];
}

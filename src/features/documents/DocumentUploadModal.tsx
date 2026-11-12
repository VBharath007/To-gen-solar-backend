import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DocumentCategory, DocumentStatus, SolarDocument } from './document.types';
import { Button } from '@/components/ui/Button';
import { Alert } from '../../components/ui/alert';
import { validateName, sanitizeNameInput } from '../../utils/validation';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (doc: Omit<SolarDocument, 'id' | 'uploadDate'>) => void;
  defaultCustomerName?: string;
  defaultProjectRef?: string;
}

const CATEGORIES: DocumentCategory[] = [
  'Contracts',
  'Site Reports',
  'Invoices & Receipts'
];

const STATUSES: DocumentStatus[] = [
  'Approved',
  'Verified',
  'Pending Review',
  'Draft'
];

export function DocumentUploadModal({ isOpen, onClose, onAdd, defaultCustomerName, defaultProjectRef }: DocumentUploadModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Contracts');
  const [customerName, setCustomerName] = useState(defaultCustomerName || '');
  const [projectRef, setProjectRef] = useState(defaultProjectRef || '');
  const [status, setStatus] = useState<DocumentStatus>('Pending Review');
  const [version, setVersion] = useState('v1.0');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileType, setFileType] = useState<'PDF' | 'DWG' | 'DOCX' | 'JPG' | 'PNG'>('PDF');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; customerName?: string }>({});

  useEffect(() => {
    if (isOpen) {
      if (defaultCustomerName) setCustomerName(defaultCustomerName);
      if (defaultProjectRef) setProjectRef(defaultProjectRef);
    }
  }, [isOpen, defaultCustomerName, defaultProjectRef]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setFileSize(`${sizeMb} MB`);

      const ext = file.name.split('.').pop()?.toUpperCase();
      if (ext === 'PDF' || ext === 'DWG' || ext === 'DOCX' || ext === 'JPG' || ext === 'PNG') {
        setFileType(ext);
      } else {
        setFileType('PDF');
      }

      if (!title) {
        // Auto-fill title from filename
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    }
  };

  const validateForm = (): boolean => {
    const errs: { title?: string; customerName?: string } = {};

    const titleWithoutSpaces = title.replace(/\s+/g, '');
    if (!title.trim()) {
      errs.title = 'Document title is required.';
    } else if (titleWithoutSpaces.length < 3) {
      errs.title = 'Document title must contain at least 3 characters (excluding spaces).';
    }

    const nameRes = validateName(customerName, 'Customer name', true);
    if (!nameRes.isValid) {
      errs.customerName = nameRes.error!;
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) {
      return;
    }

    onAdd({
      title: title.trim(),
      category,
      customerName: customerName.trim(),
      projectRef: projectRef.trim() || undefined,
      fileType,
      fileSize: fileSize || '1.5 MB',
      status,
      version: version.trim() || 'v1.0',
      description: description.trim(),
      uploadedBy: 'John Doe'
    });

    onClose();
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 20px 40px rgba(11, 117, 185, 0.15)',
        border: '1px solid #dbe7f3',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #edf4fb',
          backgroundColor: '#f8fbfe'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0b2546' }}>
              Upload New Solar Document
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#506e8c' }}>
              Add contracts, grid approvals, drawings, or warranties to the CRM
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#edf5fc',
              color: '#506e8c',
              fontSize: '1.25rem',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <form noValidate onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <Alert type="error" message={error} />}

          {/* File Picker Drag/Drop Zone */}
          <div style={{
            border: '2px dashed #b9d5ee',
            borderRadius: '12px',
            backgroundColor: '#f4f9fd',
            padding: '1.25rem',
            textAlign: 'center',
            cursor: 'pointer',
            position: 'relative'
          }}>
            <input 
              type="file" 
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer'
              }}
            />
            <div style={{ color: '#0b75b9', marginBottom: '6px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            {fileName ? (
              <div>
                <div style={{ fontWeight: 600, color: '#0b2546', fontSize: '0.875rem' }}>{fileName}</div>
                <div style={{ fontSize: '0.75rem', color: '#2e8b38' }}>{fileSize} • {fileType} format</div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 600, color: '#0b2546', fontSize: '0.875rem' }}>
                  Click to browse or drop file here
                </div>
                <div style={{ fontSize: '0.75rem', color: '#506e8c', marginTop: '2px' }}>
                  Supports PDF, DWG, DOCX, JPG, PNG (up to 50MB)
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0b2546', marginBottom: '4px' }}>
                Document Title <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Grid Interconnection Approval"
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (fieldErrors.title) {
                    const noSpace = e.target.value.replace(/\s+/g, '');
                    setFieldErrors(p => ({
                      ...p,
                      title: !e.target.value.trim() ? 'Document title is required.' : noSpace.length < 3 ? 'Document title must contain at least 3 characters (excluding spaces).' : undefined
                    }));
                  }
                }}
                onBlur={() => {
                  const noSpace = title.replace(/\s+/g, '');
                  if (!title.trim()) {
                    setFieldErrors(p => ({ ...p, title: 'Document title is required.' }));
                  } else if (noSpace.length < 3) {
                    setFieldErrors(p => ({ ...p, title: 'Document title must contain at least 3 characters (excluding spaces).' }));
                  } else {
                    setFieldErrors(p => ({ ...p, title: undefined }));
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: fieldErrors.title ? '1.5px solid #dc2626' : '1px solid #dbe7f3',
                  backgroundColor: fieldErrors.title ? '#fff8f8' : '#ffffff',
                  fontSize: '0.875rem'
                }}
              />
              {fieldErrors.title && (
                <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px' }}>{fieldErrors.title}</div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0b2546', marginBottom: '4px' }}>
                Category <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as DocumentCategory)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #dbe7f3',
                  backgroundColor: '#ffffff',
                  fontSize: '0.875rem'
                }}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0b2546', marginBottom: '4px' }}>
                Customer Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Sunrise Retail"
                value={customerName}
                onChange={e => {
                  const val = sanitizeNameInput(e.target.value);
                  setCustomerName(val);
                  if (fieldErrors.customerName) {
                    const res = validateName(val, 'Customer name', true);
                    setFieldErrors(p => ({ ...p, customerName: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  const res = validateName(customerName, 'Customer name', true);
                  setFieldErrors(p => ({ ...p, customerName: res.isValid ? undefined : res.error! }));
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: fieldErrors.customerName ? '1.5px solid #dc2626' : '1px solid #dbe7f3',
                  backgroundColor: fieldErrors.customerName ? '#fff8f8' : '#ffffff',
                  fontSize: '0.875rem'
                }}
              />
              {fieldErrors.customerName && (
                <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px' }}>{fieldErrors.customerName}</div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0b2546', marginBottom: '4px' }}>
                Project Reference
              </label>
              <input
                type="text"
                placeholder="e.g. TG-2024-003"
                value={projectRef}
                onChange={e => setProjectRef(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #dbe7f3',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0b2546', marginBottom: '4px' }}>
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as DocumentStatus)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #dbe7f3',
                  backgroundColor: '#ffffff',
                  fontSize: '0.875rem'
                }}
              >
                {STATUSES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0b2546', marginBottom: '4px' }}>
                Document Version
              </label>
              <input
                type="text"
                placeholder="v1.0"
                value={version}
                onChange={e => setVersion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #dbe7f3',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0b2546', marginBottom: '4px' }}>
              Notes / Description
            </label>
            <textarea
              rows={2}
              placeholder="Add statutory filing details, contractor notes or compliance references..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #dbe7f3',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                resize: 'none'
              }}
            />
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button type="button" variant="ghost" onClick={onClose} style={{ borderRadius: '8px' }}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" style={{ borderRadius: '8px', padding: '0.5rem 1.5rem' }}>
              Upload Document
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

import { createPortal } from 'react-dom';
import { SolarDocument, DocumentStatus } from './document.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface DocumentPreviewModalProps {
  document: SolarDocument | null;
  isOpen: boolean;
  isDownloading?: boolean;
  onClose: () => void;
  onDownload: (doc: SolarDocument) => void;
  onUpdateStatus?: (docId: string, newStatus: DocumentStatus) => void;
}

export function DocumentPreviewModal({ document: doc, isOpen, isDownloading, onClose, onDownload, onUpdateStatus }: DocumentPreviewModalProps) {
  if (!isOpen || !doc) return null;

  const getStatusBadge = (status: string) => {
    if (status === 'Approved' || status === 'Verified') {
      return <Badge variant="success">{status}</Badge>;
    }
    if (status === 'Pending Review') {
      return <Badge variant="warning">{status}</Badge>;
    }
    return <Badge variant="default">{status}</Badge>;
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
      padding: '1.5rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px rgba(11, 117, 185, 0.2)',
        border: '1px solid #dbe7f3',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid #edf4fb',
          backgroundColor: '#f8fbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#e1f0fa',
              color: '#0b75b9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}>
              📄
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0b75b9', backgroundColor: '#e1f0fa', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                  {doc.id}
                </span>
                {getStatusBadge(doc.status)}
                {onUpdateStatus && (
                  <select
                    value={doc.status}
                    onChange={(e) => onUpdateStatus(doc.id, e.target.value as DocumentStatus)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1.5px solid #0b75b9',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#0b2546',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Approved">Approved</option>
                    <option value="Verified">Verified</option>
                    <option value="Pending Review">Pending Review</option>
                    <option value="Draft">Draft</option>
                  </select>
                )}
                <span style={{ fontSize: '0.75rem', color: '#506e8c', fontWeight: 600 }}>
                  {doc.version || 'v1.0'}
                </span>
              </div>
              <h3 style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#0b2546' }}>
                {doc.title}
              </h3>
            </div>
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

        {/* Modal Content Scrollable Area */}
        <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Metadata Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            padding: '1rem',
            borderRadius: '12px',
            backgroundColor: '#f5f9fe',
            border: '1px solid #e1edf7',
            fontSize: '0.825rem'
          }}>
            <div>
              <div style={{ color: '#506e8c', fontSize: '0.75rem', fontWeight: 600 }}>CUSTOMER</div>
              <div style={{ color: '#0b2546', fontWeight: 700, marginTop: '2px' }}>{doc.customerName}</div>
            </div>
            <div>
              <div style={{ color: '#506e8c', fontSize: '0.75rem', fontWeight: 600 }}>PROJECT REF</div>
              <div style={{ color: '#1b6e38', fontWeight: 700, marginTop: '2px' }}>{doc.projectRef || 'General / Organization'}</div>
            </div>
            <div>
              <div style={{ color: '#506e8c', fontSize: '0.75rem', fontWeight: 600 }}>CATEGORY</div>
              <div style={{ color: '#0b2546', fontWeight: 600, marginTop: '2px' }}>{doc.category}</div>
            </div>
            <div>
              <div style={{ color: '#506e8c', fontSize: '0.75rem', fontWeight: 600 }}>FILE SPECIFICATIONS</div>
              <div style={{ color: '#0b2546', fontWeight: 600, marginTop: '2px' }}>{doc.fileType} • {doc.fileSize}</div>
            </div>
            <div>
              <div style={{ color: '#506e8c', fontSize: '0.75rem', fontWeight: 600 }}>DATE RECORDED</div>
              <div style={{ color: '#0b2546', fontWeight: 600, marginTop: '2px' }}>{doc.uploadDate}</div>
            </div>
            <div>
              <div style={{ color: '#506e8c', fontSize: '0.75rem', fontWeight: 600 }}>OFFICER / UPLOADER</div>
              <div style={{ color: '#0b2546', fontWeight: 600, marginTop: '2px' }}>{doc.uploadedBy}</div>
            </div>
          </div>

          {/* Document Sheet Simulation */}
          <div style={{
            border: '1px solid #dbe7f3',
            borderRadius: '12px',
            padding: '1.5rem',
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 12px rgba(11, 117, 185, 0.04)',
            minHeight: '220px',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0b75b9', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0b75b9' }}>TO-GEN SOLAR AGRO</div>
                <div style={{ fontSize: '0.7rem', color: '#2e8b38', fontWeight: 700, letterSpacing: '0.08em' }}>OFFICIAL REPOSITORY ARCHIVE</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0b2546' }}>DOC REF: {doc.id}</div>
                <div style={{ fontSize: '0.7rem', color: '#506e8c' }}>CONFIDENTIAL • CRM ATTACHMENT</div>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#0b2546', lineHeight: 1.6 }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                Document Description & Compliance Summary:
              </p>
              <p style={{ color: '#506e8c', backgroundColor: '#fbfcfe', padding: '0.75rem', borderRadius: '8px', border: '1px solid #edf4fb' }}>
                {doc.description || 'This official document record has been compiled and validated within the ToGen Solar CRM repository.'}
              </p>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: '#506e8c' }}>Target Installation: </span>
                  <strong>{doc.projectRef || 'Standard Deployment'}</strong>
                </div>
                <div>
                  <span style={{ color: '#506e8c' }}>Verification Status: </span>
                  <strong style={{ color: doc.status === 'Approved' ? '#2e8b38' : '#d97706' }}>{doc.status}</strong>
                </div>
                <div>
                  <span style={{ color: '#506e8c' }}>Digital Signature: </span>
                  <strong style={{ color: '#0b75b9' }}>Verified SHA-256</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid #edf4fb',
          backgroundColor: '#f8fbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#506e8c' }}>
            Document format: <strong>{doc.fileType}</strong> ({doc.fileSize})
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="ghost" onClick={onClose} style={{ borderRadius: '8px' }}>
              Close
            </Button>
            <Button 
              variant="primary" 
              onClick={() => onDownload(doc)}
              disabled={isDownloading}
              style={{ borderRadius: '8px', padding: '0.5rem 1.25rem', gap: '8px' }}
            >
              {isDownloading ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span>📥</span>
              )}
              {isDownloading ? 'Generating...' : 'Download File'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

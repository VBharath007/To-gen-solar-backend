import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ProjectAnalyticsItem } from './report.types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { generateSingleProjectReportPDF } from '../../utils/reportPdfGenerator';

interface ProjectReportModalProps {
  project: ProjectAnalyticsItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectReportModal({ project, isOpen, onClose }: ProjectReportModalProps) {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !project) return null;

  const getStageBadge = (stage: string) => {
    if (stage === 'Completed' || stage === 'Commissioning' || stage === 'Installation') {
      return <Badge variant="success">{stage}</Badge>;
    }
    return <Badge variant="warning">{stage}</Badge>;
  };

  const handleExportSinglePDF = async () => {
    setIsExporting(true);
    try {
      await generateSingleProjectReportPDF(project);
    } catch (err) {
      console.error('Failed to export single project report PDF', err);
    } finally {
      setIsExporting(false);
    }
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
    }} onClick={onClose}>
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          boxShadow: '0 25px 50px rgba(11, 117, 185, 0.2)',
          border: '1px solid #dbe7f3',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
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
              fontSize: '1.25rem',
              fontWeight: 700
            }}>
              ⚡
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0b2546' }}>
                  {project.reference}
                </h2>
                {getStageBadge(project.stage)}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#506e8c' }}>
                {project.customerName} • {project.siteName || 'Site Location'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: '#8fa3bb',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Capacity & Progress Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #0b75b9 0%, #064e7d 100%)',
            borderRadius: '12px',
            padding: '1.1rem 1.4rem',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.85 }}>System Capacity</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{project.capacityKw} kW Solar Array</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '2px' }}>
                Quotation: {project.quotation_ref || 'N/A'} • Date: {project.target_date ? formatDate(project.target_date) : 'TBD'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.85 }}>Completion</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{project.progressPercent}%</div>
              <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>Stage: {project.stage}</div>
            </div>
          </div>

          {/* Detailed Metric Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.85rem',
            fontSize: '0.85rem'
          }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Energy Yield</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0b2546', marginTop: '2px' }}>
                {project.estMonthlyKwh.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>kWh/mo</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '3px' }}>
                🌱 {project.co2OffsetTons} Tons CO2/yr
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Billed Value</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0b2546', marginTop: '2px' }}>
                {formatCurrency(project.contractValue)}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#506e8c', marginTop: '3px' }}>
                {project.invoiceCount} Generated {project.invoiceCount === 1 ? 'Invoice' : 'Invoices'}
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Collected Payments</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                {formatCurrency(project.paidAmount)}
              </div>
              <div style={{ fontSize: '0.72rem', color: project.balanceAmount > 0 ? '#d97706' : '#16a34a', marginTop: '3px', fontWeight: 600 }}>
                {project.balanceAmount > 0 ? `Pending: ${formatCurrency(project.balanceAmount)}` : 'Fully Settled'}
              </div>
            </div>
          </div>

          {/* Quick Specifications */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            backgroundColor: '#ffffff',
            border: '1px solid #edf4fb',
            borderRadius: '10px',
            padding: '0.85rem 1.15rem',
            fontSize: '0.8rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Customer Name:</span>
              <strong style={{ color: '#0b2546' }}>{project.customerName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Site Location:</span>
              <strong style={{ color: '#0b2546' }}>{project.siteName || 'N/A'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Date:</span>
              <strong style={{ color: '#0b2546' }}>{project.target_date ? formatDate(project.target_date) : 'TBD'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Outstanding Balance:</span>
              <strong style={{ color: '#d97706' }}>{formatCurrency(project.contractValue - project.paidAmount)}</strong>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid #edf4fb',
          backgroundColor: '#f8fbfe',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Button
            variant="outline"
            onClick={onClose}
            style={{ borderRadius: '8px', fontSize: '0.85rem' }}
          >
            Close
          </Button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="secondary"
              onClick={handleExportSinglePDF}
              disabled={isExporting}
              style={{
                borderRadius: '8px',
                fontSize: '0.85rem',
                borderColor: '#0b75b9',
                color: '#0b75b9',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📄</span> {isExporting ? 'Exporting...' : 'Export Project PDF'}
            </Button>

            <Button
              variant="primary"
              onClick={() => {
                onClose();
                navigate(`/projects/${project.id}`);
              }}
              style={{
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>View Full Project Page</span> <span>&gt;</span>
            </Button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

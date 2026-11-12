import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Pencil, 
  Calendar, 
  Clock, 
  Share2 
} from 'lucide-react';
import type { Lead } from '@shared/types/lead.types';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Alert } from '../../components/ui/alert';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { leadApi } from './lead.api';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadLead(Number(id));
    }
  }, [id]);

  const loadLead = async (leadId: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await leadApi.get(leadId);
      setLead(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'New': return 'info';
      case 'Contacted': return 'warning';
      case 'Qualified': return 'success';
      case 'Converted': return 'mint' as any;
      case 'Lost': return 'danger';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in p-8 text-center text-secondary">
        <div style={{ display: 'inline-block', padding: '2rem' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 1rem auto' }} />
          <p style={{ color: '#64748b' }}>Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="animate-fade-in p-6">
        <Button
          variant="outline"
          className="mb-4 flex items-center gap-2"
          onClick={() => navigate('/leads')}
        >
          <ArrowLeft size={16} />
          Back to Leads
        </Button>
        <Alert
          type="error"
          message={error || 'Lead not found'}
          className="mb-4"
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Top Navigation & Actions */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => navigate('/leads')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            padding: '4px 0',
            marginBottom: '0.75rem',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#0f172a')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
        >
          <ArrowLeft size={16} />
          <span>Back to Leads</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span
            style={{
              fontSize: '0.8rem',
              padding: '3px 9px',
              borderRadius: '6px',
              backgroundColor: '#e2e8f0',
              color: '#475569',
              fontWeight: 600
            }}
          >
            Lead #{lead.id}
          </span>
          <Badge variant={getStatusBadgeVariant(lead.status)}>
            {lead.status}
          </Badge>
        </div>

        <PageHeader
          title={lead.name}
          description={`Registered on ${formatDate(lead.createdAt)}${lead.source ? ` • Source: ${lead.source}` : ''}`}
          action={
            <Button
              variant="primary"
              className="flex items-center gap-2"
              onClick={() => navigate(`/leads/${lead.id}/edit`)}
            >
              <Pencil size={15} />
              <span>Edit Lead</span>
            </Button>
          }
        />
      </div>

      {/* Main Grid: 2 Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '1.5rem',
          alignItems: 'start'
        }}
      >
        {/* Left Column (8 cols): Contact Info & Notes */}
        <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Contact Details Card */}
          <Card title="Contact & Personal Information">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1.25rem',
                marginTop: '0.5rem'
              }}
            >
              {/* Full Name */}
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Full Name
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  {lead.name}
                </div>
              </div>

              {/* Phone */}
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Phone Number
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  {lead.phone}
                </div>
              </div>

              {/* Email */}
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Email Address
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: lead.email ? '#0f172a' : '#94a3b8', marginTop: '4px' }}>
                  {lead.email || 'Not provided'}
                </div>
              </div>

              {/* Business Category */}
              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Business Category
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: lead.business_category ? '#0f172a' : '#94a3b8', marginTop: '4px' }}>
                  {lead.business_category || 'General / Not specified'}
                </div>
              </div>
            </div>
          </Card>

          {/* Notes & Requirements Card */}
          <Card title="Notes & Special Requirements">
            {lead.notes ? (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  fontSize: '0.925rem',
                  lineHeight: '1.6',
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {lead.notes}
              </div>
            ) : (
              <div
                style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px dashed #cbd5e1',
                  color: '#94a3b8',
                  fontSize: '0.875rem'
                }}
              >
                No special notes or customer requirements recorded for this lead.
                <div style={{ marginTop: '0.5rem' }}>
                  <Button
                    variant="outline"
                    className="text-xs"
                    onClick={() => navigate(`/leads/${lead.id}/edit`)}
                  >
                    + Add Notes
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (4 cols): Pipeline Status & Metadata */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Status & Pipeline Summary */}
          <Card title="Pipeline Status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Current Status
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge variant={getStatusBadgeVariant(lead.status)} className="text-sm px-3 py-1">
                    {lead.status}
                  </Badge>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Lead Source
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: 500 }}>
                  <Share2 size={15} className="text-primary" />
                  <span>{lead.source || 'Direct / Walk-in'}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Created At
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontSize: '0.875rem' }}>
                  <Calendar size={15} style={{ color: '#64748b' }} />
                  <span>{formatDateTime(lead.createdAt) || formatDate(lead.createdAt)}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Last Updated
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontSize: '0.875rem' }}>
                  <Clock size={15} style={{ color: '#64748b' }} />
                  <span>{formatDateTime(lead.updatedAt) || formatDate(lead.updatedAt)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

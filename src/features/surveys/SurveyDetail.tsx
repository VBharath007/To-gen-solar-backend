import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Pencil, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Zap, 
  Building2, 
  Maximize2,
  XCircle
} from 'lucide-react';
import type { SiteSurvey } from '@shared/types/survey.types';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Alert } from '../../components/ui/alert';
import { formatDate, formatDateTime } from '../../utils/formatters';

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<SiteSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadSurvey(Number(id));
    }
  }, [id]);

  const loadSurvey = async (surveyId: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await window.desktop.surveys.get(surveyId);
      if (res.success) {
        setSurvey(res.data);
      } else {
        setError(res.error?.message || 'Failed to load survey details');
      }
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string): 'info' | 'success' | 'danger' | 'default' => {
    switch (status) {
      case 'Scheduled': return 'info';
      case 'Completed': return 'success';
      case 'Cancelled': return 'danger';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in p-8 text-center text-secondary">
        <div style={{ display: 'inline-block', padding: '2rem' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 1rem auto' }} />
          <p style={{ color: '#64748b' }}>Loading survey details...</p>
        </div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="animate-fade-in p-6">
        <Button
          variant="outline"
          className="mb-4 flex items-center gap-2"
          onClick={() => navigate('/surveys')}
        >
          <ArrowLeft size={16} />
          Back to Surveys
        </Button>
        <Alert
          type="error"
          message={error || 'Survey not found'}
          className="mb-4"
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ width: '100%', paddingBottom: '3rem' }}>
      {/* Top Navigation & Breadcrumbs */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => navigate('/surveys')}
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
          <span>Back to Surveys</span>
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
            Survey #{survey.id}
          </span>
          <Badge variant={getStatusBadgeVariant(survey.status)}>
            {survey.status}
          </Badge>
        </div>

        <PageHeader
          title={`Site Assessment - ${survey.customerName || 'Customer'}`}
          description={`Survey scheduled on ${formatDate(survey.survey_date)} for ${survey.siteAddress || 'Installation Site'}`}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Button
                variant="outline"
                onClick={() => navigate('/surveys')}
              >
                Back to Surveys
              </Button>
              <Button
                variant="primary"
                className="flex items-center gap-2"
                onClick={() => navigate(`/surveys/${survey.id}/edit`)}
              >
                <Pencil size={15} />
                <span>Edit Survey</span>
              </Button>
            </div>
          }
        />
      </div>

      {/* Cancelled Survey Alert Banner */}
      {survey.status === 'Cancelled' && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1.5px solid #fecaca',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.05)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <XCircle size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#991b1b' }}>
                This Survey Has Been Cancelled
              </h3>
              <Badge variant="danger">Cancelled</Badge>
            </div>
            <div style={{ fontSize: '0.92rem', color: '#7f1d1d', lineHeight: 1.5 }}>
              <strong style={{ color: '#991b1b' }}>Reason for Cancellation: </strong>
              <span>
                {survey.cancellation_reason || 'No cancellation reason was provided.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Overview Metric Cards (Full Width) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        {/* Survey Date */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <Calendar size={15} className="text-primary" />
            <span>Survey Date</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
            {formatDate(survey.survey_date)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
            On-site Assessment Date
          </div>
        </div>

        {/* Customer */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <User size={15} style={{ color: '#0284c7' }} />
            <span>Customer</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {survey.customerName || `Customer #${survey.customer_id}`}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
            Customer ID: #{survey.customer_id}
          </div>
        </div>

        {/* Status */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <Clock size={15} style={{ color: '#7c3aed' }} />
            <span>Assessment Status</span>
          </div>
          <div style={{ marginTop: '8px' }}>
            <Badge variant={getStatusBadgeVariant(survey.status)} className="text-sm px-3 py-1">
              {survey.status}
            </Badge>
          </div>
          <div style={{ fontSize: '0.8rem', color: survey.status === 'Cancelled' ? '#b91c1c' : '#64748b', marginTop: '6px', fontWeight: survey.status === 'Cancelled' ? 500 : 400 }}>
            {survey.status === 'Cancelled' && survey.cancellation_reason
              ? `Reason: ${survey.cancellation_reason}`
              : 'Current pipeline stage'}
          </div>
        </div>

        {/* Electrical Phase */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
            <Zap size={15} style={{ color: '#d97706' }} />
            <span>Grid Connection</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
            {survey.electrical_phase ? `${survey.electrical_phase} Phase` : 'Unspecified'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
            Electrical System Phase
          </div>
        </div>
      </div>

      {/* Main Grid: 2 Equal, Balanced Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start'
        }}
      >
        {/* Left Column: Customer & Site Info + Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Customer & Location Details */}
          <Card title="Customer & Site Location">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Customer Name
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  {survey.customerName || `Customer #${survey.customer_id}`}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={13} className="text-primary" />
                  <span>Installation Site Address</span>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#0f172a', marginTop: '4px' }}>
                  {survey.siteAddress || 'Primary Installation Site'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Customer ID</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    #{survey.customer_id}
                  </div>
                </div>

                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Site ID</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    #{survey.site_id}
                  </div>
                </div>
              </div>

            </div>
          </Card>

          {/* Notes & Observations */}
          <Card title="Survey Notes & Remarks">
            {survey.notes ? (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.15rem 1.25rem',
                  fontSize: '0.925rem',
                  lineHeight: '1.6',
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {survey.notes}
              </div>
            ) : (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px dashed #cbd5e1',
                  color: '#94a3b8',
                  fontSize: '0.875rem'
                }}
              >
                No special observations or notes recorded for this site survey.
                <div style={{ marginTop: '0.5rem' }}>
                  <Button
                    variant="outline"
                    className="text-xs"
                    onClick={() => navigate(`/surveys/${survey.id}/edit`)}
                  >
                    + Add Survey Notes
                  </Button>
                </div>
              </div>
            )}
          </Card>

        </div>

        {/* Right Column: Technical Details & Lifecycle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Roof & Electrical Details */}
          <Card title="Roof & Technical Assessment">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  <Building2 size={14} className="text-primary" />
                  <span>Roof Type</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  {survey.roof_type || 'Unknown / Unspecified'}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  <Maximize2 size={14} className="text-primary" />
                  <span>Available Roof Area</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  {survey.roof_area_sqft != null ? `${survey.roof_area_sqft.toLocaleString()} sq.ft` : 'Not measured'}
                </div>
              </div>

              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  <Zap size={14} className="text-primary" />
                  <span>Electrical Phase Configuration</span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  {survey.electrical_phase ? `${survey.electrical_phase} Phase Supply` : 'Not recorded'}
                </div>
              </div>

            </div>
          </Card>

          {/* Assessment Status & Lifecycle Card */}
          <Card title="Survey Lifecycle & Timeline">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
              
              <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Current Assessment Stage
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge variant={getStatusBadgeVariant(survey.status)} className="text-sm px-3 py-1">
                    {survey.status}
                  </Badge>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: '#64748b', lineHeight: '1.4' }}>
                  {survey.status === 'Completed'
                    ? 'Site assessment has been successfully carried out and data is ready for engineering design.'
                    : survey.status === 'Cancelled'
                    ? 'This survey appointment was cancelled.'
                    : 'Survey is scheduled and awaiting engineer on-site visit.'}
                </p>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Created On
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontSize: '0.875rem', fontWeight: 500 }}>
                    <Calendar size={14} style={{ color: '#64748b' }} />
                    <span>{formatDateTime(survey.created_at) || formatDate(survey.created_at)}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Last Modified
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontSize: '0.875rem', fontWeight: 500 }}>
                    <Clock size={14} style={{ color: '#64748b' }} />
                    <span>{formatDateTime(survey.updated_at) || formatDate(survey.updated_at)}</span>
                  </div>
                </div>
              </div>

            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}

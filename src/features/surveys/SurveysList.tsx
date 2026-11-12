import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, SlidersHorizontal, X, AlertTriangle, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable, Column } from '../../components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatDate } from '../../utils/formatters';
import { useAlert } from '../../context/AlertContext';
import type { SiteSurvey } from '@shared/types/survey.types';

export default function SurveysList() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [surveys, setSurveys] = useState<SiteSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [statusSurvey, setStatusSurvey] = useState<SiteSurvey | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      const res = await window.desktop.surveys.list();
      if (res.success) {
        setSurveys(res.data);
      } else {
        setError(res.error?.message || 'Failed to load surveys');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (survey: SiteSurvey, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Site Survey',
      description: `Are you sure you want to delete the site survey for "${survey.customerName || 'this customer'}" (${formatDate(survey.survey_date)})? This action cannot be undone.`,
      confirmLabel: 'Delete Survey',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    setDeletingId(survey.id);
    try {
      const res = await window.desktop.surveys.delete(survey.id);
      if (res.success) {
        setSurveys(prev => prev.filter(s => s.id !== survey.id));
        await showAlert({
          type: 'success',
          title: 'Survey Deleted',
          description: 'The site survey has been deleted successfully.',
        });
      } else {
        await showAlert({
          type: 'error',
          title: 'Delete Failed',
          description: res.error?.message || 'Could not delete site survey.',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Delete Failed',
        description: err?.message || 'An unexpected error occurred.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const closeStatusModal = () => {
    if (updatingStatus) return;
    setStatusSurvey(null);
    setShowCancelPrompt(false);
    setCancelReason('');
    setCancelReasonError('');
  };

  const handleUpdateStatus = async (survey: SiteSurvey, newStatus: 'Completed') => {
    setUpdatingStatus(true);
    try {
      const res = await window.desktop.surveys.update({
        id: survey.id,
        status: newStatus,
        cancellation_reason: null,
      });
      if (res.success) {
        setSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, status: newStatus, cancellation_reason: null } : s));
        closeStatusModal();
        await showAlert({
          type: 'success',
          title: 'Status Updated',
          description: `Survey status for "${survey.customerName || 'customer'}" has been updated to ${newStatus}.`,
        });
      } else {
        await showAlert({
          type: 'error',
          title: 'Update Failed',
          description: res.error?.message || 'Could not update survey status.',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err?.message || 'An unexpected error occurred.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConfirmCancellation = async () => {
    if (!statusSurvey) return;
    if (!cancelReason.trim()) {
      setCancelReasonError('Cancellation reason is required.');
      return;
    }
    setUpdatingStatus(true);
    try {
      const trimmedReason = cancelReason.trim();
      const res = await window.desktop.surveys.update({
        id: statusSurvey.id,
        status: 'Cancelled',
        cancellation_reason: trimmedReason,
      });
      if (res.success) {
        setSurveys(prev => prev.map(s => s.id === statusSurvey.id ? { ...s, status: 'Cancelled', cancellation_reason: trimmedReason } : s));
        closeStatusModal();
        await showAlert({
          type: 'success',
          title: 'Survey Cancelled',
          description: `Survey for "${statusSurvey.customerName || 'customer'}" has been marked as Cancelled.`,
        });
      } else {
        await showAlert({
          type: 'error',
          title: 'Cancellation Failed',
          description: res.error?.message || 'Could not cancel survey.',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err?.message || 'An unexpected error occurred.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const columns: Column<SiteSurvey>[] = [
    { header: 'Date', accessor: (s) => formatDate(s.survey_date) },
    { header: 'Customer', accessor: 'customerName' },
    { header: 'Site', accessor: (s) => <span className="text-sm">{s.siteAddress}</span> },
    { header: 'Status', accessor: (s) => {
      const variants: Record<string, 'default'|'success'|'warning'|'danger'|'info'> = {
        'Scheduled': 'info',
        'Completed': 'success',
        'Cancelled': 'danger'
      };
      return (
        <div>
          <Badge variant={variants[s.status]}>{s.status}</Badge>
          {s.status === 'Cancelled' && s.cancellation_reason && (
            <div 
              style={{ 
                fontSize: '0.73rem', 
                color: '#b91c1c', 
                marginTop: '3px', 
                maxWidth: '220px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={`Cancellation Reason: ${s.cancellation_reason}`}
            >
              Reason: {s.cancellation_reason}
            </div>
          )}
        </div>
      );
    }},
    { 
      header: 'Actions', 
      accessor: (s) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingRight: '8px' }} onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="secondary" 
            onClick={() => navigate(`/surveys/${s.id}`)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
          >
            View
          </Button>
          <Button 
            variant="outline" 
            onClick={(e) => {
              e.stopPropagation();
              setStatusSurvey(s);
              setShowCancelPrompt(false);
              setCancelReason(s.cancellation_reason || '');
              setCancelReasonError('');
            }}
            style={{ 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.825rem',
              borderColor: '#bbf7d0', 
              color: '#15803d', 
              backgroundColor: '#f0fdf4'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#dcfce7';
              e.currentTarget.style.borderColor = '#86efac';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#f0fdf4';
              e.currentTarget.style.borderColor = '#bbf7d0';
            }}
          >
            Status
          </Button>
          <Button
            variant="danger"
            disabled={deletingId === s.id}
            onClick={(e) => handleDelete(s, e)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
          >
            {deletingId === s.id ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      ),
      width: '260px'
    }
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Site Surveys" 
        description="Manage on-site assessments."
        action={<Button variant="primary" onClick={() => navigate('/surveys/new')}>+ Schedule Survey</Button>}
      />

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-secondary">Loading surveys...</div>
      ) : (
        <DataTable 
          columns={columns}
          data={surveys}
          keyExtractor={row => row.id}
          searchPlaceholder="Search by customer..."
        />
      )}

      {/* Status Update Popup Modal */}
      {statusSurvey && createPortal(
        <div 
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem'
          }}
          onClick={closeStatusModal}
        >
          <div
            className="rounded-2xl bg-surface border shadow-2xl overflow-hidden"
            style={{
              width: '360px',
              maxWidth: '90vw',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header with X Button */}
            <div style={{
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid #edf4fb',
              backgroundColor: '#f8fbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: showCancelPrompt ? '#fee2e2' : '#e1f0fa',
                  color: showCancelPrompt ? '#dc2626' : '#0b75b9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {showCancelPrompt ? <AlertTriangle size={18} /> : <SlidersHorizontal size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0b2546' }}>
                    {showCancelPrompt ? 'Cancel Site Survey' : 'Update Survey Status'}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {statusSurvey.customerName} • {formatDate(statusSurvey.survey_date)}
                  </span>
                </div>
              </div>

              {/* Top right X close button */}
              <button
                type="button"
                onClick={closeStatusModal}
                disabled={updatingStatus}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="Close (Exit)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              {showCancelPrompt ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#b91c1c' }}>
                    <AlertTriangle size={18} />
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Reason for Cancellation</span>
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
                    Please enter the reason why this site survey is being cancelled. This reason will be stored and displayed on the survey.
                  </p>
                  <textarea
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => {
                      setCancelReason(e.target.value);
                      if (cancelReasonError) setCancelReasonError('');
                    }}
                    placeholder="Enter cancellation reason (e.g., Customer rescheduled, site inaccessible, customer not interested)..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${cancelReasonError ? '#dc2626' : '#cbd5e1'}`,
                      backgroundColor: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                  {cancelReasonError && (
                    <span style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>
                      {cancelReasonError}
                    </span>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={updatingStatus}
                      onClick={() => {
                        setShowCancelPrompt(false);
                        setCancelReasonError('');
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <ArrowLeft size={14} />
                      <span>Back</span>
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={updatingStatus}
                      onClick={handleConfirmCancellation}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600
                      }}
                    >
                      <XCircle size={15} />
                      <span>{updatingStatus ? 'Cancelling...' : 'Confirm Cancellation'}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                    Do you want to update this survey's status to <strong>Completed</strong> or <strong>Cancelled</strong>?
                  </p>

                  {/* Current Details Box */}
                  <div style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem',
                    border: '1px solid #e2e8f0',
                    marginBottom: '1.5rem',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748b' }}>Current Status:</span>
                      <Badge variant={statusSurvey.status === 'Completed' ? 'success' : statusSurvey.status === 'Cancelled' ? 'danger' : 'info'}>
                        {statusSurvey.status}
                      </Badge>
                    </div>
                    {statusSurvey.siteAddress && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span style={{ color: '#64748b' }}>Site:</span>
                        <span style={{ color: '#0b2546', fontWeight: 600 }}>{statusSurvey.siteAddress}</span>
                      </div>
                    )}
                    {statusSurvey.status === 'Cancelled' && statusSurvey.cancellation_reason && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 10px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        fontSize: '0.8rem',
                        lineHeight: 1.4
                      }}>
                        <strong>Recorded Reason:</strong> {statusSurvey.cancellation_reason}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons: Completed & Cancelled */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={updatingStatus || statusSurvey.status === 'Completed'}
                      onClick={() => handleUpdateStatus(statusSurvey, 'Completed')}
                      style={{
                        flex: 1,
                        backgroundColor: '#16a34a',
                        borderColor: '#16a34a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '0.65rem 1rem',
                        fontWeight: 600
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>{updatingStatus ? 'Updating...' : 'Mark as Completed'}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="danger"
                      disabled={updatingStatus || statusSurvey.status === 'Cancelled'}
                      onClick={() => {
                        setShowCancelPrompt(true);
                        setCancelReason(statusSurvey.cancellation_reason || '');
                        setCancelReasonError('');
                      }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '0.65rem 1rem',
                        fontWeight: 600
                      }}
                    >
                      <XCircle size={16} />
                      <span>Mark as Cancelled</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

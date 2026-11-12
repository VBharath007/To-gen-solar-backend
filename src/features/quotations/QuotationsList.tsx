import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable, Column } from '../../components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useAlert } from '../../context/AlertContext';
import { generateQuotationPDF } from '../../utils/quotationPdfGenerator';
import type { Quotation } from '@shared/types/quotation.types';

export default function QuotationsList() {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);

    const [downloadingPdfId, setDownloadingPdfId] = useState<number | null>(null);

  const activeQuotations = useMemo(() => {
    return quotations.filter(q => q.status !== 'Expired');
  }, [quotations]);

  const expiredQuotations = useMemo(() => {
    return quotations.filter(q => q.status === 'Expired');
  }, [quotations]);

  const displayedQuotations = showExpired ? expiredQuotations : activeQuotations;

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await window.desktop.quotations.list();
      if (res.success) {
        setQuotations(res.data);
      } else {
        setError(res.error?.message || 'Failed to load quotations');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuotation = async (quote: Quotation) => {
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Quotation',
      description: `Are you sure you want to delete quotation ${quote.reference}? This action cannot be undone.`,
      confirmLabel: 'Delete Quotation',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await window.desktop.quotations.delete(quote.id);
      if (res.success) {
        setQuotations(prev => prev.filter(q => q.id !== quote.id));
      } else {
        await showAlert({
          type: 'error',
          title: 'Deletion Failed',
          description: res.error?.message || 'Failed to delete quotation',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err.message || String(err),
      });
    }
  };

  const handleIssueQuotation = async (quote: Quotation) => {
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Issue Quotation',
      description: `Are you sure you want to issue quotation "${quote.reference}"?`,
      confirmLabel: 'Issue Quotation',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) return;

    try {
      const now = new Date();
      const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await window.desktop.quotations.update({
        id: quote.id,
        status: 'Issued',
        issue_date: now.toISOString(),
        valid_until: validUntil,
      });
      if (res.success) {
        setQuotations(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'Issued', issue_date: res.data.issue_date || now.toISOString(), valid_until: res.data.valid_until || validUntil } : q));
        await showAlert({
          type: 'success',
          title: 'Quotation Issued',
          description: `Quotation "${quote.reference}" has been issued successfully.`,
        });
      } else {
        await showAlert({
          type: 'error',
          title: 'Failed to Issue Quotation',
          description: res.error?.message || 'Failed to issue quotation',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err.message || String(err),
      });
    }
  };

  const columns: Column<Quotation>[] = [
    { header: 'Quotation No.', accessor: (q) => <div className="font-semibold">{q.reference}</div> },
    {
      header: 'Customer',
      accessor: (q) => (
        <div>
          <span className="font-semibold text-primary">{q.customerName || (q as any).manual_customer_name || '-'}</span>
        </div>
      )
    },
    { header: 'Site', accessor: (q) => <span className="text-sm">{q.siteAddress || (q as any).manual_customer_address || '-'}</span> },
    { header: 'Issue Date', accessor: (q) => q.issue_date ? formatDate(q.issue_date) : '-' },
    { header: 'Grand Total', accessor: (q) => formatCurrency(q.grand_total / 100) }, // Paise to INR
    { header: 'Status', accessor: (q) => {
      const variants: Record<string, 'default'|'success'|'warning'|'danger'|'info'> = {
        'Draft': 'default',
        'Issued': 'info',
        'Accepted': 'success',
        'Rejected': 'danger',
        'Expired': 'danger'
      };
      return <Badge variant={variants[q.status]}>{q.status}</Badge>;
    }},
    {
      header: 'Actions',
      accessor: (q) => (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 62px)',
            gap: '8px',
            alignItems: 'center',
            paddingRight: '8px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="secondary"
            className="w-full h-8 !p-0 text-xs font-semibold flex items-center justify-center text-emerald-700 !border-emerald-600 hover:!bg-emerald-50 !shadow-none disabled:opacity-50"
            style={{ width: '62px', height: '32px', borderRadius: '6px', whiteSpace: 'nowrap' }}
            disabled={downloadingPdfId === q.id}
            onClick={async () => {
              setDownloadingPdfId(q.id);
              await new Promise(resolve => setTimeout(resolve, 50));
              try {
                const fullRes = await window.desktop.quotations.get(q.id);
                const fullQuote = fullRes.success ? fullRes.data : q;

                const tech = fullQuote.technicalDetails;
                const missing: string[] = [];

                const cat = (fullQuote.business_category || '').toUpperCase();
                const isStreetLight = cat === 'SOLAR_STREETLIGHT' || cat.includes('STREET LIGHT') || cat.includes('STREETLIGHT');
                const isWaterPump = cat === 'SOLAR_WATERPUMP' || cat.includes('WATER PUMP') || cat.includes('WATERPUMP');
                const isCctv = cat === 'SOLAR_CCTV' || cat.includes('CCTV');
                const isIC = cat === 'SOLAR_IC' || cat.includes('I & C') || cat.includes('I&C') || cat.includes('INSTALLATION') || cat.includes('COMMISSIONING');

                if (isStreetLight) {
                  if (!tech?.luminaire_wattage_w || Number(tech.luminaire_wattage_w) <= 0) missing.push('Wattage');
                  if (!tech?.light_type?.trim()) missing.push('Light Type');
                  if (!tech?.sl_panel_type?.trim()) missing.push('Solar Panel Type');
                  if (!tech?.pole_material?.trim()) missing.push('Pole Material');
                  if (!tech?.pole_height_ft || Number(tech.pole_height_ft) <= 0) missing.push('Pole Height (Feet)');
                } else if (isWaterPump) {
                  const pCap = tech?.pump_rating_kw ?? tech?.system_capacity_kw;
                  if (!pCap || Number(pCap) <= 0) missing.push('Solar Capacity (kW)');
                  if (!tech?.pump_hp || Number(tech.pump_hp) <= 0) missing.push('Solar Drive Capacity (HP)');
                  if (!tech?.vfd_model?.trim()) missing.push('Solar Drive Make & Model');
                  if (!tech?.connectivity?.trim()) missing.push('Connectivity Type');
                  if (!tech?.structure_material?.trim()) missing.push('Structure Type');
                  if (!tech?.structure_height || !String(tech.structure_height).trim()) missing.push('Structure Height');
                } else if (isCctv) {
                  if (!tech?.camera_model?.trim()) missing.push('Model / Make');
                  if (!tech?.connectivity?.trim()) missing.push('Connectivity Type');
                  if (!tech?.camera_mp?.trim()) missing.push('MP Capacity');
                  if (!tech?.memory_card_capacity?.trim()) missing.push('Memory Card Capacity');
                } else if (isIC) {
                  const icCap = tech?.system_capacity_kw ?? tech?.dc_capacity_kwp;
                  if (!icCap || Number(icCap) <= 0) missing.push('Capacity (kW)');
                } else {
                  if (!tech?.system_capacity_kw || tech.system_capacity_kw <= 0) missing.push('System Capacity (kW)');
                  if (!tech?.panel_specs?.trim()) missing.push('Solar Module/Panel specs');
                  if (!tech?.inverter_specs?.trim()) missing.push('Inverter specs');
                  if (!tech?.structure_type?.trim()) missing.push('Mounting Structure Type');
                  if (!tech?.area_required_sqft || tech.area_required_sqft <= 0) missing.push('Area Required (sq ft)');
                }

                if (missing.length > 0) {
                  showAlert({
                    type: 'warning',
                    title: 'Incomplete Quotation Details',
                    description: `This quotation cannot generate a Proposal PDF because technical details are incomplete:\n\n• ${missing.join('\n• ')}\n\nPlease edit this quotation to fill the required fields.`,
                  });
                  return;
                }

                await generateQuotationPDF(fullQuote);
              } catch (err: any) {
                showAlert({
                  type: 'error',
                  title: 'Quotation PDF Error',
                  description: err.message || 'Failed to generate quotation PDF',
                });
              } finally {
                setDownloadingPdfId(null);
              }
            }}
            title="Download Official Quotation Proposal PDF"
          >
            {downloadingPdfId === q.id ? (
              <div className="liquid-spinner"></div>
            ) : (
              'PDF'
            )}
          </Button>
          {q.status === 'Expired' ? (
            <span
              className="w-full h-8 text-[11px] font-semibold rounded-md bg-red-50 text-red-700 border border-red-200 flex items-center justify-center text-center"
              style={{ width: '62px', height: '32px', borderRadius: '6px' }}
            >
              Expired
            </span>
          ) : q.status === 'Issued' ? (
            <Button
              variant="secondary"
              disabled
              className="w-full h-8 !p-0 text-xs font-semibold flex items-center justify-center !bg-white !text-emerald-500 !border-emerald-300 opacity-90 cursor-default !shadow-none"
              style={{ width: '62px', height: '32px', borderRadius: '6px' }}
              title="This quotation is already issued"
            >
              Issued
            </Button>
          ) : (
            <Button
              variant="primary"
              className="w-full h-8 !p-0 text-xs font-semibold flex items-center justify-center !shadow-none"
              style={{ width: '62px', height: '32px', borderRadius: '6px' }}
              onClick={() => handleIssueQuotation(q)}
            >
              Issue
            </Button>
          )}
          <Button
            variant="secondary"
            className="w-full h-8 !p-0 text-xs font-semibold flex items-center justify-center text-emerald-700 !border-emerald-600 hover:!bg-emerald-50 !shadow-none"
            style={{ width: '62px', height: '32px', borderRadius: '6px' }}
            onClick={() => navigate(`/quotations/${q.id}`)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            className="w-full h-8 !p-0 text-xs font-semibold flex items-center justify-center !shadow-none"
            style={{ width: '62px', height: '32px', borderRadius: '6px' }}
            onClick={() => handleDeleteQuotation(q)}
          >
            Delete
          </Button>
        </div>
      ),
      width: '320px'
    }
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title={showExpired ? "Expired Quotations" : "Quotations"} 
        description={showExpired ? "Archived quotations that passed their 7-day validity." : "Manage customer quotes and proposals."}
        action={
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="expired-quotations-btn"
              onClick={() => setShowExpired(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: showExpired ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                backgroundColor: showExpired ? '#fef2f2' : '#ffffff',
                color: showExpired ? '#dc2626' : '#334155',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title={showExpired ? "Switch back to active quotations" : "View expired quotations"}
            >
              <span>{showExpired ? '← Active Quotations' : 'Expired'}</span>
            </button>
            <Button variant="primary" onClick={() => navigate('/quotations/new')}>+ New Quotation</Button>
          </div>
        }
      />

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {showExpired && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0.75rem 1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          marginBottom: '1rem',
          color: '#991b1b',
          fontSize: '0.875rem'
        }}>
          <span>⚠️</span>
          <span><strong>Showing Expired Quotations ({expiredQuotations.length})</strong> — These quotations exceeded the 7-day validity period and are separated from active workflow.</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-secondary">Loading quotations...</div>
      ) : (
        <DataTable 
          columns={columns}
          data={displayedQuotations}
          keyExtractor={row => row.id}
          onRowClick={(row) => navigate(`/quotations/${row.id}`)}
          searchPlaceholder={showExpired ? "Search expired quotations..." : "Search quotations by reference or customer..."}
        />
      )}
    </div>
  );
}

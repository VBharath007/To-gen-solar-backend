import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable, Column } from '../../components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { formatCurrency, formatDate, formatNotesToPlainText } from '../../utils/formatters';
import type { Invoice } from '@shared/types/finance.types';
import { generateTaxInvoicePDF, InvoiceData } from '../../utils/invoicePdfGenerator';
import { 
  getInvoiceBankAccount 
} from '../../utils/bankAccountStorage';
import { FileText, CheckCircle2, Clock, Filter, X } from 'lucide-react';

export default function InvoicesList() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await window.desktop.invoices.list();
      if (res.success) {
        setInvoices(res.data);
      } else {
        setError(res.error?.message || 'Failed to load invoices');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (inv: Invoice) => {
    setGeneratingPdfId(inv.id);
    try {
      // Fetch full invoice to get line items and joined customer fields
      const res = await window.desktop.invoices.get(inv.id);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch invoice details');
      
      const fullInvoice = res.data;
      // Retrieve the specific bank account assigned during invoice creation / edit
      const bank = getInvoiceBankAccount(fullInvoice.id, fullInvoice.bank_account_id);

      let custPhone: string | undefined = fullInvoice.customer_phone || undefined;
      let custAddress: string | undefined = fullInvoice.customer_address || undefined;
      let custCity: string | undefined = fullInvoice.customer_city || undefined;
      let custPincode: string | undefined = fullInvoice.customer_pincode || undefined;
      let custGstin: string | undefined = fullInvoice.customer_gstin || undefined;

      if (!custPhone || !custAddress) {
        try {
          if (fullInvoice.customer_id) {
            const cRes = await window.desktop.customers.get(fullInvoice.customer_id);
            if (cRes.success && cRes.data) {
              custPhone = custPhone || cRes.data.phone || undefined;
              custAddress = custAddress || cRes.data.address || undefined;
              custCity = custCity || cRes.data.city || undefined;
              custPincode = custPincode || cRes.data.pincode || undefined;
              custGstin = custGstin || cRes.data.gstin || undefined;
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Format address line with project ref if available
      const addressLines = [
        custAddress,
        fullInvoice.project_reference ? `Project: ${fullInvoice.project_reference}` : ''
      ].filter(Boolean).join('<br/>');

      const data: InvoiceData = {
        invoiceType: fullInvoice.invoice_type || 'Invoice',
        invoiceNo: fullInvoice.reference,
        invoiceDate: formatDate(fullInvoice.issue_date),
        dueDate: fullInvoice.due_date ? formatDate(fullInvoice.due_date) : undefined,
        placeOfSupply: fullInvoice.place_of_supply || 'Tamil Nadu',
        billTo: {
          name: fullInvoice.customer_name || 'Customer',
          address: addressLines || undefined,
          city: custCity || undefined,
          pincode: custPincode || undefined,
          gstin: custGstin || undefined,
          phone: custPhone || undefined,
        },
        items: (fullInvoice.lines || []).map(line => ({
          description: line.description,
          hsn: line.hsn_sac,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unit_price, // paise
          gstRate: line.tax_rate,
          total: line.taxable_value,  // paise
        })),
        notes: fullInvoice.notes ? formatNotesToPlainText(fullInvoice.notes) : undefined,
        bankDetails: {
          name: bank.bankName,
          branch: bank.branchName,
          accountHolder: bank.accountName,
          accountNo: bank.accountNumber,
          ifsc: bank.ifscCode,
          upiId: bank.upiId,
          accountType: bank.accountType
        }
      };

      await generateTaxInvoicePDF(data);
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'PDF Generation Error',
        description: err.message || 'Failed to generate PDF invoice.',
      });
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const getEffectiveInvoiceStatus = (i: Invoice): string => {
    if (i.status === 'Cancelled' || i.status === 'Draft' || i.status === 'Overdue') return i.status;
    const paid = i.amount_paid || 0;
    const total = i.total_amount || 0;
    if (total > 0 && paid >= total) return 'Paid';
    if (paid > 0 && paid < total) return 'Partial';
    if (paid === 0) return 'Pending';
    return i.status || 'Pending';
  };

  const columns: Column<Invoice>[] = [
    { header: 'Invoice No.', accessor: (i) => <div className="font-semibold">{i.reference}</div> },
    { header: 'Type', accessor: (i) => <Badge variant="default">{i.invoice_type || 'Invoice'}</Badge> },
    { header: 'Project Ref', accessor: (i) => i.project_reference },
    { header: 'Customer', accessor: 'customer_name' },
    { header: 'Issue Date', accessor: (i) => formatDate(i.issue_date) },
    { header: 'Amount', accessor: (i) => <span className="font-semibold whitespace-nowrap">{formatCurrency(i.total_amount / 100)}</span> },
    { 
      header: 'Paid', 
      accessor: (i) => {
        const paid = (i.amount_paid || 0) / 100;
        return (
          <span className="font-semibold text-success-color whitespace-nowrap">
            {formatCurrency(paid)}
          </span>
        );
      } 
    },
    { 
      header: 'Balance', 
      accessor: (i) => {
        const balance = Math.max(0, (i.total_amount - (i.amount_paid || 0)) / 100);
        return (
          <span className={`whitespace-nowrap ${balance > 0 ? "font-bold text-danger" : "font-semibold text-success-color"}`}>
            {formatCurrency(balance)}
          </span>
        );
      } 
    },
    { header: 'Status', accessor: (i) => {
      const effStatus = getEffectiveInvoiceStatus(i);
      const variants: Record<string, 'default'|'success'|'warning'|'danger'|'info'> = {
        'Draft': 'default',
        'Pending': 'warning',
        'Sent': 'info',
        'Partial': 'warning',
        'Partially Paid': 'warning',
        'Paid': 'success',
        'Overdue': 'danger',
        'Cancelled': 'danger'
      };
      return <Badge variant={variants[effStatus] || 'default'}>{effStatus}</Badge>;
    }},
    { 
      header: 'Actions', 
      accessor: (i) => {
        const balance = (i.total_amount - (i.amount_paid || 0)) / 100;
        return (
          <div className="flex items-center gap-2" style={{ paddingRight: '8px' }}>
            <Button variant="secondary" onClick={() => navigate(`/invoices/${i.id}`)}>View</Button>
            <Button variant="secondary" onClick={() => navigate(`/invoices/${i.id}/edit`)}>Edit</Button>
            {balance > 0 && (
              <Button 
                variant="primary" 
                onClick={() => navigate(`/payments/new?invoiceId=${i.id}`)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                + Log Payment
              </Button>
            )}
            <Button
              variant="secondary"
              className="h-8 !p-0 text-xs font-semibold flex items-center justify-center text-emerald-700 !border-emerald-600 hover:!bg-emerald-50 !shadow-none disabled:opacity-50"
              style={{ width: '62px', height: '32px', borderRadius: '6px', whiteSpace: 'nowrap' }}
              disabled={generatingPdfId === i.id}
              onClick={() => handleDownloadPDF(i)}
              title="Download Invoice PDF"
            >
              {generatingPdfId === i.id ? (
                <div className="liquid-spinner"></div>
              ) : (
                'PDF'
              )}
            </Button>
          </div>
        );
      },
      width: '290px'
    }
  ];

  // Status counts for filter pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: invoices.length,
      Pending: 0,
      Partial: 0,
      Paid: 0,
      Draft: 0,
      Overdue: 0,
    };
    for (const inv of invoices) {
      const st = getEffectiveInvoiceStatus(inv);
      if (st === 'Pending') counts.Pending++;
      else if (st === 'Partial') counts.Partial++;
      else if (st === 'Paid') counts.Paid++;
      else if (st === 'Draft') counts.Draft++;
      else if (st === 'Overdue') counts.Overdue++;
    }
    return counts;
  }, [invoices]);

  // Overall financial summary for top banner
  const financialSummary = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    for (const inv of invoices) {
      totalInvoiced += (inv.total_amount || 0);
      totalPaid += (inv.amount_paid || 0);
    }
    const totalOutstanding = Math.max(0, totalInvoiced - totalPaid);
    return {
      totalInvoiced: totalInvoiced / 100,
      totalPaid: totalPaid / 100,
      totalOutstanding: totalOutstanding / 100,
    };
  }, [invoices]);

  // Filtered invoices according to selected status and search term
  const filteredInvoices = useMemo(() => {
    return invoices.filter(i => {
      const effStatus = getEffectiveInvoiceStatus(i);
      // 1. Status filter
      let matchStatus = true;
      if (selectedStatus === 'ALL') {
        matchStatus = true;
      } else if (selectedStatus === 'UNPAID') {
        matchStatus = (i.total_amount - (i.amount_paid || 0)) > 0;
      } else {
        matchStatus = effStatus === selectedStatus;
      }

      if (!matchStatus) return false;

      // 2. Search query match
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const ref = (i.reference || '').toLowerCase();
      const cust = (i.customer_name || '').toLowerCase();
      const proj = (i.project_reference || '').toLowerCase();
      return ref.includes(term) || cust.includes(term) || proj.includes(term);
    });
  }, [invoices, selectedStatus, searchTerm]);

  const filterTabs = [
    { id: 'ALL', label: 'All Invoices', count: statusCounts.ALL, dotColor: '#0b75b9', activeBg: '#0b75b9', borderColor: '#0b75b9' },
    { id: 'Pending', label: 'Pending', count: statusCounts.Pending, dotColor: '#d97706', activeBg: '#d97706', borderColor: '#d97706' },
    { id: 'Partial', label: 'Partial', count: statusCounts.Partial, dotColor: '#0284c7', activeBg: '#0284c7', borderColor: '#0284c7' },
    { id: 'Paid', label: 'Paid', count: statusCounts.Paid, dotColor: '#16a34a', activeBg: '#16a34a', borderColor: '#16a34a' },
    { id: 'UNPAID', label: 'Outstanding Due', count: statusCounts.Pending + statusCounts.Partial, dotColor: '#dc2626', activeBg: '#dc2626', borderColor: '#dc2626' },
    { id: 'Draft', label: 'Draft', count: statusCounts.Draft, dotColor: '#64748b', activeBg: '#475569', borderColor: '#475569' },
    { id: 'Overdue', label: 'Overdue', count: statusCounts.Overdue, dotColor: '#dc2626', activeBg: '#dc2626', borderColor: '#dc2626' },
  ];

  return (
    <div className="animate-fade-in pb-12">
      <PageHeader 
        title="Invoices" 
        description="Manage project billing and track unpaid balances."
        action={<Button variant="primary" onClick={() => navigate('/invoices/new')}>+ Generate Invoice</Button>}
      />

      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Dynamic Interactive Financial KPI Cards */}
      <div className="kpi-grid kpi-grid-3">
        {/* Card 1: Total Invoiced */}
        <div 
          className="kpi-card"
          onClick={() => setSelectedStatus('ALL')}
          style={{
            backgroundColor: selectedStatus === 'ALL' ? '#f0f7fe' : '#ffffff',
            border: selectedStatus === 'ALL' ? '2px solid #0b75b9' : '1px solid #dbe7f3',
            boxShadow: selectedStatus === 'ALL' ? '0 4px 14px rgba(11, 117, 185, 0.16)' : undefined,
            cursor: 'pointer',
          }}
          title="Click to view all invoices"
        >
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: selectedStatus === 'ALL' ? '#0b75b9' : '#e1f0fa',
              color: selectedStatus === 'ALL' ? '#ffffff' : '#0b75b9',
            }}
          >
            <FileText />
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">
              Total Invoiced
            </div>
            <div className="kpi-card-value currency" style={{ color: '#0b75b9' }}>
              {formatCurrency(financialSummary.totalInvoiced)}
            </div>
            <div className="kpi-card-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 600, color: '#0b75b9' }}>{invoices.length}</span> total invoices
            </div>
          </div>
          {selectedStatus === 'ALL' && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '3px',
              backgroundColor: '#0b75b9'
            }} />
          )}
        </div>

        {/* Card 2: Total Collected (Paid) */}
        <div 
          className="kpi-card"
          onClick={() => setSelectedStatus(selectedStatus === 'Paid' ? 'ALL' : 'Paid')}
          style={{
            backgroundColor: selectedStatus === 'Paid' ? '#f0fdf4' : '#ffffff',
            border: selectedStatus === 'Paid' ? '2px solid #16a34a' : '1px solid #dbe7f3',
            boxShadow: selectedStatus === 'Paid' ? '0 4px 14px rgba(22, 163, 74, 0.16)' : undefined,
            cursor: 'pointer',
          }}
          title="Click to filter Paid invoices"
        >
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: selectedStatus === 'Paid' ? '#16a34a' : '#e2f7e5',
              color: selectedStatus === 'Paid' ? '#ffffff' : '#2e8b38',
            }}
          >
            <CheckCircle2 />
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">
              Total Collected
            </div>
            <div className="kpi-card-value currency" style={{ color: '#1b5e20' }}>
              {formatCurrency(financialSummary.totalPaid)}
            </div>
            <div className="kpi-card-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 600, color: '#16a34a' }}>{statusCounts.Paid}</span> fully paid
            </div>
          </div>
          {selectedStatus === 'Paid' && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '3px',
              backgroundColor: '#16a34a'
            }} />
          )}
        </div>

        {/* Card 3: Total Outstanding Due (Unpaid & Partial) */}
        <div 
          className="kpi-card"
          onClick={() => setSelectedStatus(selectedStatus === 'UNPAID' ? 'ALL' : 'UNPAID')}
          style={{
            backgroundColor: selectedStatus === 'UNPAID' ? '#fef2f2' : '#ffffff',
            border: selectedStatus === 'UNPAID' ? '2px solid #dc2626' : '1px solid #dbe7f3',
            boxShadow: selectedStatus === 'UNPAID' ? '0 4px 14px rgba(220, 38, 38, 0.16)' : undefined,
            cursor: 'pointer',
          }}
          title="Click to filter Outstanding (Unpaid & Partial) invoices"
        >
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: selectedStatus === 'UNPAID' ? '#dc2626' : '#fee2e2',
              color: selectedStatus === 'UNPAID' ? '#ffffff' : '#dc2626',
            }}
          >
            <Clock />
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">
              Total Outstanding Due
            </div>
            <div className="kpi-card-value currency" style={{ color: '#dc2626' }}>
              {formatCurrency(financialSummary.totalOutstanding)}
            </div>
            <div className="kpi-card-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontWeight: 600, color: '#dc2626' }}>{statusCounts.Pending + statusCounts.Partial}</span> pending & partial
            </div>
          </div>
          {selectedStatus === 'UNPAID' && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '3px',
              backgroundColor: '#dc2626'
            }} />
          )}
        </div>
      </div>

      {/* Status Filter Pills Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        overflowX: 'auto',
        paddingBottom: '4px',
        flexWrap: 'wrap'
      }}>
        {filterTabs.map(tab => {
          const isActive = selectedStatus === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStatus(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 500,
                border: isActive ? `1.5px solid ${tab.borderColor || '#0b75b9'}` : '1px solid #d4e5f5',
                backgroundColor: isActive ? (tab.activeBg || '#0b75b9') : '#ffffff',
                color: isActive ? '#ffffff' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 6px rgba(11, 117, 185, 0.2)' : 'none',
              }}
            >
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: isActive ? '#ffffff' : (tab.dotColor || '#94a3b8'),
                display: 'inline-block'
              }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-8 text-center text-secondary">Loading invoices...</div>
      ) : (
        <DataTable 
          columns={columns}
          data={filteredInvoices}
          keyExtractor={row => row.id}
          onRowClick={(row) => navigate(`/invoices/${row.id}`)}
          searchPlaceholder="Search invoices by number, customer, project..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filterSlot={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#55728f', fontWeight: 600 }}>
                <Filter size={14} style={{ color: '#0b75b9' }} />
                Status:
              </span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  border: selectedStatus !== 'ALL' ? '1.5px solid #0b75b9' : '1px solid #d4e5f5',
                  backgroundColor: selectedStatus !== 'ALL' ? '#f0f7fe' : '#ffffff',
                  color: selectedStatus !== 'ALL' ? '#0b75b9' : 'var(--text-primary)',
                  fontWeight: selectedStatus !== 'ALL' ? 600 : 400,
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
                <option value="UNPAID">Outstanding Balance</option>
                <option value="Draft">Draft</option>
                <option value="Overdue">Overdue</option>
              </select>
              {selectedStatus !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedStatus('ALL')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #fee2e2',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                  title="Clear status filter"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}

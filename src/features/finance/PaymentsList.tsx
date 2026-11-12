import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable, Column } from '../../components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAlert } from '../../context/AlertContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { Payment } from '@shared/types/finance.types';
import { generateReceiptPDF, ReceiptData } from '../../utils/receiptPdfGenerator';
import { Filter, X } from 'lucide-react';

export default function PaymentsList() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await window.desktop.payments.list();
      if (res.success) {
        setPayments(res.data);
      } else {
        setError(res.error?.message || 'Failed to load payments');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (p: Payment) => {
    setGeneratingPdfId(p.id);
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      let inv: any = null;
      if (p.invoice_id) {
        const invRes = await window.desktop.invoices.get(p.invoice_id);
        if (invRes.success && invRes.data) {
          inv = invRes.data;
        }
      }

      const items = (inv?.lines || []).map((l: any, idx: number) => ({
        slNo: idx + 1,
        description: l.description,
        hsn: l.hsn_sac || '',
        quantity: Number(l.quantity) || 1,
        unit: l.unit || 'Nos',
        unitPrice: l.unit_price, // paise
        taxRate: l.tax_rate || 0,
        total: l.line_total || l.taxable_value || 0, // paise
      }));

      const totalQuantity = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
      const totalProductCount = items.length;

      const data: ReceiptData = {
        receiptNo: p.reference,
        paymentDate: formatDate(p.payment_date),
        customerName: (p as any).customer_name || inv?.customer_name || 'Customer',
        customerPhone: inv?.customer_phone,
        customerAddress: inv?.customer_address,
        customerCity: inv?.customer_city,
        amount: p.amount,
        paymentMethod: p.payment_method,
        transactionId: p.transaction_id || undefined,
        invoiceRef: p.invoice_reference || inv?.reference || undefined,
        invoiceDate: inv?.issue_date ? formatDate(inv.issue_date) : undefined,
        notes: p.notes || undefined,
        taxableAmount: inv?.amount,
        taxAmount: inv?.tax_amount,
        invoiceTotal: inv?.total_amount,
        totalPaidToDate: inv?.amount_paid,
        balanceDue: inv ? Math.max(0, inv.total_amount - inv.amount_paid) : undefined,
        items: items.length > 0 ? items : undefined,
        totalProductCount: items.length > 0 ? totalProductCount : undefined,
        totalQuantity: items.length > 0 ? totalQuantity : undefined,
      };
      await generateReceiptPDF(data);
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'PDF Generation Error',
        description: err.message || 'Failed to generate Receipt PDF.',
      });
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const getPaymentStatus = (p: Payment): string => {
    if (p.payment_type === 'Advance' || (!p.invoice_id && !p.invoice_reference)) {
      return 'Advance';
    }
    const invStatus = p.invoice_status;
    if (invStatus === 'Paid') return 'Paid';
    if (invStatus === 'Partial' || invStatus === 'Partially Paid') return 'Partial';
    return invStatus || 'Paid';
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: payments.length,
      Paid: 0,
      Partial: 0,
      Advance: 0,
    };
    for (const p of payments) {
      const st = getPaymentStatus(p);
      if (st === 'Paid') counts.Paid++;
      else if (st === 'Partial') counts.Partial++;
      else if (st === 'Advance') counts.Advance++;
      else counts.Paid++;
    }
    return counts;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // 1. Status match
      if (selectedStatus !== 'ALL') {
        const st = getPaymentStatus(p);
        if (st !== selectedStatus) return false;
      }

      // 2. Search query match
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const ref = (p.reference || '').toLowerCase();
      const cust = ((p as any).customer_name || '').toLowerCase();
      const invRef = (p.invoice_reference || '').toLowerCase();
      const txId = (p.transaction_id || '').toLowerCase();
      return ref.includes(term) || cust.includes(term) || invRef.includes(term) || txId.includes(term);
    });
  }, [payments, selectedStatus, searchTerm]);

  const filterTabs = [
    { id: 'ALL', label: 'All Payments', count: statusCounts.ALL, dotColor: '#0b75b9', activeBg: '#0b75b9', borderColor: '#0b75b9' },
    { id: 'Paid', label: 'Paid', count: statusCounts.Paid, dotColor: '#16a34a', activeBg: '#16a34a', borderColor: '#16a34a' },
    { id: 'Partial', label: 'Partial', count: statusCounts.Partial, dotColor: '#0284c7', activeBg: '#0284c7', borderColor: '#0284c7' },
  ];

  const columns: Column<Payment>[] = [
    { header: 'Payment Ref', accessor: (p) => <div className="font-semibold">{p.reference}</div> },
    { header: 'Invoice', accessor: (p) => p.invoice_reference || '-' },
    { header: 'Customer', accessor: (p) => (p as any).customer_name || 'Direct Customer' },
    { header: 'Date', accessor: (p) => formatDate(p.payment_date) },
    { header: 'Method', accessor: 'payment_method' },
    { header: 'Transaction ID', accessor: (p) => p.transaction_id || '-' },
    { header: 'Amount', accessor: (p) => <span className="font-bold text-success-color">{formatCurrency(p.amount / 100)}</span> },
    {
      header: 'Status',
      accessor: (p) => {
        const st = getPaymentStatus(p);
        const variants: Record<string, 'success' | 'warning' | 'info' | 'default'> = {
          'Paid': 'success',
          'Partial': 'warning',
          'Advance': 'info',
        };
        return <Badge variant={variants[st] || 'success'}>{st}</Badge>;
      }
    },
    { 
      header: 'Actions', 
      accessor: (p) => (
        <div className="flex items-center gap-2" style={{ paddingRight: '8px' }}>
          <Button 
            variant="secondary" 
            className="text-xs py-1 px-3 whitespace-nowrap"
            onClick={() => navigate(`/payments/${p.id}`)}
          >
            View Details
          </Button>
          <Button
            variant="secondary"
            className="h-8 !p-0 text-xs font-semibold flex items-center justify-center text-emerald-700 !border-emerald-600 hover:!bg-emerald-50 !shadow-none disabled:opacity-50"
            style={{ width: '62px', height: '32px', borderRadius: '6px', whiteSpace: 'nowrap' }}
            disabled={generatingPdfId === p.id}
            onClick={() => handleDownloadPDF(p)}
            title="Download Receipt PDF"
          >
            {generatingPdfId === p.id ? (
              <div className="liquid-spinner"></div>
            ) : (
              'PDF'
            )}
          </Button>
        </div>
      ),
      width: '220px'
    }
  ];

  return (
    <div className="animate-fade-in pb-12">
      <PageHeader 
        title="Payments Received" 
        description="Track all incoming customer payments against invoices."
        action={<Button variant="primary" onClick={() => navigate('/payments/new')}>+ Log Payment</Button>}
      />

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Status-Based Filter Pills */}
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
        <div className="p-8 text-center text-secondary">Loading payments...</div>
      ) : (
        <DataTable 
          columns={columns}
          data={filteredPayments}
          keyExtractor={row => row.id}
          searchPlaceholder="Search payments by reference, customer, invoice..."
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
                <option value="Paid">Paid</option>
                <option value="Partial">Partial</option>
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

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { Payment } from '@shared/types/finance.types';
import { generateReceiptPDF, ReceiptData } from '../../utils/receiptPdfGenerator';

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (id) {
      loadPayment(Number(id));
    }
  }, [id]);

  const loadPayment = async (paymentId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.desktop.payments.get(paymentId);
      if (res.success) {
        setPayment(res.data);
      } else {
        setError(res.error?.message || 'Payment not found');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!payment) return;
    setGeneratingPdf(true);
    try {
      let inv: any = null;
      if (payment.invoice_id) {
        const invRes = await window.desktop.invoices.get(payment.invoice_id);
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
        unitPrice: l.unit_price,
        taxRate: l.tax_rate || 0,
        total: l.line_total || l.taxable_value || 0,
      }));

      const totalQuantity = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
      const totalProductCount = items.length;

      const data: ReceiptData = {
        receiptNo: payment.reference,
        paymentDate: formatDate(payment.payment_date),
        customerName: (payment as any).customer_name || inv?.customer_name || 'Customer',
        customerPhone: inv?.customer_phone,
        customerAddress: inv?.customer_address,
        customerCity: inv?.customer_city,
        amount: payment.amount,
        paymentMethod: payment.payment_method,
        transactionId: payment.transaction_id || undefined,
        invoiceRef: payment.invoice_reference || inv?.reference || undefined,
        invoiceDate: inv?.issue_date ? formatDate(inv.issue_date) : undefined,
        notes: payment.notes || undefined,
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
      setGeneratingPdf(false);
    }
  };

  const handleDelete = async () => {
    if (!payment) return;
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Payment Receipt',
      description: `Are you sure you want to delete payment receipt "${payment.reference}" for ${formatCurrency(payment.amount / 100)}? This will adjust related invoice balances.`,
      confirmLabel: 'Delete Payment',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });

    if (!confirmed) return;

    try {
      const res = await window.desktop.payments.delete(payment.id);
      if (res.success) {
        await showAlert({
          type: 'success',
          title: 'Payment Deleted',
          description: `Payment ${payment.reference} has been deleted successfully.`,
        });
        navigate('/payments');
      } else {
        await showAlert({
          type: 'error',
          title: 'Delete Failed',
          description: res.error?.message || 'Failed to delete payment record.',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err?.message || 'Failed to delete payment record.',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <span>Loading payment details...</span>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert type="error" message={error || 'Payment not found.'} className="mb-4" />
        <Button variant="secondary" onClick={() => navigate('/payments')}>
          ← Back to Payments
        </Button>
      </div>
    );
  }

  const getStatusBadge = () => {
    const isAdv = payment.payment_type === 'Advance' || (!payment.invoice_id && !payment.invoice_reference);
    if (isAdv) return <Badge variant="info">Advance</Badge>;
    const invStatus = payment.invoice_status;
    if (invStatus === 'Paid') return <Badge variant="success">Paid</Badge>;
    if (invStatus === 'Partial' || invStatus === 'Partially Paid') return <Badge variant="warning">Partial</Badge>;
    return <Badge variant="success">{invStatus || 'Paid'}</Badge>;
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto pb-12">
      <PageHeader 
        title={`Payment: ${payment.reference}`} 
        description={`Payment Receipt ID: #${payment.id} • Date: ${formatDate(payment.payment_date)}`}
        breadcrumbs={[
          { label: 'Payments', to: '/payments' },
          { label: payment.reference }
        ]}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/payments')}>
              ← Back to List
            </Button>
            <Button 
              variant="primary" 
              onClick={handleDownloadPDF}
              isLoading={generatingPdf}
              disabled={generatingPdf}
            >
              Download PDF
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      />

      {/* Main Content */}
      <div className="flex flex-col gap-6 mt-6">
        {/* Top Summary Card */}
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', padding: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Amount Received
              </label>
              <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                {formatCurrency(payment.amount / 100)}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Status
              </label>
              <div style={{ marginTop: '4px' }}>
                {getStatusBadge()}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Payment Method
              </label>
              <div style={{ marginTop: '2px' }}>
                <span style={{ 
                  display: 'inline-block', 
                  padding: '5px 14px', 
                  backgroundColor: 'var(--bg-surface-subtle)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)'
                }}>
                  {payment.payment_method}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Row 1: Payment Info & References */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Card 1: Payment & Transaction Details */}
          <Card title="Payment & Transaction Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Receipt Reference
                </label>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {payment.reference}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Payment Date
                </label>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {formatDate(payment.payment_date)}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Payment Type
                </label>
                <div style={{ marginTop: '2px' }}>
                  <Badge variant={payment.payment_type === 'Advance' ? 'info' : 'default'}>
                    {payment.payment_type || 'Receipt'}
                  </Badge>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Transaction / UTR Number
                </label>
                <div style={{ fontSize: '0.95rem', fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {payment.transaction_id || <span className="text-muted" style={{ fontFamily: 'inherit' }}>—</span>}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Bank Reference
                </label>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {payment.bank_ref || <span className="text-muted">—</span>}
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Customer & Associated Records */}
          <Card title="Customer & Associated Records">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color-subtle)' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Customer
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '2px' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {(payment as any).customer_name || 'Direct Customer'}
                  </div>
                  {payment.customer_id ? (
                    <Button 
                      variant="secondary" 
                      className="text-xs py-1 px-3 whitespace-nowrap"
                      onClick={() => navigate(`/customers/${payment.customer_id}`)}
                    >
                      View Customer
                    </Button>
                  ) : null}
                </div>
              </div>

              <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color-subtle)' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Linked Invoice
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '2px' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {payment.invoice_reference || (
                      <span className="text-muted">Direct Payment (No invoice linked)</span>
                    )}
                  </div>
                  {payment.invoice_id ? (
                    <Button 
                      variant="secondary" 
                      className="text-xs py-1 px-3 whitespace-nowrap"
                      onClick={() => navigate(`/invoices/${payment.invoice_id}`)}
                    >
                      View Invoice
                    </Button>
                  ) : null}
                </div>
              </div>

              <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color-subtle)' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Linked Project
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '2px' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {payment.project_reference || <span className="text-muted">—</span>}
                  </div>
                  {payment.project_id ? (
                    <Button 
                      variant="secondary" 
                      className="text-xs py-1 px-3 whitespace-nowrap"
                      onClick={() => navigate(`/projects/${payment.project_id}`)}
                    >
                      View Project
                    </Button>
                  ) : null}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Record Created At
                </label>
                <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {formatDate(payment.created_at)}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Row 2: Notes Card */}
        <Card title="Notes & Remarks">
          {payment.notes?.trim() ? (
            <div 
              style={{ 
                fontSize: '0.925rem',
                color: 'var(--text-primary)',
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-surface-subtle)', 
                border: '1px solid var(--border-color-subtle)',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}
            >
              {payment.notes}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No notes or remarks recorded for this payment.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

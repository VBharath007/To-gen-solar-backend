import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { formatCurrency, formatDate, formatNotesToPlainText } from '../../utils/formatters';
import type { Invoice, Payment } from '@shared/types/finance.types';
import { generateTaxInvoicePDF, InvoiceData } from '../../utils/invoicePdfGenerator';
import { getInvoiceBankAccount } from '../../utils/bankAccountStorage';
import { 
  FileText, 
  Download, 
  Edit3, 
  CreditCard, 
  ArrowLeft, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Building2,
  User,
  Calendar,
  Layers,
  Receipt
} from 'lucide-react';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (id) {
      loadInvoiceDetails(Number(id));
    }
  }, [id]);

  const loadInvoiceDetails = async (invoiceId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.desktop.invoices.get(invoiceId);
      if (!res.success || !res.data) {
        setError(res.error?.message || 'Invoice not found');
        return;
      }

      let invoiceData = res.data;

      // Enhance customer details if missing
      if (invoiceData.customer_id && (!invoiceData.customer_phone || !invoiceData.customer_address)) {
        try {
          const cRes = await window.desktop.customers.get(invoiceData.customer_id);
          if (cRes.success && cRes.data) {
            invoiceData = {
              ...invoiceData,
              customer_phone: invoiceData.customer_phone || cRes.data.phone,
              customer_address: invoiceData.customer_address || cRes.data.address,
              customer_city: invoiceData.customer_city || cRes.data.city,
              customer_pincode: invoiceData.customer_pincode || cRes.data.pincode,
              customer_gstin: invoiceData.customer_gstin || cRes.data.gstin,
            };
          }
        } catch {
          // Ignore fallback error
        }
      }

      setInvoice(invoiceData);

      // Fetch linked payments
      try {
        const payRes = await window.desktop.payments.list();
        if (payRes.success && payRes.data) {
          const linked = payRes.data.filter((p: Payment) => p.invoice_id === invoiceId);
          setPayments(linked);
        }
      } catch {
        // Non-blocking
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveStatus = (inv: Invoice): string => {
    if (inv.status === 'Cancelled' || inv.status === 'Draft' || inv.status === 'Overdue') return inv.status;
    const paid = inv.amount_paid || 0;
    const total = inv.total_amount || 0;
    if (paid >= total && total > 0) return 'Paid';
    if (paid > 0 && paid < total) return 'Partial';
    return inv.status || 'Pending';
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    setGeneratingPdf(true);
    try {
      const bank = getInvoiceBankAccount(invoice.id, invoice.bank_account_id);

      const addressLines = [
        invoice.customer_address,
        invoice.project_reference ? `Project: ${invoice.project_reference}` : ''
      ].filter(Boolean).join('<br/>');

      const data: InvoiceData = {
        invoiceType: invoice.invoice_type || 'Tax Invoice',
        invoiceNo: invoice.reference,
        invoiceDate: formatDate(invoice.issue_date),
        dueDate: invoice.due_date ? formatDate(invoice.due_date) : undefined,
        placeOfSupply: invoice.place_of_supply || 'Tamil Nadu',
        billTo: {
          name: invoice.customer_name || 'Customer',
          address: addressLines || undefined,
          city: invoice.customer_city || undefined,
          pincode: invoice.customer_pincode || undefined,
          gstin: invoice.customer_gstin || undefined,
          phone: invoice.customer_phone || undefined,
        },
        items: (invoice.lines || []).map((line) => ({
          description: line.description,
          hsn: line.hsn_sac,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unit_price,
          gstRate: line.tax_rate,
          total: line.taxable_value,
        })),
        notes: invoice.notes ? formatNotesToPlainText(invoice.notes) : undefined,
        bankDetails: {
          name: bank.bankName,
          branch: bank.branchName,
          accountHolder: bank.accountName,
          accountNo: bank.accountNumber,
          ifsc: bank.ifscCode,
          upiId: bank.upiId,
          accountType: bank.accountType,
        },
      };

      await generateTaxInvoicePDF(data);
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'PDF Generation Error',
        description: err.message || 'Failed to generate Invoice PDF.',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;

    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Invoice',
      description: `Are you sure you want to delete invoice "${invoice.reference}"? This action cannot be undone.`,
      confirmLabel: 'Delete Invoice',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    try {
      const res = await window.desktop.invoices.delete(invoice.id);
      if (res.success) {
        await showAlert({
          type: 'success',
          title: 'Invoice Deleted',
          description: `Invoice ${invoice.reference} has been deleted successfully.`,
        });
        navigate('/invoices');
      } else {
        await showAlert({
          type: 'error',
          title: 'Delete Failed',
          description: res.error?.message || 'Failed to delete invoice.',
        });
      }
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Error',
        description: err?.message || 'Failed to delete invoice.',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16 text-secondary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3"></div>
        <span>Loading invoice details...</span>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert type="error" message={error || 'Invoice not found.'} className="mb-4" />
        <Button variant="secondary" onClick={() => navigate('/invoices')}>
          ← Back to Invoices
        </Button>
      </div>
    );
  }

  const effectiveStatus = getEffectiveStatus(invoice);
  const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    'Draft': 'default',
    'Sent': 'info',
    'Pending': 'info',
    'Partial': 'warning',
    'Paid': 'success',
    'Overdue': 'danger',
    'Cancelled': 'danger'
  };

  const total = invoice.total_amount / 100;
  const paid = (invoice.amount_paid || 0) / 100;
  const balance = Math.max(0, total - paid);
  const subtotal = (invoice.amount || 0) / 100;
  const totalTax = (invoice.tax_amount || 0) / 100;

  const bank = getInvoiceBankAccount(invoice.id, invoice.bank_account_id);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-12">
      <PageHeader 
        title={`${invoice.invoice_type || 'Invoice'}: ${invoice.reference}`} 
        description={`Invoice #${invoice.id} • Issued: ${formatDate(invoice.issue_date)}${invoice.due_date ? ` • Due: ${formatDate(invoice.due_date)}` : ''}`}
        breadcrumbs={[
          { label: 'Invoices', to: '/invoices' },
          { label: invoice.reference }
        ]}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => navigate('/invoices')}>
              <ArrowLeft size={16} className="mr-1" /> Back
            </Button>
            <Button 
              variant="primary" 
              onClick={handleDownloadPDF}
              isLoading={generatingPdf}
              disabled={generatingPdf}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download size={16} className="mr-1" /> Download PDF
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
            >
              <Edit3 size={16} className="mr-1" /> Edit
            </Button>
            {balance > 0 && (
              <Button 
                variant="primary" 
                onClick={() => navigate(`/payments/new?invoiceId=${invoice.id}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CreditCard size={16} className="mr-1" /> + Record Payment
              </Button>
            )}
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 size={16} className="mr-1" /> Delete
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        {/* Total Amount */}
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted mb-1">
            Total Amount
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {formatCurrency(total)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Taxable: {formatCurrency(subtotal)} + GST: {formatCurrency(totalTax)}
          </div>
        </Card>

        {/* Paid Amount */}
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted mb-1">
            Amount Paid
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {formatCurrency(paid)}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-500" />
            {payments.length} payment(s) recorded
          </div>
        </Card>

        {/* Balance Due */}
        <Card className={`p-4 border-l-4 ${balance > 0 ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
          <div className="text-xs uppercase tracking-wider font-semibold text-muted mb-1">
            Balance Due
          </div>
          <div className={`text-2xl font-bold ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {formatCurrency(balance)}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            {balance > 0 ? (
              <Clock size={13} className="text-amber-500" />
            ) : (
              <CheckCircle2 size={13} className="text-emerald-500" />
            )}
            {balance > 0 ? 'Pending payment' : 'Fully settled'}
          </div>
        </Card>

        {/* Status & Type */}
        <Card className="p-4 border-l-4 border-l-indigo-500">
          <div className="text-xs uppercase tracking-wider font-semibold text-muted mb-1">
            Status / Type
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={statusVariants[effectiveStatus] || 'default'}>
              {effectiveStatus}
            </Badge>
          </div>
          <div className="text-xs text-slate-600 font-medium mt-2">
            {invoice.invoice_type || 'Tax Invoice'} • {invoice.tax_inclusive ? 'Tax Inclusive' : 'Tax Exclusive'}
          </div>
        </Card>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Customer Information (Left 2 cols) */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border-color">
            <User size={18} className="text-emerald-600" />
            <h3 className="text-base font-bold text-slate-800">Customer & Invoice Information</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted font-medium block uppercase tracking-wider">Customer Name</span>
              <span className="font-semibold text-slate-900 text-base">{invoice.customer_name || 'N/A'}</span>
            </div>

            <div>
              <span className="text-xs text-muted font-medium block uppercase tracking-wider">Phone</span>
              <span className="text-slate-800">{invoice.customer_phone || 'N/A'}</span>
            </div>

            <div>
              <span className="text-xs text-muted font-medium block uppercase tracking-wider">Place of Supply</span>
              <span className="text-slate-800">{invoice.place_of_supply || 'Tamil Nadu'}</span>
            </div>

            <div>
              <span className="text-xs text-muted font-medium block uppercase tracking-wider">Customer GSTIN</span>
              <span className="text-slate-800 font-mono">{invoice.customer_gstin || 'Unregistered'}</span>
            </div>

            <div className="md:col-span-2">
              <span className="text-xs text-muted font-medium block uppercase tracking-wider">Billing / Site Address</span>
              <span className="text-slate-800">
                {[invoice.customer_address, invoice.customer_city, invoice.customer_pincode].filter(Boolean).join(', ') || 'N/A'}
              </span>
            </div>

            {invoice.quotation_reference && (
              <div>
                <span className="text-xs text-muted font-medium block uppercase tracking-wider">Linked Quotation</span>
                <span className="font-semibold text-emerald-700">{invoice.quotation_reference}</span>
              </div>
            )}

            {invoice.project_reference && (
              <div>
                <span className="text-xs text-muted font-medium block uppercase tracking-wider">Linked Project</span>
                <span className="font-semibold text-blue-700">{invoice.project_reference}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Bank & Payment Destination (Right 1 col) */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border-color">
            <Building2 size={18} className="text-blue-600" />
            <h3 className="text-base font-bold text-slate-800">Bank Account Details</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-muted font-medium block uppercase tracking-wider">Bank Name</span>
              <span className="font-semibold text-slate-900">{bank.bankName}</span>
            </div>

            <div>
              <span className="text-xs text-muted font-medium block uppercase tracking-wider">Account Number</span>
              <span className="font-mono font-medium text-slate-800">{bank.accountNumber}</span>
            </div>

            <div>
              <span className="text-xs text-muted font-medium block uppercase tracking-wider">IFSC Code</span>
              <span className="font-mono font-medium text-slate-800">{bank.ifscCode}</span>
            </div>

            <div>
              <span className="text-xs text-muted font-medium block uppercase tracking-wider">Branch / Type</span>
              <span className="text-slate-800">{bank.branchName} • {bank.accountType}</span>
            </div>

            {bank.upiId && (
              <div>
                <span className="text-xs text-muted font-medium block uppercase tracking-wider">UPI ID</span>
                <span className="font-mono text-emerald-700">{bank.upiId}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-color">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-emerald-600" />
            <h3 className="text-base font-bold text-slate-800">Line Items</h3>
          </div>
          <span className="text-xs text-muted">
            {invoice.lines?.length || 0} item(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 bg-slate-50 text-xs uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3">Description & Specifications</th>
                <th className="py-3 px-3 w-28">HSN/SAC</th>
                <th className="py-3 px-3 w-20 text-right">Qty</th>
                <th className="py-3 px-3 w-20">Unit</th>
                <th className="py-3 px-3 w-28 text-right">Rate</th>
                <th className="py-3 px-3 w-20 text-right">GST %</th>
                <th className="py-3 px-3 w-28 text-right">GST Amt</th>
                <th className="py-3 px-3 w-32 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.lines && invoice.lines.length > 0 ? (
                invoice.lines.map((item, idx) => {
                  const rate = item.unit_price / 100;
                  const taxAmt = (item.tax_amount || 0) / 100;
                  const lineTot = (item.line_total || item.taxable_value || 0) / 100;

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-medium">{item.sl_no || idx + 1}</td>
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {item.description}
                        {item.specification && (
                          <div className="text-xs text-slate-500 font-normal mt-0.5">{item.specification}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-600">{item.hsn_sac || '-'}</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-800">{item.quantity}</td>
                      <td className="py-3 px-3 text-slate-600">{item.unit || 'Nos'}</td>
                      <td className="py-3 px-3 text-right text-slate-800">{formatCurrency(rate)}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{item.tax_rate || 0}%</td>
                      <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(taxAmt)}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">{formatCurrency(lineTot)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    No line items found on this invoice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Breakdown Totals */}
        <div className="flex flex-col md:flex-row justify-between items-start mt-6 pt-4 border-t border-slate-200 gap-6">
          <div className="max-w-md text-xs text-slate-500">
            {invoice.notes && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700 block mb-1">Notes & Instructions:</span>
                <p className="whitespace-pre-line text-slate-600">{formatNotesToPlainText(invoice.notes)}</p>
              </div>
            )}
          </div>

          <div className="w-full md:w-80 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Value:</span>
              <span className="font-medium text-slate-900">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Total GST:</span>
              <span className="font-medium text-slate-900">{formatCurrency(totalTax)}</span>
            </div>

            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Grand Total:</span>
              <span className="text-emerald-700">{formatCurrency(total)}</span>
            </div>

            <div className="flex justify-between text-sm font-semibold text-emerald-700">
              <span>Amount Paid:</span>
              <span>- {formatCurrency(paid)}</span>
            </div>

            <div className={`flex justify-between text-base font-bold pt-2 border-t border-slate-200 ${balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              <span>Balance Due:</span>
              <span>{formatCurrency(balance)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment History Section */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-color">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-emerald-600" />
            <h3 className="text-base font-bold text-slate-800">Recorded Payments</h3>
          </div>
          {balance > 0 && (
            <Button 
              variant="secondary" 
              className="text-xs"
              onClick={() => navigate(`/payments/new?invoiceId=${invoice.id}`)}
            >
              + Record Payment
            </Button>
          )}
        </div>

        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 bg-slate-50 text-xs uppercase tracking-wider">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Reference</th>
                  <th className="py-2 px-3">Payment Method</th>
                  <th className="py-2 px-3">Transaction ID</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 text-slate-700">{formatDate(p.payment_date)}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{p.reference}</td>
                    <td className="py-2 px-3 text-slate-600">{p.payment_method}</td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-600">{p.transaction_id || '-'}</td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-600">{formatCurrency(p.amount / 100)}</td>
                    <td className="py-2 px-3 text-right">
                      <Button 
                        variant="secondary" 
                        className="text-xs py-1 px-2.5"
                        onClick={() => navigate(`/payments/${p.id}`)}
                      >
                        View Receipt
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400">
            <p className="text-sm">No payments recorded for this invoice yet.</p>
            {balance > 0 && (
              <Button 
                variant="primary" 
                className="mt-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => navigate(`/payments/new?invoiceId=${invoice.id}`)}
              >
                + Record First Payment
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}


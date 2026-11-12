import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { formatCurrency } from '../../utils/formatters';
import type { CreatePaymentDto, Invoice } from '@shared/types/finance.types';
import { Landmark } from 'lucide-react';
import { 
  getBankAccounts, 
  getInvoiceBankAccountId, 
  BankAccount 
} from '../../utils/bankAccountStorage';

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function PaymentForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryInvoiceId = searchParams.get('invoiceId');
  const queryProjectId = searchParams.get('projectId');
  const queryCustomerId = searchParams.get('customerId');
  const { showAlert } = useAlert();

  // Allow pre-filling invoice from navigation state or query param
  const prefillInvoiceId = queryInvoiceId ? Number(queryInvoiceId) : (location.state as any)?.invoiceId;

  const [formData, setFormData] = useState<Partial<CreatePaymentDto>>({
    invoice_id: prefillInvoiceId || 0,
    amount: 0,
    payment_date: getTodayStr(),
    payment_method: 'Bank Transfer',
    transaction_id: '',
    notes: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Bank Accounts for depositing
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedDepositBankId, setSelectedDepositBankId] = useState<string>('');

  useEffect(() => {
    loadDependencies();
  }, []);

  const loadDependencies = async () => {
    try {
      const accounts = getBankAccounts();
      setBankAccounts(accounts);
      const initialBankId = prefillInvoiceId ? getInvoiceBankAccountId(prefillInvoiceId) : null;
      const def = (initialBankId && accounts.find(a => a.id === initialBankId)) ||
        accounts.find(a => a.isPrimary && a.status === 'Active') ||
        accounts[0];
      if (def) setSelectedDepositBankId(def.id);

      const res = await window.desktop.invoices.list();
      if (res.success) {
        // Only show invoices that aren't fully paid
        const pendingInvoices = res.data.filter(i => i.status !== 'Paid');
        setInvoices(pendingInvoices);
        
        let targetInv: Invoice | undefined = undefined;
        if (prefillInvoiceId) {
          targetInv = res.data.find(x => x.id === prefillInvoiceId);
        } else if (queryProjectId) {
          targetInv = pendingInvoices.find(x => x.project_id === Number(queryProjectId));
        } else if (queryCustomerId) {
          targetInv = pendingInvoices.find(x => x.customer_id === Number(queryCustomerId));
        }

        if (targetInv) {
          setSelectedInvoice(targetInv);
          const balance = (targetInv.total_amount - (targetInv.amount_paid || 0)) / 100;
          setFormData(prev => ({ ...prev, invoice_id: targetInv.id, amount: balance }));
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const [fieldErrors, setFieldErrors] = useState<{
    invoice_id?: string;
    amount?: string;
    payment_date?: string;
    payment_method?: string;
    transaction_id?: string;
  }>({});

  const validateForm = (): boolean => {
    const errs: typeof fieldErrors = {};

    if (!formData.invoice_id || formData.invoice_id <= 0) {
      errs.invoice_id = 'Please select a pending invoice.';
    }

    if (formData.amount === undefined || formData.amount === null || isNaN(formData.amount) || formData.amount <= 0) {
      errs.amount = 'Amount received must be greater than zero (0 is not allowed).';
    } else if (selectedInvoice) {
      const remainingBalance = (selectedInvoice.total_amount - selectedInvoice.amount_paid) / 100;
      if (formData.amount > remainingBalance + 0.01) {
        errs.amount = `Amount cannot exceed remaining balance (${formatCurrency(remainingBalance)}).`;
      }
    }

    const minPaymentDate = selectedInvoice?.issue_date ? selectedInvoice.issue_date.split('T')[0] : '2020-01-01';
    if (!formData.payment_date) {
      errs.payment_date = 'Payment date is required.';
    } else if (formData.payment_date < minPaymentDate) {
      errs.payment_date = `Payment date cannot be earlier than invoice issue date (${minPaymentDate}).`;
    }

    if (!formData.payment_method?.trim()) {
      errs.payment_method = 'Please select a payment method.';
    }

    if (formData.transaction_id?.trim() && formData.transaction_id.trim().length < 3) {
      errs.transaction_id = 'Transaction ID / Cheque No. must be at least 3 characters.';
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleInvoiceChange = (e: any) => {
    const invId = Number(e.target.value);
    const inv = invoices.find(i => i.id === invId);
    setSelectedInvoice(inv || null);
    if (fieldErrors.invoice_id) setFieldErrors(p => ({ ...p, invoice_id: undefined }));
    
    if (inv) {
      const balance = (inv.total_amount - inv.amount_paid) / 100;
      setFormData(prev => ({ ...prev, invoice_id: invId, amount: balance }));
      if (fieldErrors.amount) setFieldErrors(p => ({ ...p, amount: undefined }));

      const invBankId = getInvoiceBankAccountId(inv.id);
      if (invBankId) {
        setSelectedDepositBankId(invBankId);
      }
    }
  };

  const handleWheelPrevent = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLElement).blur();
  };

  const handleNonNegativeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleNonNegativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData?.getData('text') || '';
    if (paste.includes('-') || paste.includes('+')) {
      e.preventDefault();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      const parsed = value ? parseFloat(value) : undefined;
      setFormData(prev => ({ ...prev, [name]: parsed !== undefined ? Math.max(0, parsed) : undefined }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors(p => ({ ...p, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      const msg = 'Please fill in all mandatory fields (Invoice, Amount, Payment Date, and Payment Method) correctly.';
      setError(msg);
      await showAlert({
        type: 'error',
        title: 'Missing Required Information',
        description: 'Please complete all required fields (Apply to Invoice, Amount Received, Payment Date, and Payment Method) before recording the payment.',
      });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const isBankTransfer = formData.payment_method === 'Bank Transfer';
      const chosenBank = isBankTransfer ? bankAccounts.find(a => a.id === selectedDepositBankId) : null;
      const bankNote = chosenBank ? `[Deposited to: ${chosenBank.bankName} - A/C ${chosenBank.accountNumber}]` : '';
      const combinedNotes = formData.notes 
        ? (bankNote ? `${formData.notes}\n${bankNote}` : formData.notes) 
        : bankNote;

      const payload = {
        ...formData,
        notes: combinedNotes.trim() || undefined,
        amount: Math.round((formData.amount || 0) * 100)
      };

      const res = await window.desktop.payments.create(payload as CreatePaymentDto);

      if (res.success) {
        navigate('/payments');
      } else {
        setError(res.error?.message || 'Failed to save');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <PageHeader 
        title="Log Payment" 
        breadcrumbs={[{ label: 'Payments', to: '/payments' }, { label: 'New' }]}
      />

      <Card>
        {error && <Alert type="error" message={error} className="mb-4" />}
        
        {selectedInvoice && (() => {
          const invTotal = selectedInvoice.total_amount / 100;
          const alreadyPaid = (selectedInvoice.amount_paid || 0) / 100;
          const currentBalance = Math.max(0, invTotal - alreadyPaid);
          const payAmount = Number(formData.amount) || 0;
          const remainingAfter = Math.max(0, currentBalance - payAmount);
          const willBePaid = payAmount >= currentBalance && payAmount > 0;

          return (
            <div className="mb-4 p-4 rounded-lg bg-secondary-bg border border-border-color">
              <div className="flex justify-between items-start mb-3 pb-3 border-b border-border-color">
                <div>
                  <div className="text-xs uppercase text-secondary font-semibold">Selected Invoice</div>
                  <div className="font-bold text-base">{selectedInvoice.reference} - {selectedInvoice.customer_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase text-secondary font-semibold mb-1">Current Status</div>
                  <Badge variant={selectedInvoice.status === 'Paid' ? 'success' : 'warning'}>
                    {selectedInvoice.status}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-secondary text-xs block">Invoice Total</span>
                  <span className="font-semibold text-text-color">{formatCurrency(invTotal)}</span>
                </div>
                <div>
                  <span className="text-secondary text-xs block">Already Paid</span>
                  <span className="font-semibold text-success-color">{formatCurrency(alreadyPaid)}</span>
                </div>
                <div>
                  <span className="text-secondary text-xs block">Current Due</span>
                  <span className="font-bold text-danger">{formatCurrency(currentBalance)}</span>
                </div>
                <div>
                  <span className="text-secondary text-xs block mb-0.5">Due After Payment</span>
                  <div className="flex items-center" style={{ gap: '10px' }}>
                    <span className={`font-bold ${remainingAfter > 0 ? 'text-amber-500' : 'text-success-color'}`}>
                      {formatCurrency(remainingAfter)}
                    </span>
                    {payAmount > 0 && (
                      <span
                        className={`text-xs px-2 py-0.5 font-semibold ${
                          willBePaid
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                        style={{ borderRadius: '10px', display: 'inline-flex', alignItems: 'center', lineHeight: '1.2' }}
                      >
                        {willBePaid ? 'Paid' : 'Partial'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold">
              Apply to Invoice <span className="text-danger">*</span>
            </label>
            <select 
              name="invoice_id" 
              value={formData.invoice_id || 0} 
              onChange={handleInvoiceChange} 
              className={`input-field ${fieldErrors.invoice_id ? 'input-error' : ''}`} 
              required
            >
              <option value={0} disabled>
                {invoices.length === 0 ? "No pending invoices found. Create an invoice first." : "Select pending invoice..."}
              </option>
              {invoices.map(i => {
                const tot = i.total_amount / 100;
                const bal = (i.total_amount - (i.amount_paid || 0)) / 100;
                const projInfo = i.project_reference ? ` [${i.project_reference}]` : '';
                const quoteInfo = i.quotation_reference ? ` (Quote: ${i.quotation_reference})` : '';
                return (
                  <option key={i.id} value={i.id}>
                    {i.reference} - {i.customer_name}{projInfo}{quoteInfo} (Total: {formatCurrency(tot)} | Due: {formatCurrency(bal)})
                  </option>
                );
              })}
            </select>
            {invoices.length === 0 && (
              <div className="mt-1 text-sm text-warning font-medium flex items-center gap-1">
                <span>⚠️</span> You don't have any pending invoices. Please create and issue an invoice before recording a payment.
              </div>
            )}
            {fieldErrors.invoice_id && <span className="form-error">{fieldErrors.invoice_id}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Amount Received (₹) <span className="text-danger">*</span>
              </label>
              <input 
                type="number" 
                step="0.01" 
                min="0.01"
                placeholder="0.00"
                name="amount" 
                value={formData.amount !== undefined && formData.amount !== null && formData.amount !== 0 ? formData.amount : (formData.amount === 0 ? 0 : '')} 
                onChange={handleChange} 
                onWheel={handleWheelPrevent}
                onKeyDown={handleNonNegativeKeyDown}
                onPaste={handleNonNegativePaste}
                className={`input-field ${fieldErrors.amount ? 'input-error' : ''}`} 
                required 
              />
              {fieldErrors.amount && <span className="form-error">{fieldErrors.amount}</span>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Payment Date <span className="text-danger">*</span>
              </label>
              <input 
                type="date" 
                name="payment_date" 
                value={formData.payment_date || ''} 
                onChange={handleChange} 
                min={selectedInvoice?.issue_date ? selectedInvoice.issue_date.split('T')[0] : undefined}
                className={`input-field ${fieldErrors.payment_date ? 'input-error' : ''}`} 
                required 
              />
              {fieldErrors.payment_date && <span className="form-error">{fieldErrors.payment_date}</span>}
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                📅 {selectedInvoice?.issue_date ? `Allows invoice date (${selectedInvoice.issue_date.split('T')[0]}) or later.` : 'Select payment date.'}
              </span>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${formData.payment_method === 'Bank Transfer' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 border-t border-border-color pt-4 mt-2`}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Payment Method <span className="text-danger">*</span>
              </label>
              <select 
                name="payment_method" 
                value={formData.payment_method} 
                onChange={handleChange} 
                className={`input-field ${fieldErrors.payment_method ? 'input-error' : ''}`} 
                required
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
              {fieldErrors.payment_method && <span className="form-error">{fieldErrors.payment_method}</span>}
            </div>

            {formData.payment_method === 'Bank Transfer' && (
              <div className="flex flex-col gap-1 animate-fade-in">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Landmark size={15} style={{ color: 'var(--primary-color)' }} />
                  <span>Deposited into Account</span>
                </label>
                <select
                  value={selectedDepositBankId}
                  onChange={(e) => setSelectedDepositBankId(e.target.value)}
                  className="input-field"
                >
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} (•••• {acc.accountNumber.slice(-4)}) {acc.isPrimary ? '★ Primary' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold">
                Transaction ID / Cheque No. <span className="text-muted text-xs font-normal">(Optional)</span>
              </label>
              <input 
                type="text" 
                name="transaction_id" 
                value={formData.transaction_id || ''} 
                onChange={handleChange} 
                className={`input-field ${fieldErrors.transaction_id ? 'input-error' : ''}`} 
                placeholder={
                  formData.payment_method === 'Cash' 
                    ? 'e.g. CASH / Receipt No.' 
                    : formData.payment_method === 'Cheque'
                    ? 'e.g. CHQ123456'
                    : 'e.g. TXN987654321 / UTR'
                }
              />
              {fieldErrors.transaction_id && <span className="form-error">{fieldErrors.transaction_id}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold">
              Internal Notes <span className="text-muted text-xs font-normal">(Optional)</span>
            </label>
            <textarea 
              name="notes" 
              value={formData.notes || ''} 
              onChange={handleChange} 
              className="input-field min-h-[80px]"
              placeholder="Add any additional remarks or notes regarding this payment..."
            />
          </div>

          <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t flex-wrap">
            <Button variant="secondary" type="button" onClick={() => navigate('/payments')}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

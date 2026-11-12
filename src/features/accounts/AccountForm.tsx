import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/alert';
import { useAlert } from '../../context/AlertContext';
import { 
  BankAccount, 
  getBankAccounts, 
  saveBankAccounts 
} from '../../utils/bankAccountStorage';
import { Landmark, Check, Trash2 } from 'lucide-react';

const POPULAR_BANKS = [
  'Canara Bank',
  'State Bank of India (SBI)',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Punjab National Bank (PNB)',
  'Bank of Baroda',
  'Kotak Mahindra Bank',
  'Indian Bank',
  'Union Bank of India'
];

export default function AccountForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useAlert();
  const isEditing = Boolean(id);

  const [accounts, setAccounts] = useState<BankAccount[]>(() => getBankAccounts());
  const [formData, setFormData] = useState({
    accountName: 'To-Gen Solar Agro Private Limited',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    branchName: '',
    accountType: 'Current' as BankAccount['accountType'],
    upiId: '',
    currentBalance: '0',
    isPrimary: false,
    status: 'Active' as BankAccount['status'],
    notes: ''
  });

  const [originalData, setOriginalData] = useState<typeof formData | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const allAccounts = getBankAccounts();
    setAccounts(allAccounts);

    if (isEditing && id) {
      const found = allAccounts.find(a => a.id === id);
      if (found) {
        const loaded = {
          accountName: found.accountName,
          bankName: found.bankName,
          accountNumber: found.accountNumber,
          confirmAccountNumber: found.accountNumber,
          ifscCode: found.ifscCode,
          branchName: found.branchName,
          accountType: found.accountType,
          upiId: found.upiId || '',
          currentBalance: String(found.currentBalance || 0),
          isPrimary: found.isPrimary,
          status: found.status,
          notes: found.notes || ''
        };
        setFormData(loaded);
        setOriginalData(loaded);
      } else {
        setError('Bank account not found.');
      }
      setLoading(false);
    } else {
      // For new account, if no accounts exist, set isPrimary to true
      if (allAccounts.length === 0) {
        setFormData(p => ({ ...p, isPrimary: true }));
      }
      setLoading(false);
    }
  }, [id, isEditing]);

  const hasFormChanges = useMemo(() => {
    if (!isEditing) {
      return Boolean(
        formData.bankName.trim() || 
        formData.accountNumber.trim() || 
        formData.branchName.trim() || 
        formData.ifscCode.trim()
      );
    }
    if (!originalData) return false;

    return (
      formData.accountName.trim() !== originalData.accountName.trim() ||
      formData.bankName.trim() !== originalData.bankName.trim() ||
      formData.accountNumber.trim() !== originalData.accountNumber.trim() ||
      formData.ifscCode.trim().toUpperCase() !== originalData.ifscCode.trim().toUpperCase() ||
      formData.branchName.trim() !== originalData.branchName.trim() ||
      formData.accountType !== originalData.accountType ||
      formData.upiId.trim() !== originalData.upiId.trim() ||
      formData.currentBalance.trim() !== originalData.currentBalance.trim() ||
      formData.isPrimary !== originalData.isPrimary ||
      formData.status !== originalData.status ||
      formData.notes.trim() !== originalData.notes.trim()
    );
  }, [formData, originalData, isEditing]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.bankName.trim()) {
      errors.bankName = 'Bank name is required.';
    }

    if (!formData.branchName.trim()) {
      errors.branchName = 'Branch location is required.';
    }

    if (!formData.accountName.trim()) {
      errors.accountName = 'Beneficiary / Account holder name is required.';
    }

    const cleanAccNumber = formData.accountNumber.replace(/\s+/g, '');
    if (!cleanAccNumber) {
      errors.accountNumber = 'Account number is required.';
    } else if (!/^\d{9,18}$/.test(cleanAccNumber)) {
      errors.accountNumber = 'Account number must be 9 to 18 digits.';
    }

    if (!isEditing) {
      const cleanConfirm = formData.confirmAccountNumber.replace(/\s+/g, '');
      if (!cleanConfirm) {
        errors.confirmAccountNumber = 'Please re-enter account number.';
      } else if (cleanAccNumber !== cleanConfirm) {
        errors.confirmAccountNumber = 'Account numbers do not match.';
      }
    }

    const cleanIfsc = formData.ifscCode.toUpperCase().trim();
    if (!cleanIfsc) {
      errors.ifscCode = 'IFSC code is required.';
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      errors.ifscCode = 'Invalid IFSC format. Example: SBIN0001234 (4 letters, 0, then 6 alphanumeric).';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      await showAlert({
        type: 'error',
        title: 'Validation Error',
        description: 'Please correct the highlighted fields before saving.',
      });
      return;
    }

    const actionText = isEditing ? 'Update Bank Account' : 'Register Bank Account';
    const confirmed = await showConfirm({
      type: 'confirmation',
      title: actionText,
      description: `Are you sure you want to save the details for "${formData.bankName} (${formData.accountNumber.slice(-4)})"?`,
      confirmLabel: isEditing ? 'Update Account' : 'Save Account',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    setSaving(true);
    try {
      const cleanAccNumber = formData.accountNumber.replace(/\s+/g, '');
      const cleanIfsc = formData.ifscCode.toUpperCase().trim();
      const balanceNum = parseFloat(formData.currentBalance) || 0;

      let updatedAccounts: BankAccount[] = [];

      if (isEditing && id) {
        updatedAccounts = accounts.map(a => {
          if (a.id === id) {
            return {
              ...a,
              accountName: formData.accountName.trim(),
              bankName: formData.bankName.trim(),
              accountNumber: cleanAccNumber,
              ifscCode: cleanIfsc,
              branchName: formData.branchName.trim(),
              accountType: formData.accountType,
              upiId: formData.upiId.trim() || undefined,
              currentBalance: balanceNum,
              isPrimary: formData.isPrimary,
              status: formData.status,
              notes: formData.notes.trim() || undefined
            };
          }
          if (formData.isPrimary) {
            return { ...a, isPrimary: false };
          }
          return a;
        });
      } else {
        const newAccount: BankAccount = {
          id: `acc-${Date.now()}`,
          accountName: formData.accountName.trim(),
          bankName: formData.bankName.trim(),
          accountNumber: cleanAccNumber,
          ifscCode: cleanIfsc,
          branchName: formData.branchName.trim(),
          accountType: formData.accountType,
          upiId: formData.upiId.trim() || undefined,
          currentBalance: balanceNum,
          isPrimary: formData.isPrimary,
          status: formData.status,
          notes: formData.notes.trim() || undefined,
          createdAt: new Date().toISOString().split('T')[0]
        };

        if (formData.isPrimary) {
          updatedAccounts = accounts.map(a => ({ ...a, isPrimary: false }));
          updatedAccounts.unshift(newAccount);
        } else {
          updatedAccounts = [newAccount, ...accounts];
        }
      }

      saveBankAccounts(updatedAccounts);

      await showAlert({
        type: 'success',
        title: isEditing ? 'Account Updated' : 'Account Registered',
        description: `Bank account "${formData.bankName}" has been successfully saved.`,
      });

      navigate('/accounts');
    } catch (err: any) {
      setError(err?.message || 'Failed to save bank account');
      await showAlert({
        type: 'error',
        title: 'Save Failed',
        description: err?.message || 'Failed to save bank account',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !id) return;
    const currentAccount = accounts.find(a => a.id === id);
    if (!currentAccount) return;

    if (currentAccount.isPrimary && accounts.length > 1) {
      await showAlert({
        type: 'warning',
        title: 'Primary Account Protected',
        description: 'You cannot delete the primary bank account. Please assign another account as primary first.',
      });
      return;
    }

    const confirmed = await showConfirm({
      type: 'confirmation',
      title: 'Delete Bank Account',
      description: `Are you sure you want to delete "${currentAccount.bankName}" (A/C ending with ${currentAccount.accountNumber.slice(-4)})? This action cannot be undone.`,
      confirmLabel: 'Delete Account',
      cancelLabel: 'Cancel',
      isDestructive: true,
    });

    if (!confirmed) return;

    try {
      const remaining = accounts.filter(a => a.id !== id);
      saveBankAccounts(remaining);
      await showAlert({
        type: 'success',
        title: 'Account Deleted',
        description: `Bank account "${currentAccount.bankName}" was successfully removed.`,
      });
      navigate('/accounts');
    } catch (err: any) {
      await showAlert({
        type: 'error',
        title: 'Delete Failed',
        description: err?.message || 'Failed to delete account.',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <span>Loading account details...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto pb-12">
      <PageHeader 
        title={isEditing ? 'Edit Bank Account' : 'Register New Bank Account'} 
        description="Fill in official bank account details for billing and customer receipts."
        breadcrumbs={[
          { label: 'Accounts', to: '/accounts' },
          { label: isEditing ? 'Edit' : 'New Account' }
        ]}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/accounts')} disabled={saving}>
              Cancel
            </Button>
            {isEditing && (
              <Button variant="danger" onClick={handleDelete} disabled={saving}>
                <Trash2 size={15} style={{ marginRight: '6px' }} />
                Delete
              </Button>
            )}
            <Button 
              variant="primary" 
              onClick={handleSubmit} 
              isLoading={saving}
              disabled={saving || !hasFormChanges}
              title={!hasFormChanges ? 'Make changes to save' : undefined}
            >
              <Check size={16} style={{ marginRight: '6px' }} />
              {isEditing ? 'Update Account' : 'Save Bank Account'}
            </Button>
          </div>
        }
      />

      <Card className="mt-6">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && <Alert type="error" message={error} />}

          {/* Quick Select Preset Banks */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Quick Select Bank:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {POPULAR_BANKS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, bankName: b }));
                    if (fieldErrors.bankName) {
                      setFieldErrors(prev => ({ ...prev, bankName: '' }));
                    }
                  }}
                  style={{
                    fontSize: '0.775rem',
                    fontWeight: 500,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: formData.bankName === b ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    backgroundColor: formData.bankName === b ? 'var(--accent-blue-light)' : 'var(--bg-surface)',
                    color: formData.bankName === b ? 'var(--accent-blue-text)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Section 1: Bank & Branch Information */}
          <div className="form-section">
            <h3 className="text-base font-semibold mb-4 pb-2 border-b flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Landmark size={18} style={{ color: 'var(--accent-blue)' }} />
              <span>Bank & Branch Details</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <Input 
                label="Bank Name" 
                required 
                value={formData.bankName} 
                error={fieldErrors.bankName}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({ ...formData, bankName: val });
                  if (fieldErrors.bankName && val.trim()) {
                    setFieldErrors(p => ({ ...p, bankName: '' }));
                  }
                }}
                placeholder="e.g. State Bank of India (SBI)"
              />

              <Input 
                label="Branch Location" 
                required 
                value={formData.branchName} 
                error={fieldErrors.branchName}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({ ...formData, branchName: val });
                  if (fieldErrors.branchName && val.trim()) {
                    setFieldErrors(p => ({ ...p, branchName: '' }));
                  }
                }}
                placeholder="e.g. Gandhipuram, Coimbatore"
              />
            </div>
          </div>

          {/* Section 2: Account Holder & Type */}
          <div className="form-section">
            <h3 className="text-base font-semibold mb-4 pb-2 border-b" style={{ color: 'var(--text-primary)' }}>
              Account Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <Input 
                label="Account Holder Name" 
                required 
                value={formData.accountName} 
                error={fieldErrors.accountName}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({ ...formData, accountName: val });
                  if (fieldErrors.accountName && val.trim()) {
                    setFieldErrors(p => ({ ...p, accountName: '' }));
                  }
                }}
                placeholder="e.g. To-Gen Solar Agro Private Limited"
              />

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Account Type <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <select 
                  className="input-field"
                  value={formData.accountType} 
                  onChange={e => setFormData({ ...formData, accountType: e.target.value as any })}
                >
                  <option value="Current">Current Account</option>
                  <option value="Savings">Savings Account</option>
                  <option value="Overdraft">Overdraft (OD)</option>
                  <option value="Cash Credit">Cash Credit (CC)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Account Number & Verification */}
          <div className="form-section">
            <h3 className="text-base font-semibold mb-4 pb-2 border-b" style={{ color: 'var(--text-primary)' }}>
              Account Number
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <Input 
                label="Account Number" 
                required 
                type="text"
                inputMode="numeric"
                maxLength={18}
                value={formData.accountNumber} 
                error={fieldErrors.accountNumber}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                  setFormData({ ...formData, accountNumber: val });
                  if (fieldErrors.accountNumber && val.length >= 9) {
                    setFieldErrors(p => ({ ...p, accountNumber: '' }));
                  }
                }}
                placeholder="Enter 9-18 digit account number"
              />

              {!isEditing && (
                <Input 
                  label="Re-Enter Account Number" 
                  required 
                  type="text"
                  inputMode="numeric"
                  maxLength={18}
                  value={formData.confirmAccountNumber} 
                  error={fieldErrors.confirmAccountNumber}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                    setFormData({ ...formData, confirmAccountNumber: val });
                    if (fieldErrors.confirmAccountNumber && val === formData.accountNumber) {
                      setFieldErrors(p => ({ ...p, confirmAccountNumber: '' }));
                    }
                  }}
                  placeholder="Re-enter to verify"
                />
              )}
            </div>
          </div>

          {/* Section 4: IFSC & Digital Payments */}
          <div className="form-section">
            <h3 className="text-base font-semibold mb-4 pb-2 border-b" style={{ color: 'var(--text-primary)' }}>
              Codes & Digital Payments
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <Input 
                label="IFSC Code" 
                required 
                maxLength={11}
                value={formData.ifscCode} 
                error={fieldErrors.ifscCode}
                onChange={e => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                  setFormData({ ...formData, ifscCode: val });
                  if (fieldErrors.ifscCode && val.length === 11) {
                    setFieldErrors(p => ({ ...p, ifscCode: '' }));
                  }
                }}
                placeholder="e.g. SBIN0001234"
              />

              <Input 
                label="UPI ID / VPA (Optional)" 
                value={formData.upiId} 
                onChange={e => setFormData({ ...formData, upiId: e.target.value.trim() })}
                placeholder="e.g. togensolar@sbi"
              />
            </div>
          </div>

          {/* Section 5: Status & Primary Setting */}
          <div className="form-section">
            <h3 className="text-base font-semibold mb-4 pb-2 border-b" style={{ color: 'var(--text-primary)' }}>
              Account Settings & Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <Input 
                label="Current Ledger Balance (₹)" 
                type="number"
                value={formData.currentBalance} 
                onChange={e => setFormData({ ...formData, currentBalance: e.target.value })}
                placeholder="0.00"
              />

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Account Status
                </label>
                <select 
                  className="input-field"
                  value={formData.status} 
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                >
                  <option value="Active">Active (Available for billing)</option>
                  <option value="Inactive">Inactive (Archived)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '1rem', padding: '12px 16px', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: '8px', border: '1px solid var(--border-color-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                <input 
                  type="checkbox"
                  checked={formData.isPrimary}
                  onChange={e => setFormData({ ...formData, isPrimary: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)' }}
                />
                <div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                    Set as Default Primary Account
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Automatically selected as default bank details on formal Quotations and Invoices.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section 6: Internal Notes */}
          <div className="form-section">
            <h3 className="text-base font-semibold mb-4 pb-2 border-b" style={{ color: 'var(--text-primary)' }}>
              Internal Usage Notes
            </h3>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Remarks / Collection Purpose (Optional)
              </label>
              <textarea 
                rows={3} 
                className="input-field"
                value={formData.notes} 
                onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                placeholder="e.g. Dedicated for solar rooftop client NEFT payments and vendor payouts..."
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex justify-between items-center pt-4 border-t flex-wrap gap-3" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div>
              {isEditing && (
                <Button 
                  type="button" 
                  variant="danger" 
                  onClick={handleDelete}
                  disabled={saving}
                >
                  <Trash2 size={15} style={{ marginRight: '6px' }} />
                  Delete Account
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate('/accounts')} disabled={saving}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                isLoading={saving}
                disabled={saving || !hasFormChanges}
              >
                <Check size={16} style={{ marginRight: '6px' }} />
                {isEditing ? 'Update Account' : 'Save Bank Account'}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

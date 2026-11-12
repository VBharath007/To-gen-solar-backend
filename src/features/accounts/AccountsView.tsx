import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Plus, 
  Search, 
  Copy, 
  Check, 
  CheckCircle2, 
  Edit2, 
  Trash2, 
  Star, 
  X,
  Landmark,
  CheckCheck,
  AlertTriangle
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAlert } from '../../context/AlertContext';

import { 
  BankAccount, 
  getBankAccounts,
  saveBankAccounts 
} from '../../utils/bankAccountStorage';

export { type BankAccount };

export default function AccountsView() {
  const navigate = useNavigate();
  const location = useLocation();

  const [accounts, setAccounts] = useState<BankAccount[]>(() => getBankAccounts());
  const { showConfirm } = useAlert();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Modals

  const [primaryWarningAccount, setPrimaryWarningAccount] = useState<BankAccount | null>(null);

  // React Lucide Result Popup Modal (for Delete success)
  const [lucideResultPopup, setLucideResultPopup] = useState<{
    isOpen: boolean;
    type: 'updated' | 'deleted' | 'created';
    title: string;
    message: string;
    bankName: string;
    last4: string;
  } | null>(null);

  // Persist accounts
  useEffect(() => {
    saveBankAccounts(accounts);
  }, [accounts]);

  // Reload bank accounts whenever location changes (e.g. returning from AccountForm)
  useEffect(() => {
    setAccounts(getBankAccounts());
  }, [location]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        acc.bankName.toLowerCase().includes(q) ||
        acc.accountName.toLowerCase().includes(q) ||
        acc.accountNumber.includes(q) ||
        acc.ifscCode.toLowerCase().includes(q) ||
        acc.branchName.toLowerCase().includes(q) ||
        (acc.upiId && acc.upiId.toLowerCase().includes(q));

      const matchesType = typeFilter === 'all' || acc.accountType === typeFilter;
      const matchesStatus = statusFilter === 'all' || acc.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [accounts, searchTerm, typeFilter, statusFilter]);

  const primaryAccount = useMemo(() => {
    return accounts.find(a => a.isPrimary) || accounts[0];
  }, [accounts]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy full customer payment details
  const copyFormattedCustomerDetails = (acc: BankAccount) => {
    const text = `*BANK ACCOUNT DETAILS - TO-GEN SOLAR AGRO*\n` +
      `----------------------------------------\n` +
      `Beneficiary Name: ${acc.accountName}\n` +
      `Bank: ${acc.bankName}\n` +
      `Account Number: ${acc.accountNumber}\n` +
      `IFSC Code: ${acc.ifscCode}\n` +
      `Branch: ${acc.branchName}\n` +
      `Account Type: ${acc.accountType}\n` +
      (acc.upiId ? `UPI ID / VPA: ${acc.upiId}\n` : '') +
      `----------------------------------------\n` +
      `Please send transaction receipt / UTR number after payment confirmation.`;

    navigator.clipboard.writeText(text);
    setCopiedId(`share-${acc.id}`);
    showToast(`Bank details copied for ${acc.bankName}! Ready to paste in WhatsApp/Email.`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Set Primary Account
  const handleSetPrimary = (accId: string) => {
    setAccounts(prev => 
      prev.map(a => ({
        ...a,
        isPrimary: a.id === accId
      }))
    );
    const target = accounts.find(a => a.id === accId);
    showToast(`Default primary account updated to ${target?.bankName || 'selected account'}.`);
  };

  // Delete Account Request Handlers
  const handleRequestDelete = async (acc: BankAccount) => {
    if (acc.isPrimary && accounts.length > 1) {
      setPrimaryWarningAccount(acc);
      return;
    }
    
    const confirmed = await showConfirm({
      type: 'confirmation',
      isDestructive: true,
      title: 'Delete Account',
      description: `Are you sure you want to delete the bank account "${acc.bankName}"? This action cannot be undone. All future customer invoice allocations to this account will be removed.`,
      confirmLabel: 'Delete Account',
      cancelLabel: 'Cancel',
    });

    if (confirmed) {
      executeDeleteAccount(acc);
    }
  };

  const executeDeleteAccount = (acc: BankAccount) => {
    setAccounts(prev => prev.filter(a => a.id !== acc.id));

    setLucideResultPopup({
      isOpen: true,
      type: 'deleted',
      title: 'Account Deleted',
      message: `The bank account "${acc.bankName}" has been successfully deleted from your records.`,
      bankName: acc.bankName,
      last4: acc.accountNumber.slice(-4)
    });
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#0b2546',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.875rem',
            fontWeight: 500,
            zIndex: 10000,
            borderLeft: '4px solid var(--primary-color)'
          }}
        >
          <CheckCircle2 size={18} style={{ color: '#98d633', flexShrink: 0 }} />
          <span>{toastMessage}</span>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)} 
            style={{ color: '#cbd5e1', marginLeft: '8px', cursor: 'pointer' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Bank Accounts"
        description="Manage company bank accounts, UPI identifiers, and payment collection credentials for customer invoices and quotations."
        action={
          <Button 
            variant="primary" 
            onClick={() => navigate('/accounts/new')}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Add Bank Account</span>
          </Button>
        }
      />

      {/* Top Metrics Cards Row */}
      <div className="kpi-grid kpi-grid-2">
        {/* Metric 1 */}
        <div className="kpi-card">
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: '#e1f0fa',
              color: '#0b75b9',
            }}
          >
            <Landmark />
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">Total Accounts</div>
            <div className="kpi-card-value" style={{ color: '#0b75b9' }}>{accounts.length}</div>
            <div className="kpi-card-subtitle" style={{ display: 'flex', gap: '6px' }}>
              <span style={{ color: '#0b75b9', fontWeight: 600 }}>
                {accounts.filter(a => a.status === 'Active').length} Active
              </span>
              <span>•</span>
              <span>{accounts.filter(a => a.status === 'Inactive').length} Inactive</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="kpi-card">
          <div 
            className="kpi-card-icon"
            style={{
              backgroundColor: '#fef3c7',
              color: '#d97706',
            }}
          >
            <Star />
          </div>
          <div className="kpi-card-content">
            <div className="kpi-card-title">Primary Account</div>
            <div className="kpi-card-value" style={{ color: '#0f172a' }}>
              {primaryAccount ? primaryAccount.bankName : 'Not Configured'}
            </div>
            <div className="kpi-card-subtitle">
              {primaryAccount ? `A/C •••• ${primaryAccount.accountNumber.slice(-4)}` : 'Add an account to set as primary'}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar / Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#ffffff',
          padding: '12px 18px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '1.5rem'
        }}
      >
        {/* Left Search and Filters */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', flex: 1, minWidth: '300px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <span 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none'
              }}
            >
              <Search size={16} />
            </span>
            <input 
              type="text"
              placeholder="Search bank, IFSC, account no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: '0.875rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Account Type Filter */}
          <div style={{ width: '160px' }}>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '0.875rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)'
              }}
            >
              <option value="all">All Types</option>
              <option value="Current">Current</option>
              <option value="Savings">Savings</option>
              <option value="Overdraft">Overdraft (OD)</option>
              <option value="Cash Credit">Cash Credit (CC)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ width: '140px' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '0.875rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                color: 'var(--text-primary)'
              }}
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Section: Grid View or Table View */}
      {filteredAccounts.length === 0 ? (
        <Card style={{ padding: '3.5rem 2rem', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '12px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--text-muted)' }}>
            <Building2 size={28} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            No Bank Accounts Found
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 20px' }}>
            {searchTerm 
              ? 'No accounts match your current search query or filter selection.' 
              : 'Add your company bank accounts to manage payment collections and quotation banking info.'}
          </p>
          {searchTerm ? (
            <Button variant="outline" onClick={() => { setSearchTerm(''); setTypeFilter('all'); setStatusFilter('all'); }}>
              Clear Search & Filters
            </Button>
          ) : (
            <Button variant="primary" onClick={() => navigate('/accounts/new')}>
              <Plus size={15} /> Add First Account
            </Button>
          )}
        </Card>
      ) : (
        /* Grid Cards View */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.25rem'
          }}
        >
          {filteredAccounts.map((acc) => (
            <div
              key={acc.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                border: acc.isPrimary ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                boxShadow: acc.isPrimary ? '0 4px 16px rgba(11, 117, 185, 0.12)' : 'var(--shadow-sm)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              {/* Card Top / Header */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div 
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        backgroundColor: '#f0f7ff',
                        border: '1px solid #d0e4f7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-blue)',
                        flexShrink: 0
                      }}
                    >
                      <Building2 size={22} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>
                        {acc.bankName}
                      </h4>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {acc.branchName}
                      </div>
                    </div>
                  </div>

                  {/* Badges on Top Right */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {acc.isPrimary && (
                      <span 
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.675rem',
                          fontWeight: 700,
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          letterSpacing: '0.04em'
                        }}
                      >
                        <Star size={11} fill="#b45309" />
                        PRIMARY
                      </span>
                    )}
                    <Badge variant={acc.status === 'Active' ? 'success' : 'default'}>
                      {acc.status}
                    </Badge>
                  </div>
                </div>

                {/* Account Details Box */}
                <div 
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginBottom: '14px'
                  }}
                >
                  {/* Beneficiary Name */}
                  <div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Beneficiary / Account Holder
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {acc.accountName}
                    </div>
                  </div>

                  {/* Account Number & IFSC Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0' }}>
                    {/* Account Number */}
                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Account Number
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {acc.accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(acc.accountNumber, `acc-${acc.id}`)}
                          style={{
                            padding: '3px 6px',
                            borderRadius: '4px',
                            color: copiedId === `acc-${acc.id}` ? 'var(--primary-color)' : 'var(--text-muted)',
                            backgroundColor: copiedId === `acc-${acc.id}` ? '#dcfce7' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            fontSize: '0.7rem'
                          }}
                          title="Copy account number"
                        >
                          {copiedId === `acc-${acc.id}` ? <CheckCheck size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* IFSC Code */}
                    <div>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        IFSC Code
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, color: '#0b75b9' }}>
                          {acc.ifscCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(acc.ifscCode, `ifsc-${acc.id}`)}
                          style={{
                            padding: '3px 6px',
                            borderRadius: '4px',
                            color: copiedId === `ifsc-${acc.id}` ? 'var(--primary-color)' : 'var(--text-muted)',
                            backgroundColor: copiedId === `ifsc-${acc.id}` ? '#dcfce7' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            fontSize: '0.7rem'
                          }}
                          title="Copy IFSC code"
                        >
                          {copiedId === `ifsc-${acc.id}` ? <CheckCheck size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Account Type & UPI Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', fontSize: '0.775rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Type:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acc.accountType}</span>
                    </div>

                    {acc.upiId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>UPI:</span>
                        <span style={{ fontWeight: 600, color: '#0b75b9', fontFamily: 'monospace' }}>{acc.upiId}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(acc.upiId!, `upi-${acc.id}`)}
                          style={{ padding: '2px', color: 'var(--text-muted)', cursor: 'pointer' }}
                          title="Copy UPI ID"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.725rem' }}>No UPI linked</span>
                    )}
                  </div>
                </div>


                {/* Notes (if any) */}
                {acc.notes && (
                  <div 
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      backgroundColor: '#fafbfc',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      borderLeft: '3px solid #cbd5e1',
                      marginBottom: '12px',
                      fontStyle: 'italic'
                    }}
                  >
                    "{acc.notes}"
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div 
                style={{
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                {/* 1-Click Copy Details for Customer */}
                <Button
                  variant="outline"
                  onClick={() => copyFormattedCustomerDetails(acc)}
                  className="flex items-center gap-1.5"
                  style={{
                    fontSize: '0.775rem',
                    padding: '6px 12px',
                    borderColor: '#bfdbfe',
                    color: '#0b75b9',
                    backgroundColor: copiedId === `share-${acc.id}` ? '#ecfdf5' : '#ffffff'
                  }}
                  title="Copy full banking details to send to customer"
                >
                  {copiedId === `share-${acc.id}` ? (
                    <>
                      <Check size={14} style={{ color: 'var(--primary-color)' }} />
                      <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Details</span>
                    </>
                  )}
                </Button>

                {/* Right Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {!acc.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(acc.id)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer'
                      }}
                      title="Set as primary company account"
                    >
                      Set Primary
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate(`/accounts/${acc.id}/edit`)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: '#ffffff',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Edit account details"
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRequestDelete(acc)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #fee2e2',
                      backgroundColor: '#ffffff',
                      color: '#dc2626',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Delete account"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}



      {/* Primary Account Block Warning Modal */}
      {primaryWarningAccount && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 37, 70, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setPrimaryWarningAccount(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '1.75rem',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px -12px rgba(217, 119, 6, 0.25)',
              border: '1px solid #fde68a',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div 
                style={{ 
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Cannot Delete Primary Account
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong>{primaryWarningAccount.bankName}</strong> is currently designated as your primary bank account for invoices and billing.
                </p>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              To delete this bank account, please set another active bank account as Primary first using the "Set Primary" button.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                type="button" 
                variant="primary" 
                onClick={() => setPrimaryWarningAccount(null)}
              >
                Understood
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* React Lucide Result Popup (Success for Update / Delete / Create) */}
      {lucideResultPopup && lucideResultPopup.isOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 37, 70, 0.55)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '1rem',
            animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={() => setLucideResultPopup(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '2rem 1.75rem',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Icon Button */}
            <button
              type="button"
              onClick={() => setLucideResultPopup(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                backgroundColor: '#f1f5f9',
                border: 'none'
              }}
            >
              <X size={16} />
            </button>

            {/* Lucide Icon Badge */}
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                backgroundColor: 
                  lucideResultPopup.type === 'deleted' 
                    ? '#fee2e2' 
                    : lucideResultPopup.type === 'updated' 
                    ? '#dcfce7' 
                    : '#e0f2fe',
                color: 
                  lucideResultPopup.type === 'deleted' 
                    ? '#dc2626' 
                    : lucideResultPopup.type === 'updated' 
                    ? '#16a34a' 
                    : '#0284c7',
                border: 
                  lucideResultPopup.type === 'deleted' 
                    ? '3px solid #fecaca' 
                    : lucideResultPopup.type === 'updated' 
                    ? '3px solid #bbf7d0' 
                    : '3px solid #bae6fd',
                boxShadow: 
                  lucideResultPopup.type === 'deleted'
                    ? '0 10px 25px -5px rgba(220, 38, 38, 0.3)'
                    : '0 10px 25px -5px rgba(22, 163, 74, 0.3)'
              }}
            >
              {lucideResultPopup.type === 'deleted' ? (
                <Trash2 size={34} strokeWidth={2.2} />
              ) : (
                <CheckCircle2 size={36} strokeWidth={2.2} />
              )}
            </div>

            {/* Title */}
            <h3 
              style={{ 
                margin: '0 0 8px', 
                fontSize: '1.25rem', 
                fontWeight: 700, 
                color: 'var(--text-primary)' 
              }}
            >
              {lucideResultPopup.title}
            </h3>

            {/* Message */}
            <p 
              style={{ 
                margin: '0 0 1.25rem', 
                fontSize: '0.875rem', 
                color: 'var(--text-secondary)', 
                lineHeight: 1.5,
                maxWidth: '340px'
              }}
            >
              {lucideResultPopup.message}
            </p>

            {/* Account Pill Chip */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '0.775rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '1.5rem'
              }}
            >
              <Landmark size={14} style={{ color: '#0b75b9' }} />
              <span>{lucideResultPopup.bankName}</span>
              {lucideResultPopup.last4 && (
                <>
                  <span style={{ color: 'var(--border-color)' }}>•</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    •••• {lucideResultPopup.last4}
                  </span>
                </>
              )}
            </div>

            {/* OK Button */}
            <Button
              type="button"
              variant={lucideResultPopup.type === 'deleted' ? 'outline' : 'primary'}
              onClick={() => setLucideResultPopup(null)}
              style={{
                width: '100%',
                padding: '10px 0',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '10px'
              }}
            >
              {lucideResultPopup.type === 'deleted' ? 'Dismiss' : 'Done'}
            </Button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

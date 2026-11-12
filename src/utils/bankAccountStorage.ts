export interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  accountType: 'Current' | 'Savings' | 'Overdraft' | 'Cash Credit';
  upiId?: string;
  currentBalance: number;
  isPrimary: boolean;
  status: 'Active' | 'Inactive';
  notes?: string;
  createdAt: string;
}

export const CANARA_BANK_ACCOUNT: BankAccount = {
  id: 'acc-canara',
  accountName: 'TO-GEN SOLAR AGRO',
  bankName: 'CANARA BANK',
  accountNumber: '120029515077',
  ifscCode: 'CNRB0016228',
  branchName: 'Alagarkoil, Madurai',
  accountType: 'Current',
  upiId: '325547505515077@cnrb',
  currentBalance: 650000,
  isPrimary: true,
  status: 'Active',
  notes: 'Official Canara Bank collection account with designated UPI QR payment facility.',
  createdAt: '2026-06-01'
};

export const INITIAL_DUMMY_ACCOUNTS: BankAccount[] = [
  CANARA_BANK_ACCOUNT,
  {
    id: 'acc-1',
    accountName: 'To-Gen Solar Agro Private Limited',
    bankName: 'State Bank of India (SBI)',
    accountNumber: '409283746190',
    ifscCode: 'SBIN0001234',
    branchName: 'Gandhipuram, Coimbatore',
    accountType: 'Current',
    upiId: 'togensolar@sbi',
    currentBalance: 845250,
    isPrimary: false,
    status: 'Active',
    notes: 'Primary corporate account for customer RTGS/NEFT collections, solar subsidy disbursements, and formal quotation billing.',
    createdAt: '2026-01-15'
  },
  {
    id: 'acc-2',
    accountName: 'To-Gen Solar Agro Private Limited',
    bankName: 'HDFC Bank',
    accountNumber: '50200084920193',
    ifscCode: 'HDFC0000456',
    branchName: 'RS Puram Branch, Coimbatore',
    accountType: 'Current',
    upiId: 'togen.hdfc@okaxis',
    currentBalance: 320000,
    isPrimary: false,
    status: 'Active',
    notes: 'Secondary collection account for residential rooftop solar clients and online UPI deposits.',
    createdAt: '2026-03-10'
  },
  {
    id: 'acc-3',
    accountName: 'To-Gen Solar Project Operations',
    bankName: 'ICICI Bank',
    accountNumber: '001205018392',
    ifscCode: 'ICIC0000012',
    branchName: 'Trichy Road Branch, Coimbatore',
    accountType: 'Overdraft',
    upiId: 'togen.ops@icici',
    currentBalance: 1200000,
    isPrimary: false,
    status: 'Active',
    notes: 'Operational OD facility dedicated for solar panel procurement, inverters, structure materials, and site labour payouts.',
    createdAt: '2026-05-20'
  }
];

export const STORAGE_KEY = 'togen_bank_accounts_data';
export const INVOICE_BANK_MAP_KEY = 'togen_invoice_bank_map';

export function getBankAccounts(): BankAccount[] {
  try {
    if (typeof window !== 'undefined' && Array.isArray((window as any).__accounts) && (window as any).__accounts.length > 0) {
      return (window as any).__accounts;
    }
    const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (!storage) return INITIAL_DUMMY_ACCOUNTS;
    const saved = storage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure Canara Bank is present
        const hasCanara = parsed.some((a: BankAccount) => 
          a.accountNumber === '120029515077' || 
          (a.bankName && a.bankName.toUpperCase().includes('CANARA'))
        );
        if (!hasCanara) {
          const updated = [CANARA_BANK_ACCOUNT, ...parsed];
          try { storage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
          return updated;
        }
        return parsed;
      }
    }
  } catch {
    return INITIAL_DUMMY_ACCOUNTS;
  }
  return INITIAL_DUMMY_ACCOUNTS;
}

export function saveBankAccounts(accounts: BankAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save bank accounts to storage', e);
  }
}

export function getPrimaryBankAccount(): BankAccount {
  const accounts = getBankAccounts();
  return accounts.find(a => a.isPrimary && a.status === 'Active') || 
         accounts.find(a => a.isPrimary) || 
         accounts.find(a => a.status === 'Active') || 
         accounts[0] || 
         INITIAL_DUMMY_ACCOUNTS[0];
}

export function getBankAccountById(id?: string): BankAccount | undefined {
  if (!id) return undefined;
  const accounts = getBankAccounts();
  return accounts.find(a => a.id === id);
}

const memoryInvoiceBankMap: Record<string, string> = {};

export function getInvoiceBankAccountId(invoiceId: number | string): string | null {
  const key = String(invoiceId);
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (storage) {
      const raw = storage.getItem(INVOICE_BANK_MAP_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        if (map && typeof map === 'object' && map[key]) {
          return map[key];
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return memoryInvoiceBankMap[key] || null;
}

export function setInvoiceBankAccountId(invoiceId: number | string, bankAccountId: string): void {
  const key = String(invoiceId);
  memoryInvoiceBankMap[key] = bankAccountId;
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (storage) {
      let map: Record<string, string> = {};
      const raw = storage.getItem(INVOICE_BANK_MAP_KEY);
      if (raw) {
        map = JSON.parse(raw) || {};
      }
      map[key] = bankAccountId;
      storage.setItem(INVOICE_BANK_MAP_KEY, JSON.stringify(map));
    }
  } catch (e) {
    // ignore
  }
}


export function getInvoiceBankAccount(invoiceId: number | string, explicitBankId?: string | null): BankAccount {
  if (explicitBankId) {
    const found = getBankAccountById(explicitBankId);
    if (found) return found;
  }
  if (typeof invoiceId === 'string' && (invoiceId.startsWith('acc-') || getBankAccountById(invoiceId))) {
    const directFound = getBankAccountById(invoiceId);
    if (directFound) return directFound;
  }
  const bankId = getInvoiceBankAccountId(invoiceId);
  if (bankId) {
    const found = getBankAccountById(bankId);
    if (found) return found;
  }
  return getPrimaryBankAccount();
}


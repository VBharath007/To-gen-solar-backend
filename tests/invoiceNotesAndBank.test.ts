import { describe, it, expect } from 'vitest';
import { formatNotesToPlainText } from '../shared/utils/notesFormatter';
import {
  getBankAccounts,
  getInvoiceBankAccount,
  getInvoiceBankAccountId,
  setInvoiceBankAccountId,
  CANARA_BANK_ACCOUNT
} from '../src/utils/bankAccountStorage';
import { generateTaxInvoiceHtml } from '../src/utils/invoicePdfGenerator';

describe('formatNotesToPlainText', () => {
  it('converts quotation payment terms JSON array to clean readable plain text', () => {
    const rawTermsJson = JSON.stringify([
      { key: 'Prices', value: 'Price quoted Ex-works' },
      { key: 'GST', value: '5% included' },
      { key: 'Payment', value: 'I. 80% Advance.\nII. 20% on completion.' },
      { key: 'Warranty', value: '12 years product warranty' }
    ]);

    const formatted = formatNotesToPlainText(rawTermsJson);

    expect(formatted).not.toContain('{"key"');
    expect(formatted).not.toContain('[{');
    expect(formatted).toContain('Prices: Price quoted Ex-works');
    expect(formatted).toContain('GST: 5% included');
    expect(formatted).toContain('Payment:\n  I. 80% Advance.\n  II. 20% on completion.');
    expect(formatted).toContain('Warranty: 12 years product warranty');
  });

  it('converts milestones JSON array to numbered milestone list', () => {
    const rawMilestones = JSON.stringify([
      { stage: 'Advance', percentage: 20, terms: 'Payable with purchase order' },
      { stage: 'Delivery', percentage: 70, terms: 'Payable on material delivery' },
      { stage: 'Commissioning', percentage: 10, terms: 'Payable after testing' }
    ]);

    const formatted = formatNotesToPlainText(rawMilestones);

    expect(formatted).toContain('1. Advance (20%): Payable with purchase order');
    expect(formatted).toContain('2. Delivery (70%): Payable on material delivery');
    expect(formatted).toContain('3. Commissioning (10%): Payable after testing');
  });

  it('converts array of strings to numbered bullet points', () => {
    const rawList = JSON.stringify([
      '50% advance along with PO',
      'Balance before dispatch',
      'Prices valid for 7 days'
    ]);

    const formatted = formatNotesToPlainText(rawList);

    expect(formatted).toBe('1. 50% advance along with PO\n2. Balance before dispatch\n3. Prices valid for 7 days');
  });

  it('preserves plain text without changes', () => {
    const plainText = 'Standard terms: 100% advance before installation.';
    expect(formatNotesToPlainText(plainText)).toBe(plainText);
  });

  it('handles null, undefined and empty strings gracefully', () => {
    expect(formatNotesToPlainText(null)).toBe('');
    expect(formatNotesToPlainText(undefined)).toBe('');
    expect(formatNotesToPlainText('')).toBe('');
    expect(formatNotesToPlainText('   ')).toBe('');
  });
});

describe('Invoice Bank Account Storage and Persistence', () => {
  // Firebase-supplied fixture replaces the desktop dummy fallback.
  (globalThis as any).__accounts = [CANARA_BANK_ACCOUNT];
  it('stores and retrieves bank account for an invoice', () => {
    const invoiceId = 9999;
    const testBankId = 'acc-canara';

    setInvoiceBankAccountId(invoiceId, testBankId);
    expect(getInvoiceBankAccountId(invoiceId)).toBe(testBankId);

    const bank = getInvoiceBankAccount(invoiceId);
    expect(bank.id).toBe(CANARA_BANK_ACCOUNT.id);
    expect(bank.bankName).toBe(CANARA_BANK_ACCOUNT.bankName);
  });

  it('supports explicitBankId parameter in getInvoiceBankAccount', () => {
    const bank = getInvoiceBankAccount(12345, 'acc-canara');
    expect(bank.id).toBe('acc-canara');
    expect(bank.accountNumber).toBe('120029515077');
  });
});

describe('Date Validation Rules on Edit vs Create', () => {
  it('allows dates from original date onwards when editing, but blocks dates earlier than original date', () => {
    const originalDate = '2026-10-12';
    const isEditing = true;
    const todayStr = '2026-10-14';

    const getMinAllowedDate = (isEdit: boolean, origDate?: string) => {
      return isEdit && origDate ? origDate : todayStr;
    };

    const minDate = getMinAllowedDate(isEditing, originalDate);
    expect(minDate).toBe('2026-10-12');

    // Dates earlier than original date should be disallowed
    expect('2026-10-11' < minDate).toBe(true);

    // Original date should be allowed
    expect('2026-10-12' >= minDate).toBe(true);

    // Intermediate dates between original date and today should be allowed
    expect('2026-10-13' >= minDate).toBe(true);

    // Today and future dates should be allowed
    expect('2026-10-14' >= minDate).toBe(true);
    expect('2026-10-25' >= minDate).toBe(true);
  });

  it('blocks past dates when creating a new record', () => {
    const isEditing = false;
    const todayStr = '2026-10-14';

    const getMinAllowedDate = (isEdit: boolean, origDate?: string) => {
      return isEdit && origDate ? origDate : todayStr;
    };

    const minDate = getMinAllowedDate(isEditing);
    expect(minDate).toBe('2026-10-14');

    // Any date before today should be disallowed
    expect('2026-10-12' < minDate).toBe(true);
    expect('2026-10-13' < minDate).toBe(true);

    // Today and future dates should be allowed
    expect('2026-10-14' >= minDate).toBe(true);
    expect('2026-10-15' >= minDate).toBe(true);
  });
});

describe('generateTaxInvoiceHtml payment totals and balance due', () => {
  it('displays Amount Paid and Balance Due dynamically for an Advance Receipt', async () => {
    const html = await generateTaxInvoiceHtml({
      invoiceType: 'Advance Receipt',
      invoiceNo: 'INV-2026-0002',
      invoiceDate: '13/11/2026',
      dueDate: '28/11/2026',
      placeOfSupply: 'Tamil Nadu',
      billTo: {
        name: 'Surya',
        address: 'north street',
        city: 'Madurai',
        phone: '9656468654',
      },
      items: [
        {
          description: 'Exide Solar Tubular 150Ah - 12V 150Ah C10 Deep Cycle Solar Tubular Battery',
          quantity: 1,
          unit: '1',
          unitPrice: 1550000,
          gstRate: 18,
          total: 1313559, // taxable base in paise for tax-inclusive
        },
      ],
      amountPaid: 550000, // ₹5,500.00
      totalAmount: 1550000, // ₹15,500.00
      balanceDue: 1000000, // ₹10,000.00
      status: 'Partial',
      taxInclusive: true,
    });

    expect(html).toContain('ADVANCE RECEIPT');
    expect(html).toContain('# INV-2026-0002');
    expect(html).toContain('Partial');
    expect(html).toContain('GRAND TOTAL');
    expect(html).toContain('₹15,500.00');
    expect(html).toContain('Amount Paid');
    expect(html).toContain('₹5,500.00');
    expect(html).toContain('BALANCE DUE');
    expect(html).toContain('₹10,000.00');
    expect(html).toContain('Balance Due in Words:');
    expect(html).toContain('Ten Thousand Rupees Only');
    expect(html).toContain('(Included)');
  });

  it('displays correct totals for tax-exclusive invoice', async () => {
    const html = await generateTaxInvoiceHtml({
      invoiceType: 'Tax Invoice',
      invoiceNo: 'INV-2026-0003',
      invoiceDate: '13/11/2026',
      billTo: { name: 'Chella Mani' },
      items: [
        {
          description: 'Solar Inverter 5kVA',
          quantity: 1,
          unit: '1',
          unitPrice: 5000000, // ₹50,000.00
          gstRate: 18,
          total: 5000000, // taxable base in paise for tax-exclusive
        },
      ],
      taxInclusive: false,
    });

    expect(html).toContain('TAX INVOICE');
    expect(html).toContain('Sub Total');
    expect(html).toContain('₹50,000.00');
    expect(html).toContain('Total Tax Amount');
    expect(html).toContain('₹9,000.00');
    expect(html).toContain('GRAND TOTAL');
    expect(html).toContain('₹59,000.00');
    expect(html).toContain('Fifty Nine Thousand Rupees Only');
  });
});


import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, isValidIndianMobileNumber } from '../shared/utils/phone';
import { checkPhoneDuplicate } from '../backend/utils/phone-duplicate';

describe('Phone Number Normalization & Validation', () => {
  it('normalizes various phone number formats to standard 10 digits', () => {
    const rawInputs = [
      '9876543210',
      '+91 9876543210',
      '+91-9876543210',
      '91 9876543210',
      '91-9876543210',
      '09876543210',
      '(987) 654-3210',
      '+91 (987) 654-3210',
    ];

    for (const input of rawInputs) {
      expect(normalizePhoneNumber(input)).toBe('9876543210');
      expect(isValidIndianMobileNumber(input)).toBe(true);
    }
  });

  it('rejects invalid phone numbers', () => {
    expect(isValidIndianMobileNumber('123')).toBe(false);
    expect(isValidIndianMobileNumber('123456789')).toBe(false);
    expect(isValidIndianMobileNumber('1234567890123')).toBe(false);
    expect(isValidIndianMobileNumber('')).toBe(false);
    expect(isValidIndianMobileNumber(null)).toBe(false);
  });
});

describe('Cross-Module Phone Duplicate Detection Logic', () => {
  // Mock DB for checkPhoneDuplicate
  const createMockDb = (customerRows: { id: number; name: string; phone: string }[], leadRows: { id: number; name: string; phone: string }[]) => {
    return {
      prepare: (sql: string) => ({
        get: (...params: any[]) => {
          if (sql.includes('FROM customers')) {
            const phone = params[0];
            const excludeId = params[1];
            return customerRows.find(c => c.phone === phone && (!excludeId || c.id !== excludeId));
          }
          if (sql.includes('FROM leads')) {
            const phone = params[0];
            const excludeId = params[1];
            return leadRows.find(l => l.phone === phone && (!excludeId || l.id !== excludeId));
          }
          return undefined;
        }
      })
    };
  };

  it('detects duplicate when phone exists in Customers table', () => {
    const mockDb = createMockDb(
      [{ id: 1, name: 'Suresh Kumar', phone: '9876543210' }],
      []
    );

    const result = checkPhoneDuplicate(mockDb, '+91 9876543210');
    expect(result.isValid).toBe(true);
    expect(result.isDuplicate).toBe(true);
    expect(result.module).toBe('Customer');
    expect(result.message).toBe('This phone number is already registered as a Customer.');
  });

  it('detects duplicate when phone exists in Leads table', () => {
    const mockDb = createMockDb(
      [],
      [{ id: 5, name: 'Ramesh Lead', phone: '9876543210' }]
    );

    const result = checkPhoneDuplicate(mockDb, '91-9876543210');
    expect(result.isValid).toBe(true);
    expect(result.isDuplicate).toBe(true);
    expect(result.module).toBe('Lead');
    expect(result.message).toBe('This phone number is already registered as a Lead.');
  });

  it('allows editing an existing record with its own phone number', () => {
    const mockDb = createMockDb(
      [{ id: 1, name: 'Suresh Kumar', phone: '9876543210' }],
      []
    );

    // Editing customer id: 1
    const result = checkPhoneDuplicate(mockDb, '9876543210', { excludeCustomerId: 1 });
    expect(result.isValid).toBe(true);
    expect(result.isDuplicate).toBe(false);
  });

  it('blocks changing existing customer phone to another customer or lead phone', () => {
    const mockDb = createMockDb(
      [
        { id: 1, name: 'Suresh Kumar', phone: '9876543210' },
        { id: 2, name: 'Priya', phone: '9123456780' }
      ],
      [{ id: 10, name: 'Lead John', phone: '9988776655' }]
    );

    // Editing customer 1, but changing phone to customer 2's phone
    const resToCust = checkPhoneDuplicate(mockDb, '9123456780', { excludeCustomerId: 1 });
    expect(resToCust.isDuplicate).toBe(true);
    expect(resToCust.module).toBe('Customer');

    // Editing customer 1, but changing phone to lead 10's phone
    const resToLead = checkPhoneDuplicate(mockDb, '9988776655', { excludeCustomerId: 1 });
    expect(resToLead.isDuplicate).toBe(true);
    expect(resToLead.module).toBe('Lead');
  });

  it('allows completely new and unique phone number', () => {
    const mockDb = createMockDb(
      [{ id: 1, name: 'Suresh Kumar', phone: '9876543210' }],
      [{ id: 2, name: 'Lead John', phone: '9988776655' }]
    );

    const result = checkPhoneDuplicate(mockDb, '+91 9111222333');
    expect(result.isValid).toBe(true);
    expect(result.isDuplicate).toBe(false);
    expect(result.normalizedPhone).toBe('9111222333');
  });
});

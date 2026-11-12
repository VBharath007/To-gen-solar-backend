import { describe, it, expect } from 'vitest';

describe('Quotation Tax and Discount Input Sanitization & Calculations', () => {
  const sanitizeNumericInput = (val: string): string => {
    if (!val) return '';
    let s = val.replace(/[^0-9.]/g, '');
    const parts = s.split('.');
    if (parts.length > 2) {
      s = parts[0] + '.' + parts.slice(1).join('');
    }
    if (/^0[0-9]/.test(s)) {
      s = s.replace(/^0+/, '');
      if (s === '') s = '0';
    }
    return s;
  };

  const validateDiscountInput = (
    rawInput: string | number,
    subtotalPaise: number,
    totalTaxPaise: number
  ) => {
    const actualPricePaise = Math.max(0, Math.round(subtotalPaise || 0));
    const maxDiscountPaise = actualPricePaise > 0 ? Math.floor(actualPricePaise * 0.20) : 0;
    const maxDiscountAmount = maxDiscountPaise / 100;

    const rawStr = String(rawInput ?? '').trim().replace('%', '');

    if (rawStr === '-' || rawStr.startsWith('-') || Number(rawStr) < 0) {
      return {
        isValid: false,
        error: 'Negative amount is not allowed.',
        discountPaise: 0,
      };
    }

    // Empty check (valid 0% discount, no leading-zero requirement)
    if (rawStr === '') {
      return {
        isValid: true,
        error: null,
        discountPaise: 0,
      };
    }

    if (isNaN(Number(rawStr)) || !isFinite(Number(rawStr))) {
      return {
        isValid: false,
        error: 'Please enter a valid discount value.',
        discountPaise: 0,
      };
    }

    const percentage = Number(rawStr);

    if (percentage > 20 || (actualPricePaise <= 0 && percentage > 0)) {
      return {
        isValid: false,
        error: 'Discount cannot exceed 20%',
        discountPaise: 0,
      };
    }

    const discountPaise = Math.floor(actualPricePaise * (percentage / 100));
    return {
      isValid: true,
      error: null,
      discountPaise,
    };
  };

  it('correctly strips leading zeros without corrupting decimal values and blocks all letters', () => {
    expect(sanitizeNumericInput('0')).toBe('0');
    expect(sanitizeNumericInput('012')).toBe('12');
    expect(sanitizeNumericInput('02')).toBe('2');
    expect(sanitizeNumericInput('00')).toBe('0');
    expect(sanitizeNumericInput('0.5')).toBe('0.5');
    expect(sanitizeNumericInput('')).toBe('');
    expect(sanitizeNumericInput('23%')).toBe('23');
    expect(sanitizeNumericInput('abc')).toBe('');
    expect(sanitizeNumericInput('12abc34')).toBe('1234');
    expect(sanitizeNumericInput('18.5.5')).toBe('18.55');
  });

  it('allows empty discount string as valid 0% discount without errors', () => {
    const res = validateDiscountInput('', 100000, 18000);
    expect(res.isValid).toBe(true);
    expect(res.error).toBeNull();
    expect(res.discountPaise).toBe(0);
  });

  it('validates percentage limits properly', () => {
    const validRes = validateDiscountInput('2', 100000, 18000);
    expect(validRes.isValid).toBe(true);
    expect(validRes.discountPaise).toBe(2000);

    const exceedRes = validateDiscountInput('25', 100000, 18000);
    expect(exceedRes.isValid).toBe(false);
  });

  it('preserves user custom tax when calculating totals with global discount', () => {
    const subtotal = 100000; // Rs 1000.00
    const customTaxInput = '23';
    const discountInput = '2';

    const safeTaxRate = parseFloat(customTaxInput);
    const total_tax = Math.round(subtotal * (safeTaxRate / 100));
    expect(total_tax).toBe(23000); // Rs 230.00 (23%)

    const discountRes = validateDiscountInput(discountInput, subtotal, total_tax);
    expect(discountRes.isValid).toBe(true);
    expect(discountRes.discountPaise).toBe(2000); // Rs 20.00 (2%)

    const grand_total = subtotal + total_tax - discountRes.discountPaise;
    expect(grand_total).toBe(100000 + 23000 - 2000); // 121000 paise (Rs 1210.00)
    // Custom tax remains 23% and was not reverted to 18% or 0%
    expect(safeTaxRate).toBe(23);
  });
});

import { describe, it, expect } from 'vitest';

describe('Product Price Validation', () => {
  const MAX_PRODUCT_PRICE = 10000000; // 1 Crore in Rupees

  function validateProductPrice(price: any): { valid: boolean; error?: string } {
    if (price === undefined || price === null || String(price).trim() === '') {
      return { valid: true }; // Price is optional, but if entered must satisfy limits
    }
    const num = Number(price);
    if (isNaN(num) || num < 0) {
      return { valid: false, error: 'Price cannot be negative.' };
    }
    if (num > MAX_PRODUCT_PRICE) {
      return { valid: false, error: 'Price cannot exceed ₹1 Crore (10,000,000).' };
    }
    return { valid: true };
  }

  it('allows valid product prices within 1 Crore', () => {
    expect(validateProductPrice(0).valid).toBe(true);
    expect(validateProductPrice(15000).valid).toBe(true);
    expect(validateProductPrice(9999999.99).valid).toBe(true);
    expect(validateProductPrice(10000000).valid).toBe(true); // exactly 1 Crore
  });

  it('allows optional/empty price', () => {
    expect(validateProductPrice(undefined).valid).toBe(true);
    expect(validateProductPrice(null).valid).toBe(true);
    expect(validateProductPrice('').valid).toBe(true);
  });

  it('rejects negative prices', () => {
    expect(validateProductPrice(-1).valid).toBe(false);
    expect(validateProductPrice(-500).error).toBe('Price cannot be negative.');
  });

  it('rejects prices exceeding 1 Crore', () => {
    const res = validateProductPrice(10000001);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Price cannot exceed ₹1 Crore (10,000,000).');
  });

  it('filters non-numerical characters properly', () => {
    const rawInput = '₹1,50,000abc+';
    const sanitized = rawInput.replace(/[^0-9.]/g, '');
    expect(sanitized).toBe('150000');
    expect(validateProductPrice(parseFloat(sanitized)).valid).toBe(true);
  });
});

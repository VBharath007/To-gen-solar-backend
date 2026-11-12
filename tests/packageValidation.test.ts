import { describe, it, expect } from 'vitest';

describe('Package Pricing Validation', () => {
  const MAX_PRICE = 100000000; // 10 Crore in Rupees

  function validatePackagePrice(price: any): { valid: boolean; error?: string } {
    if (price === undefined || price === null || String(price).trim() === '') {
      return { valid: false, error: 'Fixed price is required.' };
    }
    const num = Number(price);
    if (isNaN(num) || num <= 0) {
      return { valid: false, error: 'Fixed price must be greater than 0.' };
    }
    if (num > MAX_PRICE) {
      return { valid: false, error: 'Fixed price cannot exceed ₹10 Crore (100,000,000).' };
    }
    return { valid: true };
  }

  it('allows valid prices across pricing methods', () => {
    expect(validatePackagePrice(150000).valid).toBe(true);
    expect(validatePackagePrice(1).valid).toBe(true);
    expect(validatePackagePrice(99999999.99).valid).toBe(true);
    expect(validatePackagePrice(100000000).valid).toBe(true); // exactly 10 Crore
  });

  it('rejects empty or missing price', () => {
    expect(validatePackagePrice('').valid).toBe(false);
    expect(validatePackagePrice(null).valid).toBe(false);
    expect(validatePackagePrice(undefined).valid).toBe(false);
  });

  it('rejects zero or negative prices', () => {
    expect(validatePackagePrice(0).valid).toBe(false);
    expect(validatePackagePrice(-100).valid).toBe(false);
    expect(validatePackagePrice(-0.01).valid).toBe(false);
  });

  it('rejects prices exceeding 10 Crore', () => {
    const res = validatePackagePrice(100000001);
    expect(res.valid).toBe(false);
    expect(res.error).toBe('Fixed price cannot exceed ₹10 Crore (100,000,000).');
  });

  it('sanitizes input to only digits and decimal', () => {
    const rawInput = '₹1,50,000.50abc-';
    const sanitized = rawInput.replace(/[^0-9.]/g, '');
    expect(sanitized).toBe('150000.50');
    expect(validatePackagePrice(parseFloat(sanitized)).valid).toBe(true);
  });

  describe('Quotation Form Item Price Validation (Must be > 0)', () => {
    function validatePackageStep(items: Array<{ name: string; unit_price: number }>) {
      if (!items || items.length === 0) {
        return { isValid: false, message: 'Please add at least one Package or Component item to the quotation before proceeding.' };
      }
      const zeroPriceItem = items.find(it => !it.unit_price || Number(it.unit_price) <= 0);
      if (zeroPriceItem) {
        return { isValid: false, message: `Product "${zeroPriceItem.name || 'Component'}" price cannot be ₹0. Please enter a valid price before proceeding to Pricing & Tax.` };
      }
      return { isValid: true, message: '' };
    }

    it('blocks proceeding to pricing when a product has price 0 or negative', () => {
      const itemsWithZeroPrice = [
        { name: 'adani 625', unit_price: 0 },
        { name: 'luminous lum-203', unit_price: 200000 },
      ];
      const result = validatePackageStep(itemsWithZeroPrice);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('adani 625');
      expect(result.message).toContain('cannot be ₹0');
    });

    it('allows proceeding when all products have valid price > 0', () => {
      const itemsWithValidPrices = [
        { name: 'adani 625', unit_price: 500000 },
        { name: 'luminous lum-203', unit_price: 200000 },
        { name: '3kW Grid Tie-Premium', unit_price: 15000000 },
      ];
      const result = validatePackageStep(itemsWithValidPrices);
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('');
    });
  });
});


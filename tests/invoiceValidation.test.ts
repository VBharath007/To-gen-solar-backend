import { describe, it, expect } from 'vitest';
import {
  getLineQuantityError,
  getLineUnitError,
  getLineRateError,
  getLineDiscountError,
  getLineTotalError,
  MAX_INVOICE_ITEMS,
  MAX_LINE_QTY,
  MAX_LINE_UNIT,
  MAX_LINE_RATE,
  MAX_DISCOUNT_PERCENT,
  MAX_INVOICE_TOTAL,
} from '../src/utils/invoiceValidation';

describe('Invoice Module Numerical Limits and Validation Rules', () => {
  describe('Rule 1: Maximum Items in One Invoice (500 items)', () => {
    it('allows up to 500 items and blocks 501st item', () => {
      expect(MAX_INVOICE_ITEMS).toBe(500);
      expect(499 <= MAX_INVOICE_ITEMS).toBe(true);
      expect(500 <= MAX_INVOICE_ITEMS).toBe(true);
      expect(501 <= MAX_INVOICE_ITEMS).toBe(false);
    });
  });

  describe('Rule 2: Qty Validation (Max 500, Whole Number Only, No Float, No Negative)', () => {
    it('allows valid integer quantities up to 500', () => {
      const valid = [1, 5, 50, 250, 499, 500];
      for (const val of valid) {
        expect(getLineQuantityError(val)).toBeNull();
      }
    });

    it('blocks quantity above 500', () => {
      expect(getLineQuantityError(501)).toBe('Maximum allowed quantity is 500.');
      expect(getLineQuantityError(1000)).toBe('Maximum allowed quantity is 500.');
    });

    it('blocks decimals/float in quantity (whole number only)', () => {
      expect(getLineQuantityError(1.5)).toBe('Quantity must be a whole number (no decimals).');
      expect(getLineQuantityError('10.25')).toBe('Quantity must be a whole number (no decimals).');
    });

    it('blocks 0 and negative numbers in quantity', () => {
      expect(getLineQuantityError(0)).toBe('Quantity must be at least 1.');
      expect(getLineQuantityError(-5)).toBe('Quantity must be at least 1.');
      expect(getLineQuantityError('')).toBe('Quantity must be at least 1.');
    });
  });

  describe('Rule 3: Unit Validation (Max 99,999, Whole Number Only, No Float, No Negative)', () => {
    it('allows valid integer units up to 99,999', () => {
      const valid = [1, 10, 500, 1000, 99999, '99999'];
      for (const val of valid) {
        expect(getLineUnitError(val)).toBeNull();
      }
    });

    it('blocks unit above 99,999', () => {
      expect(getLineUnitError(100000)).toBe('Maximum allowed unit is 99,999.');
      expect(getLineUnitError('100001')).toBe('Maximum allowed unit is 99,999.');
    });

    it('blocks decimals/float in unit (whole number only)', () => {
      expect(getLineUnitError(2.5)).toBe('Unit must be a whole number (no decimals).');
      expect(getLineUnitError('1.1')).toBe('Unit must be a whole number (no decimals).');
    });

    it('blocks 0 and negative numbers in unit', () => {
      expect(getLineUnitError(0)).toBe('Unit must be at least 1.');
      expect(getLineUnitError(-1)).toBe('Unit must be at least 1.');
      expect(getLineUnitError('')).toBe('Unit must be at least 1.');
    });
  });

  describe('Rule 4: Rate Validation (Max 10 Crore / ₹100,000,000, Float Allowed, > 0)', () => {
    it('allows valid rates including decimals up to 10 Crore', () => {
      const valid = [1, 99.5, 50000.75, 10000000, 100000000];
      for (const val of valid) {
        expect(getLineRateError(val)).toBeNull();
      }
    });

    it('blocks rate exceeding 10 Crore (100,000,000)', () => {
      expect(getLineRateError(100000001)).toBe('Rate cannot exceed ₹10 Crore (100,000,000).');
      expect(getLineRateError(200000000)).toBe('Rate cannot exceed ₹10 Crore (100,000,000).');
    });

    it('blocks rate <= 0', () => {
      expect(getLineRateError(0)).toBe('Rate must be greater than 0.');
      expect(getLineRateError(-100)).toBe('Rate must be greater than 0.');
      expect(getLineRateError('')).toBe('Rate must be greater than 0.');
    });
  });

  describe('Rule 5: Total Validation (Max 100 Crore / ₹1,000,000,000, Float Allowed)', () => {
    it('allows totals up to 100 Crore', () => {
      const valid = [100.5, 5000000, 100000000, 1000000000];
      for (const val of valid) {
        expect(getLineTotalError(val)).toBeNull();
      }
    });

    it('blocks line total exceeding 100 Crore', () => {
      expect(getLineTotalError(1000000001)).toBe('Line total cannot exceed ₹100 Crore.');
      expect(MAX_INVOICE_TOTAL).toBe(1000000000);
    });
  });

  describe('Rule 6: Discount Validation (Percentage Only, Max 60%, No Negative)', () => {
    it('allows valid discount percentages up to 60%', () => {
      const valid = [0, 5, 10, 15.5, 25, 50, 60, '60'];
      for (const val of valid) {
        expect(getLineDiscountError(val)).toBeNull();
      }
      expect(MAX_DISCOUNT_PERCENT).toBe(60);
    });

    it('blocks discount exceeding 60%', () => {
      expect(getLineDiscountError(60.01)).toBe('Discount cannot exceed 60%.');
      expect(getLineDiscountError(61)).toBe('Discount cannot exceed 60%.');
      expect(getLineDiscountError(100)).toBe('Discount cannot exceed 60%.');
    });

    it('blocks negative discount', () => {
      expect(getLineDiscountError(-1)).toBe('Discount cannot be negative.');
      expect(getLineDiscountError(-0.5)).toBe('Discount cannot be negative.');
    });

    it('allows empty/null discount as 0%', () => {
      expect(getLineDiscountError('')).toBeNull();
      expect(getLineDiscountError(null)).toBeNull();
      expect(getLineDiscountError(undefined)).toBeNull();
    });
  });
});

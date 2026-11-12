/**
 * Invoice module validation rules and constants
 *
 * Rules:
 * - Qty: Maximum 500, whole numbers only (no float/decimals), non-negative, numeric only.
 * - Unit: Maximum 99,999, whole numbers only (no float/decimals), non-negative, numeric only.
 * - Rate: Maximum 10 Crore (100,000,000), float allowed, non-negative, numeric only (> 0).
 * - Total: Maximum 100 Crore (1,000,000,000), float allowed.
 * - Tax: Float allowed, range 0-100%.
 */

export const MAX_INVOICE_ITEMS = 500;
export const MAX_LINE_QTY = 500;
export const MAX_LINE_UNIT = 99999;
export const MAX_LINE_RATE = 100000000; // 10 Crore (10,00,00,000)
export const MAX_INVOICE_TOTAL = 1000000000; // 100 Crore (100,00,00,000)

export const isNosUnit = (unit?: string | number | null): boolean => {
  if (unit === undefined || unit === null) return true;
  const str = String(unit).trim().toLowerCase();
  return str === '' || str === 'nos' || str === 'no' || str === 'no.' || str === 'nos.' || str === '1' || str === 'pieces' || str === 'piece';
};

export const getLineQuantityError = (quantity: any): string | null => {
  if (quantity === '' || quantity === undefined || quantity === null) {
    return 'Quantity must be at least 1.';
  }
  const str = String(quantity).trim();
  if (str.includes('.')) {
    return 'Quantity must be a whole number (no decimals).';
  }
  const num = Number(quantity);
  if (isNaN(num) || num < 1) {
    return 'Quantity must be at least 1.';
  }
  if (!Number.isInteger(num)) {
    return 'Quantity must be a whole number (no decimals).';
  }
  if (num > MAX_LINE_QTY) {
    return `Maximum allowed quantity is ${MAX_LINE_QTY}.`;
  }
  return null;
};

export const getLineUnitError = (unit: any): string | null => {
  if (unit === '' || unit === undefined || unit === null) {
    return 'Unit must be at least 1.';
  }
  const str = String(unit).trim();
  if (str.includes('.')) {
    return 'Unit must be a whole number (no decimals).';
  }
  const num = Number(unit);
  if (isNaN(num) || num < 1) {
    return 'Unit must be at least 1.';
  }
  if (!Number.isInteger(num)) {
    return 'Unit must be a whole number (no decimals).';
  }
  if (num > MAX_LINE_UNIT) {
    return `Maximum allowed unit is ${MAX_LINE_UNIT.toLocaleString('en-IN')}.`;
  }
  return null;
};

export const getLineRateError = (rate: any): string | null => {
  if (rate === '' || rate === undefined || rate === null) {
    return 'Rate must be greater than 0.';
  }
  const num = Number(rate);
  if (isNaN(num) || num <= 0) {
    return 'Rate must be greater than 0.';
  }
  if (num > MAX_LINE_RATE) {
    return 'Rate cannot exceed ₹10 Crore (100,000,000).';
  }
  return null;
};

export const MAX_DISCOUNT_PERCENT = 60; // 60%

export const getLineDiscountError = (discount: any): string | null => {
  if (discount === '' || discount === undefined || discount === null) {
    return null;
  }
  const num = Number(discount);
  if (isNaN(num) || num < 0) {
    return 'Discount cannot be negative.';
  }
  if (num > MAX_DISCOUNT_PERCENT) {
    return `Discount cannot exceed ${MAX_DISCOUNT_PERCENT}%.`;
  }
  return null;
};

export const getLineTotalError = (total: any): string | null => {
  const num = Number(total);
  if (isNaN(num)) return null;
  if (num > MAX_INVOICE_TOTAL) {
    return 'Line total cannot exceed ₹100 Crore.';
  }
  return null;
};

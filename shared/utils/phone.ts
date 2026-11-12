/**
 * Phone number normalization and validation utilities for ToGen Solar CRM.
 *
 * Rules:
 * - Strips spaces, hyphens, brackets, '+', etc.
 * - For Indian numbers, strips leading '+91', '91' (when followed by 10 digits), or leading '0' (11 digits).
 * - Normalized format is strictly the 10-digit mobile number.
 */

export function normalizePhoneNumber(rawPhone: string | null | undefined): string {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');

  // 12 digits starting with '91' (e.g. 919876543210 or +919876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  // 11 digits starting with '0' (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  return digits;
}

export function isValidIndianMobileNumber(phone: string | null | undefined): boolean {
  const normalized = normalizePhoneNumber(phone);
  return normalized.length === 10 && /^\d{10}$/.test(normalized);
}

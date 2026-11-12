import { normalizePhoneNumber } from '@shared/utils/phone';

export { normalizePhoneNumber };

/**
 * Common validation utilities for ToGen Solar CRM
 */

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Validates a mobile phone number.
 * - Handles spaces, hyphens, brackets, country codes (+91 / 91)
 * - Must resolve strictly to a valid 10-digit mobile number.
 */
export function validatePhone(phone: string | undefined | null, required = true, fieldLabel = 'Phone number'): ValidationResult {
  const trimmed = String(phone || '').trim();

  if (!trimmed) {
    if (required) {
      return { isValid: false, error: `${fieldLabel} is required.` };
    }
    return { isValid: true, error: null };
  }

  const normalized = normalizePhoneNumber(trimmed);
  if (normalized.length !== 10 || !/^\d{10}$/.test(normalized)) {
    return { isValid: false, error: `${fieldLabel} must be exactly 10 digits.` };
  }

  return { isValid: true, error: null };
}

/**
 * Validates a name field.
 * - Only alphabetic characters (letters), spaces, dots, and hyphens allowed.
 * - Must have at least 3 letters excluding spaces (spaces do NOT count towards the minimum 3 characters).
 */
export function validateName(name: string | undefined | null, fieldLabel = 'Name', required = true): ValidationResult {
  const trimmed = String(name || '').trim();

  if (!trimmed) {
    if (required) {
      return { isValid: false, error: `${fieldLabel} is required.` };
    }
    return { isValid: true, error: null };
  }

  // Check for numbers or illegal special characters
  if (/[^a-zA-Z\s.'-]/.test(trimmed)) {
    return { isValid: false, error: `${fieldLabel} must contain only letters.` };
  }

  // Check minimum 3 letters without spaces
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length < 3) {
    return {
      isValid: false,
      error: `${fieldLabel} must contain at least 3 letters (excluding spaces).`,
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validates an email address.
 */
export function validateEmail(email: string | undefined | null, required = false): ValidationResult {
  const trimmed = String(email || '').trim();

  if (!trimmed) {
    if (required) {
      return { isValid: false, error: 'Email address is required.' };
    }
    return { isValid: true, error: null };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }

  return { isValid: true, error: null };
}

/**
 * Validates an Indian pincode (6 digits).
 */
export function validatePincode(pincode: string | undefined | null, required = false): ValidationResult {
  const trimmed = String(pincode || '').trim();

  if (!trimmed) {
    if (required) {
      return { isValid: false, error: 'Pincode is required.' };
    }
    return { isValid: true, error: null };
  }

  if (!/^\d{6}$/.test(trimmed)) {
    return { isValid: false, error: 'Pincode must be exactly 6 digits.' };
  }

  return { isValid: true, error: null };
}

/**
 * Sanitizes phone input in real time to only allow digits and at most 10 characters.
 */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

/**
 * Sanitizes name input in real time to prevent typing digits or unwanted symbols.
 */
export function sanitizeNameInput(value: string): string {
  return value.replace(/[^a-zA-Z\s.'-]/g, '');
}

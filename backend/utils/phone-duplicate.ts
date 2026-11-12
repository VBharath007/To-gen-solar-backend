import { normalizePhoneNumber, isValidIndianMobileNumber } from '@shared/utils/phone';

export interface PhoneDuplicateResult {
  isValid: boolean;
  isDuplicate: boolean;
  normalizedPhone: string;
  module?: 'Customer' | 'Lead';
  recordName?: string;
  message?: string;
}

/**
 * Checks whether a phone number is valid and whether it already exists in either
 * the `customers` or `leads` table.
 *
 * Supports edit scenarios by allowing caller to exclude a specific customerId or leadId.
 */
export function checkPhoneDuplicate(
  db: any,
  rawPhone: string | null | undefined,
  options?: { excludeCustomerId?: number; excludeLeadId?: number }
): PhoneDuplicateResult {
  const normalized = normalizePhoneNumber(rawPhone);

  if (!normalized || !isValidIndianMobileNumber(normalized)) {
    return {
      isValid: false,
      isDuplicate: false,
      normalizedPhone: normalized,
      message: 'Please enter a valid 10-digit mobile number.',
    };
  }

  // 1. Check customers table
  let custQuery = 'SELECT id, name FROM customers WHERE phone = ?';
  const custParams: any[] = [normalized];
  if (options?.excludeCustomerId !== undefined && options.excludeCustomerId > 0) {
    custQuery += ' AND id != ?';
    custParams.push(options.excludeCustomerId);
  }
  const existingCust = db.prepare(custQuery).get(...custParams) as { id: number; name: string } | undefined;
  if (existingCust) {
    return {
      isValid: true,
      isDuplicate: true,
      normalizedPhone: normalized,
      module: 'Customer',
      recordName: existingCust.name,
      message: 'This phone number is already registered as a Customer.',
    };
  }

  // 2. Check leads table
  let leadQuery = `SELECT id, name FROM leads WHERE phone = ? AND status != 'Converted'`;
  const leadParams: any[] = [normalized];
  if (options?.excludeLeadId !== undefined && options.excludeLeadId > 0) {
    leadQuery += ' AND id != ?';
    leadParams.push(options.excludeLeadId);
  }
  const existingLead = db.prepare(leadQuery).get(...leadParams) as { id: number; name: string } | undefined;
  if (existingLead) {
    return {
      isValid: true,
      isDuplicate: true,
      normalizedPhone: normalized,
      module: 'Lead',
      recordName: existingLead.name,
      message: 'This phone number is already registered as a Lead.',
    };
  }

  return {
    isValid: true,
    isDuplicate: false,
    normalizedPhone: normalized,
  };
}

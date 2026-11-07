/**
 * India-specific compliance validators and formatters
 */

// GSTIN format: 2 digit state code, 10 char PAN, 1 entity code, 1 'Z', 1 checksum
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Permanent Account Number (PAN): 5 uppercase letters, 4 numbers, 1 letter
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Harmonized System of Nomenclature (HSN) code (4, 6 or 8 digits)
export const HSN_REGEX = /^[0-9]{4,8}$/;

export function validateGSTIN(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

export function validatePAN(pan: string): boolean {
  return PAN_REGEX.test(pan.trim().toUpperCase());
}

export function validateHSN(hsn: string): boolean {
  return HSN_REGEX.test(hsn.trim());
}

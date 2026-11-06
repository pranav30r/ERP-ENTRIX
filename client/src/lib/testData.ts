/**
 * Shared utility to detect test and mock records generated during verification.
 */
export function isTestRecord(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return (
    v.startsWith('TEST-') ||
    v.startsWith('TX-') ||
    v.startsWith('INV-TEST-') ||
    v.startsWith('EMP-P9-') ||
    v.startsWith('p9.verifier') ||
    v.startsWith('duplicate.') ||
    v.toLowerCase().includes('duplicate user')
  );
}

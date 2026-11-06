/**
 * ENTRIX ERP Formatting Utilities
 * Standardized across Indian Rupee & IST/en-IN conventions
 */

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    // Detect epoch seconds (under 100 billion, vs milliseconds at ~1.7 trillion)
    date = new Date(value < 1e11 ? value * 1000 : value);
  } else if (typeof value === 'string') {
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      date = new Date(num < 1e11 ? num * 1000 : num);
    } else {
      date = new Date(value);
    }
  } else {
    return '—';
  }

  if (isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  const dtStr = formatDateTime(value);
  if (dtStr === '—') return '—';

  const date = typeof value === 'object' && value instanceof Date ? value : new Date(value as any);
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(date);
}

/**
 * Format numeric values with en-IN separators
 */
export function formatNumber(
  value: number | string | null | undefined,
  maximumFractionDigits: number = 2
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return '0';

  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits,
  }).format(num);
}

/**
 * Format currency in Indian Rupees (₹).
 * 0 decimals unless value has paise.
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '₹0';
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return '₹0';

  const hasPaise = Math.abs(num % 1) > 0.001;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(num);
}

/**
 * Compact units (e.g. 1.2K, 3.4L, 5.6Cr)
 */
export function formatCompactUnits(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return '0';

  if (num >= 1e7) return `${(num / 1e7).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (num >= 1e5) return `${(num / 1e5).toFixed(2).replace(/\.00$/, '')} L`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1).replace(/\.0$/, '')} K`;
  return formatNumber(num, 0);
}

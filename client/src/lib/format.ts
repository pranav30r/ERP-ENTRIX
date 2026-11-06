/**
 * ENTRIX ERP Date & Time Formatting Utilities
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

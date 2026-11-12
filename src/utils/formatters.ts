export function formatCurrency(amount: number): string {
  if (amount === undefined || amount === null) return '₹0.00';
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return formatted.replace(/\s+/g, '\u00A0');
}

export function formatDate(dateString: string | Date | undefined): string {
  if (!dateString) return '-';
  let dStr = dateString;
  if (typeof dStr === 'string' && dStr.includes(' ') && !dStr.includes('Z')) {
    dStr = dStr.replace(' ', 'T') + 'Z';
  }
  const date = new Date(dStr);
  if (isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateDMY(dateString: string | Date | undefined): string {
  if (!dateString) return '-';
  let dStr = dateString;
  if (typeof dStr === 'string' && dStr.includes(' ') && !dStr.includes('Z')) {
    dStr = dStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTime(dateString: string | Date | undefined): string {
  if (!dateString) return '-';
  let dStr = dateString;
  if (typeof dStr === 'string' && dStr.includes(' ') && !dStr.includes('Z')) {
    dStr = dStr.replace(' ', 'T') + 'Z';
  }
  const date = new Date(dStr);
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export { formatNotesToPlainText } from '../../shared/utils/notesFormatter';


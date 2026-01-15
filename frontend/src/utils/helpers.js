/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Frontend Helper Utilities
 * ═══════════════════════════════════════════════════════════════
 */

import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

// ═══════════════════════════════════════════════════════════════
// DATE/TIME FORMATTING
// ═══════════════════════════════════════════════════════════════

export function formatTime(timestamp) {
  if (!timestamp) return '';
  return format(new Date(timestamp), 'HH:mm');
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  
  return format(date, 'dd MMM');
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '';
  return format(new Date(timestamp), 'dd MMM yyyy, HH:mm');
}

export function formatRelative(timestamp) {
  if (!timestamp) return '';
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

// ═══════════════════════════════════════════════════════════════
// CURRENCY FORMATTING
// ═══════════════════════════════════════════════════════════════

export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return new Intl.NumberFormat('en-IN').format(num);
}

// ═══════════════════════════════════════════════════════════════
// PHONE FORMATTING
// ═══════════════════════════════════════════════════════════════

export function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  
  return phone;
}

export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 10) return `91${digits}`;
  
  return digits;
}

// ═══════════════════════════════════════════════════════════════
// STATUS HELPERS
// ═══════════════════════════════════════════════════════════════

export function getOrderStatusColor(status) {
  const colors = {
    pending: 'badge-gray',
    confirmed: 'badge-blue',
    processing: 'badge-blue',
    shipped: 'badge-blue',
    delivered: 'badge-green',
    cancelled: 'badge-red',
    returned: 'badge-red'
  };
  return colors[status] || 'badge-gray';
}

export function getPaymentStatusColor(status) {
  const colors = {
    unpaid: 'badge-gray',
    paid: 'badge-green',
    refunded: 'badge-red',
    partial: 'badge-gold'
  };
  return colors[status] || 'badge-gray';
}

export function getChatStatusColor(status) {
  const colors = {
    open: 'badge-green',
    pending: 'badge-gold',
    resolved: 'badge-gray',
    spam: 'badge-red'
  };
  return colors[status] || 'badge-gray';
}

export function getStatusEmoji(status) {
  const emojis = {
    pending: '⏳',
    confirmed: '✅',
    processing: '⚙️',
    shipped: '🚚',
    delivered: '🎉',
    cancelled: '❌',
    returned: '↩️'
  };
  return emojis[status] || '📦';
}

// ═══════════════════════════════════════════════════════════════
// STRING HELPERS
// ═══════════════════════════════════════════════════════════════

export function truncate(str, length = 50) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════

export function isValidPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return /^(91)?[6-9]\d{9}$/.test(cleaned);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPincode(pincode) {
  return /^[1-9]\d{5}$/.test(pincode);
}

// ═══════════════════════════════════════════════════════════════
// MISC HELPERS
// ═══════════════════════════════════════════════════════════════

export function parseJSON(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function copyToClipboard(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  
  // Fallback
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  return Promise.resolve();
}

export function downloadCSV(data, filename) {
  const { headers, rows } = data;
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
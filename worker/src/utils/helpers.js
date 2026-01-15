/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - HELPER UTILITIES
 * ═══════════════════════════════════════════════════════════════
 * Complete utility functions for the entire application
 * ═══════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// ID GENERATORS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate unique order ID
 * Format: KAA-XXXXXX (6 digits)
 */
export function generateOrderId() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `KAA-${random}`;
}

/**
 * Generate broadcast ID
 * Format: BC-TIMESTAMP
 */
export function generateBroadcastId() {
  return `BC-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Generate unique session/reference ID
 */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Generate short code (for coupons, etc.)
 */
export function generateShortCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ═══════════════════════════════════════════════════════════════
// QUICK REPLY MATCHER
// ═══════════════════════════════════════════════════════════════

/**
 * Get matching quick reply for input text
 * @param {string} text - User input text
 * @param {string} lang - User language
 * @param {object} env - Environment bindings
 * @returns {object|null} - Matching quick reply or null
 */
export async function getQuickReply(text, lang, env) {
  if (!text || !env?.DB) return null;
  
  const lowerText = text.toLowerCase().trim();
  
  try {
    // Get all active quick replies, ordered by priority
    const { results: replies } = await env.DB.prepare(`
      SELECT * FROM quick_replies 
      WHERE is_active = 1 AND (language = ? OR language = 'all' OR language = 'en')
      ORDER BY priority DESC, use_count DESC
    `).bind(lang).all();

    if (!replies || replies.length === 0) return null;

    for (const reply of replies) {
      const keyword = reply.keyword.toLowerCase().trim();
      let isMatch = false;

      switch (reply.match_type) {
        case 'exact':
          isMatch = lowerText === keyword;
          break;
        case 'starts':
        case 'startswith':
          isMatch = lowerText.startsWith(keyword);
          break;
        case 'ends':
        case 'endswith':
          isMatch = lowerText.endsWith(keyword);
          break;
        case 'regex':
          try {
            isMatch = new RegExp(keyword, 'i').test(lowerText);
          } catch {
            isMatch = false;
          }
          break;
        case 'word':
          // Match whole word
          isMatch = new RegExp(`\\b${keyword}\\b`, 'i').test(lowerText);
          break;
        case 'contains':
        default:
          isMatch = lowerText.includes(keyword);
          break;
      }

      if (isMatch) {
        console.log(`[QuickReply] ✅ Matched: "${keyword}" (${reply.match_type})`);
        return reply;
      }
    }
  } catch (error) {
    console.error('[QuickReply] Error:', error.message);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// TEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Extract phone number from text
 */
export function extractPhone(text) {
  if (!text) return null;
  const match = text.match(/(?:\+91|91|0)?([6-9]\d{9})/);
  return match ? `91${match[1]}` : null;
}

/**
 * Extract pincode from text
 */
export function extractPincode(text) {
  if (!text) return null;
  const match = text.match(/\b[1-9]\d{5}\b/);
  return match ? match[0] : null;
}

/**
 * Extract email from text
 */
export function extractEmail(text) {
  if (!text) return null;
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Extract order ID from text
 * Format: KAA-XXXXXX
 */
export function extractOrderId(text) {
  if (!text) return null;
  const match = text.match(/KAA-\d{6}/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Extract tracking number from text
 */
export function extractTrackingNumber(text) {
  if (!text) return null;
  // Common AWB patterns
  const patterns = [
    /\b\d{12,14}\b/, // Delhivery, BlueDart
    /\b[A-Z]{2}\d{9}[A-Z]{2}\b/, // International
    /\bSR[A-Z0-9]{10,}\b/i, // Shiprocket
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

/**
 * Extract price from text
 */
export function extractPrice(text) {
  if (!text) return null;
  const match = text.match(/₹?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }
  return null;
}

/**
 * Extract quantity from text
 */
export function extractQuantity(text) {
  if (!text) return 1;
  const patterns = [
    /(\d+)\s*(?:pcs?|pieces?|qty|quantity|nos?|numbers?)/i,
    /(?:qty|quantity|pcs?|pieces?)[:\s]*(\d+)/i,
    /x\s*(\d+)/i,
    /(\d+)\s*x/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const qty = parseInt(match[1]);
      if (qty > 0 && qty <= 100) return qty;
    }
  }
  return 1;
}

/**
 * Extract name from text
 */
export function extractName(text) {
  if (!text) return null;
  // Remove common prefixes and clean
  let name = text.trim();
  name = name.replace(/^(hi|hello|hey|i am|i'm|my name is|name:?)\s*/i, '');
  name = name.replace(/[^\w\s]/g, '').trim();
  
  // Validate - should be at least 2 chars and max 50
  if (name.length >= 2 && name.length <= 50) {
    return name.split(' ').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// TEXT PROCESSING
// ═══════════════════════════════════════════════════════════════

/**
 * Clean and normalize text
 */
export function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, length = 100) {
  if (!text || text.length <= length) return text || '';
  return text.slice(0, length - 3) + '...';
}

/**
 * Escape special characters for regex
 */
export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert text to slug
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

/**
 * Capitalize first letter
 */
export function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Title case
 */
export function titleCase(text) {
  if (!text) return '';
  return text.split(' ').map(word => capitalize(word)).join(' ');
}

// ═══════════════════════════════════════════════════════════════
// DATE/TIME UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get current timestamp in ISO format
 */
export function now() {
  return new Date().toISOString();
}

/**
 * Get current time in IST
 */
export function getISTTime() {
  return new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
}

/**
 * Get IST date string
 */
export function getISTDateString() {
  const ist = getISTTime();
  return ist.toISOString().split('T')[0];
}

/**
 * Get IST time string (HH:MM)
 */
export function getISTTimeString() {
  const ist = getISTTime();
  return ist.toTimeString().slice(0, 5);
}

/**
 * Check if current time is within business hours (9 AM - 9 PM IST)
 */
export function isBusinessHours() {
  const ist = getISTTime();
  const hour = ist.getUTCHours();
  return hour >= 3 && hour < 15; // 3:30 UTC = 9 AM IST, 15:30 UTC = 9 PM IST
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function relativeTime(date) {
  if (!date) return '';
  
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return past.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Format date for display
 */
export function formatDate(date, format = 'short') {
  if (!date) return '';
  const d = new Date(date);
  
  switch (format) {
    case 'full':
      return d.toLocaleDateString('en-IN', { 
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
      });
    case 'long':
      return d.toLocaleDateString('en-IN', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      });
    case 'medium':
      return d.toLocaleDateString('en-IN', { 
        day: 'numeric', month: 'short', year: 'numeric' 
      });
    case 'short':
    default:
      return d.toLocaleDateString('en-IN', { 
        day: '2-digit', month: '2-digit', year: 'numeric' 
      });
  }
}

/**
 * Format time for display
 */
export function formatTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', { 
    hour: '2-digit', minute: '2-digit', hour12: true 
  });
}

/**
 * Format datetime for display
 */
export function formatDateTime(date) {
  if (!date) return '';
  return `${formatDate(date, 'medium')} ${formatTime(date)}`;
}

/**
 * Check if date is today
 */
export function isToday(date) {
  if (!date) return false;
  const today = new Date();
  const d = new Date(date);
  return d.toDateString() === today.toDateString();
}

/**
 * Check if date is yesterday
 */
export function isYesterday(date) {
  if (!date) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(date);
  return d.toDateString() === yesterday.toDateString();
}

/**
 * Add days to date
 */
export function addDays(date, days) {
  const result = new Date(date || new Date());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add hours to date
 */
export function addHours(date, hours) {
  const result = new Date(date || new Date());
  result.setTime(result.getTime() + (hours * 60 * 60 * 1000));
  return result;
}

/**
 * Get start of day
 */
export function startOfDay(date) {
  const d = new Date(date || new Date());
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day
 */
export function endOfDay(date) {
  const d = new Date(date || new Date());
  d.setHours(23, 59, 59, 999);
  return d;
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Validate Indian phone number
 */
export function isValidIndianPhone(phone) {
  if (!phone) return false;
  const cleaned = phone.toString().replace(/\D/g, '');
  return /^(91)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Validate pincode
 */
export function isValidPincode(pincode) {
  if (!pincode) return false;
  return /^[1-9]\d{5}$/.test(pincode);
}

/**
 * Validate email
 */
export function isValidEmail(email) {
  if (!email) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * Validate order ID
 */
export function isValidOrderId(orderId) {
  if (!orderId) return false;
  return /^KAA-\d{6}$/.test(orderId);
}

/**
 * Validate URL
 */
export function isValidUrl(url) {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// NUMBER FORMATTING
// ═══════════════════════════════════════════════════════════════

/**
 * Format currency (INR)
 */
export function formatCurrency(amount, showSymbol = true) {
  if (amount === null || amount === undefined) return '';
  
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
  
  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Format number with commas (Indian style)
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '';
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Format compact number (e.g., 1.2K, 3.4M)
 */
export function formatCompactNumber(num) {
  if (num === null || num === undefined) return '';
  return new Intl.NumberFormat('en-IN', { 
    notation: 'compact', 
    compactDisplay: 'short' 
  }).format(num);
}

/**
 * Calculate percentage
 */
export function percentage(part, total, decimals = 0) {
  if (!total || total === 0) return 0;
  const pct = (part / total) * 100;
  return decimals > 0 ? pct.toFixed(decimals) : Math.round(pct);
}

/**
 * Round to decimal places
 */
export function round(num, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

// ═══════════════════════════════════════════════════════════════
// SHIPPING CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate shipping cost
 */
export function calculateShipping(orderTotal, pincode = '') {
  // Free shipping above ₹498
  if (orderTotal >= 498) {
    return 0;
  }
  
  // Remote area surcharge (example pincodes)
  const remotePincodes = ['110001', '400001']; // Add more as needed
  if (remotePincodes.includes(pincode)) {
    return 99;
  }
  
  // Standard shipping
  return 49;
}

/**
 * Estimate delivery date (3-5 business days)
 */
export function estimateDelivery(orderDate = new Date(), minDays = 3, maxDays = 5) {
  const date = new Date(orderDate);
  let daysToAdd = minDays + Math.floor(Math.random() * (maxDays - minDays + 1));
  
  // Skip weekends (Sundays)
  while (daysToAdd > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) { // Skip Sunday
      daysToAdd--;
    }
  }
  
  return date;
}

/**
 * Get delivery date range string
 */
export function getDeliveryDateRange(orderDate = new Date()) {
  const minDate = estimateDelivery(orderDate, 3, 3);
  const maxDate = estimateDelivery(orderDate, 5, 5);
  
  const formatOpts = { day: 'numeric', month: 'short' };
  return `${minDate.toLocaleDateString('en-IN', formatOpts)} - ${maxDate.toLocaleDateString('en-IN', formatOpts)}`;
}

// ═══════════════════════════════════════════════════════════════
// DISCOUNT CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Discount codes configuration
 */
const DISCOUNT_CODES = {
  'WELCOME10': { type: 'percent', value: 10, minOrder: 299, maxDiscount: 100, description: '10% off on first order' },
  'FLAT50': { type: 'flat', value: 50, minOrder: 499, description: '₹50 off on orders above ₹499' },
  'KAAPAV20': { type: 'percent', value: 20, minOrder: 999, maxDiscount: 300, description: '20% off up to ₹300' },
  'FREESHIP': { type: 'shipping', value: 0, minOrder: 0, description: 'Free shipping on any order' },
  'DIWALI25': { type: 'percent', value: 25, minOrder: 599, maxDiscount: 250, description: 'Diwali special 25% off' },
};

/**
 * Apply discount code
 */
export function applyDiscount(total, discountCode) {
  if (!discountCode) {
    return { valid: false, error: 'No discount code provided' };
  }

  const code = discountCode.toUpperCase().trim();
  const discount = DISCOUNT_CODES[code];
  
  if (!discount) {
    return { valid: false, error: 'Invalid discount code' };
  }

  if (total < discount.minOrder) {
    return { 
      valid: false, 
      error: `Minimum order ₹${discount.minOrder} required for this code` 
    };
  }

  let discountAmount = 0;
  
  if (discount.type === 'percent') {
    discountAmount = Math.round(total * (discount.value / 100));
    if (discount.maxDiscount) {
      discountAmount = Math.min(discountAmount, discount.maxDiscount);
    }
  } else if (discount.type === 'flat') {
    discountAmount = discount.value;
  } else if (discount.type === 'shipping') {
    // Handle separately
    discountAmount = 0;
  }

  return {
    valid: true,
    code: code,
    discountAmount,
    discountType: discount.type,
    discountValue: discount.value,
    description: discount.description,
    freeShipping: discount.type === 'shipping'
  };
}

/**
 * Get all available discount codes (for display)
 */
export function getAvailableDiscounts() {
  return Object.entries(DISCOUNT_CODES).map(([code, details]) => ({
    code,
    ...details
  }));
}

// ═══════════════════════════════════════════════════════════════
// ARRAY & OBJECT UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Chunk array into smaller arrays
 */
export function chunk(array, size) {
  if (!array || size <= 0) return [];
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffle(array) {
  if (!array) return [];
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Get unique values from array
 */
export function unique(array, key = null) {
  if (!array) return [];
  if (key) {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
  return [...new Set(array)];
}

/**
 * Group array by key
 */
export function groupBy(array, key) {
  if (!array) return {};
  return array.reduce((groups, item) => {
    const value = typeof key === 'function' ? key(item) : item[key];
    (groups[value] = groups[value] || []).push(item);
    return groups;
  }, {});
}

/**
 * Sort array by key
 */
export function sortBy(array, key, order = 'asc') {
  if (!array) return [];
  return [...array].sort((a, b) => {
    const aVal = typeof key === 'function' ? key(a) : a[key];
    const bVal = typeof key === 'function' ? key(b) : b[key];
    if (order === 'desc') return bVal > aVal ? 1 : -1;
    return aVal > bVal ? 1 : -1;
  });
}

/**
 * Safe JSON parse
 */
export function safeJsonParse(str, defaultValue = null) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

/**
 * Safe JSON stringify
 */
export function safeJsonStringify(obj, fallback = '{}') {
  try {
    return JSON.stringify(obj);
  } catch {
    return fallback;
  }
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects deeply
 */
export function deepMerge(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

/**
 * Check if value is object
 */
export function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Remove undefined/null values from object
 */
export function cleanObject(obj) {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null && v !== '')
  );
}

/**
 * Pick specific keys from object
 */
export function pick(obj, keys) {
  if (!obj) return {};
  return keys.reduce((acc, key) => {
    if (key in obj) acc[key] = obj[key];
    return acc;
  }, {});
}

/**
 * Omit specific keys from object
 */
export function omit(obj, keys) {
  if (!obj) return {};
  const keysSet = new Set(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keysSet.has(key))
  );
}

// ═══════════════════════════════════════════════════════════════
// DELAY & RETRY
// ═══════════════════════════════════════════════════════════════

/**
 * Delay execution
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries - 1) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        await delay(waitTime);
      }
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper
 */
export function withTimeout(promise, ms, message = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(message)), ms)
    )
  ]);
}

// ═══════════════════════════════════════════════════════════════
// HASHING & ENCODING
// ═══════════════════════════════════════════════════════════════

/**
 * Simple hash function (for non-crypto purposes)
 */
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Base64 encode
 */
export function base64Encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Base64 decode
 */
export function base64Decode(str) {
  return decodeURIComponent(escape(atob(str)));
}

// ═══════════════════════════════════════════════════════════════
// LOGGING & DEBUGGING
// ═══════════════════════════════════════════════════════════════

/**
 * Structured logger
 */
export function log(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
  
  const output = JSON.stringify(logEntry);
  
  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'debug':
      console.debug(output);
      break;
    case 'info':
    default:
      console.log(output);
  }
  
  return logEntry;
}

/**
 * Performance timer
 */
export function createTimer(label) {
  const start = Date.now();
  return {
    elapsed: () => Date.now() - start,
    log: () => console.log(`[Timer] ${label}: ${Date.now() - start}ms`)
  };
}

// ═══════════════════════════════════════════════════════════════
// SENTIMENT KEYWORDS (for basic sentiment analysis)
// ═══════════════════════════════════════════════════════════════

const POSITIVE_WORDS = ['thanks', 'thank you', 'great', 'awesome', 'love', 'amazing', 'perfect', 'excellent', 'wonderful', 'happy', 'good', 'nice', 'beautiful', 'lovely', 'best'];
const NEGATIVE_WORDS = ['bad', 'terrible', 'worst', 'hate', 'angry', 'disappointed', 'poor', 'awful', 'horrible', 'complaint', 'refund', 'return', 'problem', 'issue', 'wrong', 'damaged', 'broken', 'fake', 'fraud'];

/**
 * Simple sentiment analysis
 */
export function analyzeSentiment(text) {
  if (!text) return 'neutral';
  
  const lower = text.toLowerCase();
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  POSITIVE_WORDS.forEach(word => {
    if (lower.includes(word)) positiveScore++;
  });
  
  NEGATIVE_WORDS.forEach(word => {
    if (lower.includes(word)) negativeScore++;
  });
  
  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

/**
 * Detect message intent
 */
export function detectIntent(text) {
  if (!text) return 'unknown';
  
  const lower = text.toLowerCase();
  
  const intents = {
    order: ['order', 'buy', 'purchase', 'want', 'need', 'get', 'checkout'],
    track: ['track', 'status', 'where', 'shipping', 'delivery', 'awb'],
    payment: ['pay', 'payment', 'upi', 'card', 'razorpay'],
    support: ['help', 'support', 'issue', 'problem', 'complaint'],
    return: ['return', 'refund', 'exchange', 'cancel'],
    inquiry: ['price', 'cost', 'available', 'stock', 'info', 'details'],
    greeting: ['hi', 'hello', 'hey', 'good morning', 'good evening'],
    thanks: ['thanks', 'thank you', 'thx', 'appreciated']
  };
  
  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return intent;
    }
  }
  
  return 'unknown';
}
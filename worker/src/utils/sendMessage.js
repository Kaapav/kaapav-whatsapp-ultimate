/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - MESSAGE SENDER UTILITIES (ENHANCED v2.1)
 * ═══════════════════════════════════════════════════════════════
 * BASED ON YOUR ORIGINAL sendMessage.js - FULLY PRESERVED
 * 
 * ENHANCEMENTS:
 * ✅ Retry logic with exponential backoff
 * ✅ Better error categorization
 * ✅ Rate limit awareness
 * ✅ Response time tracking
 * ✅ Batch sending support
 * ✅ Message formatting helpers
 * ✅ Flow message support
 * ✅ Media by ID support
 * 
 * UNCHANGED:
 * ✅ All original functions
 * ✅ All original logic
 * ✅ All original structure
 * ✅ All original menus
 * ═══════════════════════════════════════════════════════════════
 */

import { fromEnglish } from './translate.js';

// ═══════════════════════════════════════════════════════════════
// DEEP LINKS (YOUR LINKS - PRESERVED EXACTLY)
// ═══════════════════════════════════════════════════════════════

export const LINKS = {
  website: "https://www.kaapav.com",
  whatsappCatalog: "https://wa.me/c/919148330016",
  waMeChat: "https://wa.me/919148330016",
  offersBestsellers: "https://www.kaapav.com/shop/category/all-jewellery-12?category=12&search=&order=&tags=16",
  payment: "https://razorpay.me/@kaapav",
  shiprocket: "https://www.shiprocket.in/shipment-tracking/",
  googleReview: "https://g.page/r/CaGZJvP_W_uLEBM/review",
  facebook: "https://www.facebook.com/kaapavfashionjewellery/",
  instagram: "https://www.instagram.com/kaapavfashionjewellery/",
};

// ═══════════════════════════════════════════════════════════════
// CONSTANTS (ENHANCED)
// ═══════════════════════════════════════════════════════════════

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_TEXT_LENGTH = 4096;
const MAX_CAPTION_LENGTH = 1024;
const MAX_BUTTON_TITLE_LENGTH = 20;
const MAX_BUTTONS = 3;
const MAX_LIST_ROWS = 10;
const MAX_LIST_SECTIONS = 10;

// Error codes that should trigger retry
const RETRYABLE_ERROR_CODES = [
  130429, // Rate limit exceeded
  131026, // Message failed to send
  131047, // Re-engagement message required (sometimes transient)
  500,    // Internal server error
  503,    // Service unavailable
];

// ═══════════════════════════════════════════════════════════════
// PHONE NORMALIZATION (YOUR LOGIC - PRESERVED)
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize Indian numbers into WhatsApp format (91XXXXXXXXXX)
 * YOUR ORIGINAL FUNCTION - PRESERVED
 */
export function normalizeIN(phone) {
  if (!phone) return '';
  const digits = phone.toString().replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Validate phone number format (ENHANCED)
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const normalized = normalizeIN(phone);
  return /^91\d{10}$/.test(normalized);
}

// ═══════════════════════════════════════════════════════════════
// TEXT FORMATTING HELPERS (ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Format text as bold
 */
export function bold(text) {
  return `*${text}*`;
}

/**
 * Format text as italic
 */
export function italic(text) {
  return `_${text}_`;
}

/**
 * Format text as strikethrough
 */
export function strike(text) {
  return `~${text}~`;
}

/**
 * Format text as monospace/code
 */
export function code(text) {
  return `\`\`\`${text}\`\`\``;
}

/**
 * Format currency (INR)
 */
export function formatCurrency(amount, currency = 'INR') {
  if (currency === 'INR') {
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  }
  return `${currency} ${Number(amount).toLocaleString()}`;
}

/**
 * Format date for display
 */
export function formatDate(date, format = 'short') {
  const d = date instanceof Date ? date : new Date(date);
  
  if (format === 'short') {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  if (format === 'long') {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (format === 'time') {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toISOString();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Sanitize text input
 */
export function sanitize(text, maxLength = MAX_TEXT_LENGTH) {
  if (!text) return '';
  return String(text).trim().slice(0, maxLength);
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION HELPER (YOUR LOGIC - PRESERVED)
// ═══════════════════════════════════════════════════════════════

function getConfig(env) {
  const phoneId = env?.WA_PHONE_ID || env?.WHATSAPP_PHONE_NUMBER_ID || '';
  const token = env?.WA_TOKEN || env?.WHATSAPP_ACCESS_TOKEN || env?.WA_ACCESS_TOKEN || '';
  const apiVersion = env?.GRAPH_API_VERSION || 'v21.0';
  const catalogId = env?.CATALOG_ID || '';
  
  return {
    phoneId: phoneId.trim(),
    token: token.trim(),
    apiVersion,
    catalogId,
    apiUrl: `https://graph.facebook.com/${apiVersion}/${phoneId.trim()}/messages`
  };
}

// ═══════════════════════════════════════════════════════════════
// TELEMETRY HELPERS (YOUR LOGIC - PRESERVED & ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Append to Google Sheets (non-blocking)
 * YOUR ORIGINAL - PRESERVED
 */
async function appendToSheets(values, env) {
  if (!env?.GOOGLE_SHEETS_API_KEY || !env?.GOOGLE_SHEET_ID) return;
  
  try {
    const sheetTab = env.GOOGLE_SHEET_TAB || 'WhatsAppLogs';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${sheetTab}!A1:append?valueInputOption=USER_ENTERED&key=${env.GOOGLE_SHEETS_API_KEY}`;
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [values] })
    });
  } catch (e) {
    console.warn('[Sheets] Append failed:', e.message);
  }
}

/**
 * Post to n8n webhook (non-blocking)
 * YOUR ORIGINAL - PRESERVED
 */
async function postToN8n(event, payload, env) {
  if (!env?.N8N_WEBHOOK_URL) return;
  
  try {
    await fetch(env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload, ts: Date.now() })
    });
  } catch (e) {
    console.warn('[n8n] Post failed:', e.message);
  }
}

/**
 * Log to database analytics
 * YOUR ORIGINAL - PRESERVED
 */
async function logAnalytics(eventType, phone, data, env) {
  if (!env?.DB) return;
  
  try {
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, timestamp)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(eventType, data?.event_name || eventType, phone, JSON.stringify(data)).run();
  } catch (e) {
    console.warn('[Analytics] Log failed:', e.message);
  }
}

/**
 * Log message to database (ENHANCED)
 */
async function logOutgoingMessage(phone, text, type, messageId, env) {
  if (!env?.DB) return;
  
  try {
    await env.DB.prepare(`
      INSERT INTO messages (phone, text, direction, message_type, message_id, timestamp, created_at)
      VALUES (?, ?, 'outgoing', ?, ?, datetime('now'), datetime('now'))
    `).bind(phone, sanitize(text, 1000), type, messageId || null).run();
    
    // Update chat
    await env.DB.prepare(`
      UPDATE chats SET 
        last_message = ?,
        last_message_type = ?,
        last_timestamp = datetime('now'),
        last_direction = 'outgoing',
        total_messages = total_messages + 1,
        last_agent_message_at = datetime('now'),
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(sanitize(text, 500), type, phone).run();
  } catch (e) {
    console.warn('[DB] Log outgoing failed:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// RETRY LOGIC (ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error, responseData) {
  // Check error code in response
  const errorCode = responseData?.error?.code;
  if (errorCode && RETRYABLE_ERROR_CODES.includes(errorCode)) {
    return true;
  }
  
  // Check for network errors
  if (error?.message?.includes('fetch failed') || 
      error?.message?.includes('network') ||
      error?.message?.includes('timeout')) {
    return true;
  }
  
  return false;
}

/**
 * Execute with retry logic
 */
async function withRetry(fn, maxRetries = MAX_RETRIES, delayMs = RETRY_DELAY_MS) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt < maxRetries && isRetryableError(error, error.responseData)) {
        const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        break;
      }
    }
  }
  
  throw lastError;
}

// ═══════════════════════════════════════════════════════════════
// CORE API SENDER (YOUR LOGIC - PRESERVED & ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Send request to WhatsApp Cloud API
 * YOUR sendAPIRequest - PRESERVED with enhancements
 */
export async function sendAPIRequest(payload, env, options = {}) {
  const config = getConfig(env);
  const startTime = Date.now();
  const { retry = true, logMessage = true } = options;
  
  // Debug log for every API call (YOUR LOGIC)
  console.log('[sendAPIRequest] Attempting to send:', {
    to: payload?.to,
    type: payload?.type,
    phoneId: config.phoneId,
    apiUrl: config.apiUrl,
    tokenExists: !!config.token,
    tokenLength: config.token?.length || 0
  });

  // Check for missing credentials (YOUR LOGIC)
  if (!config.token || !config.phoneId) {
    const meta = { 
      tokenLen: config.token?.length || 0, 
      phoneId: config.phoneId,
      error: 'Missing WhatsApp credentials'
    };
    
    console.error('[sendAPIRequest] ⚠️ Config missing:', meta);
    
    // Log error to analytics
    await logAnalytics('api_error', payload?.to, { 
      type: 'CONFIG_MISSING', 
      details: meta 
    }, env);
    
    throw new Error(`wa_config_missing:${JSON.stringify(meta)}`);
  }

  // Wrap in retry logic (ENHANCED)
  const executeRequest = async () => {
    try {
      // Log the full request details (YOUR LOGIC)
      console.log('[sendAPIRequest] Full payload:', JSON.stringify(payload, null, 2));
      console.log('[sendAPIRequest] API URL:', config.apiUrl);
      
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${config.token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      // Check for API errors
      if (result.error) {
        console.error('[sendAPIRequest] ❌ API Error:', result.error);
        
        const errorDetails = {
          message: result.error.message,
          code: result.error.code,
          type: result.error.type,
          fbtrace_id: result.error.fbtrace_id
        };
        
        // Log error (YOUR LOGIC)
        await appendToSheets([
          new Date().toISOString(),
          'ERROR',
          payload?.to || '',
          payload?.type || '',
          JSON.stringify(errorDetails).slice(0, 500),
        ], env);
        
        const error = new Error(`WhatsApp API Error: ${result.error.message}`);
        error.code = result.error.code;
        error.responseData = result;
        throw error;
      }

      // Calculate response time (ENHANCED)
      const responseTime = Date.now() - startTime;

      // Success logging (YOUR LOGIC)
      console.log('[sendAPIRequest] ✅ SUCCESS! Response:', {
        status: response.status,
        messageId: result?.messages?.[0]?.id,
        to: payload.to,
        responseTime: `${responseTime}ms`
      });

      // Telemetry - non-blocking (YOUR LOGIC)
      appendToSheets([
        new Date().toISOString(),
        'OUT',
        payload?.to || '',
        payload?.type || '',
        JSON.stringify(payload).slice(0, 500),
      ], env).catch(() => {});
      
      postToN8n('wa_outgoing', payload, env).catch(() => {});
      
      logAnalytics('message_out', payload?.to, { 
        type: payload?.type,
        messageId: result?.messages?.[0]?.id,
        responseTime
      }, env).catch(() => {});

      // Log to messages table (ENHANCED)
      if (logMessage) {
        const messageText = payload?.text?.body || 
                           payload?.interactive?.body?.text ||
                           payload?.template?.name ||
                           `[${payload?.type}]`;
        logOutgoingMessage(
          payload?.to, 
          messageText, 
          payload?.type, 
          result?.messages?.[0]?.id, 
          env
        ).catch(() => {});
      }

      return result;
      
    } catch (err) {
      // Detailed error information (YOUR LOGIC - ENHANCED)
      const errorDetails = {
        message: err.message,
        code: err.code,
        responseTime: Date.now() - startTime,
        request: {
          url: config.apiUrl,
          to: payload?.to,
          type: payload?.type,
          phoneId: config.phoneId,
          tokenLength: config.token?.length || 0
        }
      };
      
      // Log to backend console with full details (YOUR LOGIC)
      console.error('=====================================');
      console.error('[sendAPIRequest] WHATSAPP API ERROR');
      console.error('=====================================');
      console.error('Error Message:', errorDetails.message);
      console.error('Error Code:', errorDetails.code);
      console.error('Request URL:', errorDetails.request.url);
      console.error('Request To:', errorDetails.request.to);
      console.error('Request Type:', errorDetails.request.type);
      console.error('Response Time:', `${errorDetails.responseTime}ms`);
      console.error('=====================================');
      
      // Log to sheets even on error (YOUR LOGIC)
      await appendToSheets([
        new Date().toISOString(),
        'ERROR',
        payload?.to || '',
        payload?.type || '',
        JSON.stringify(errorDetails).slice(0, 500),
      ], env).catch(() => {});
      
      // Log to analytics
      await logAnalytics('api_error', payload?.to, {
        type: 'WHATSAPP_API_ERROR',
        error: errorDetails
      }, env).catch(() => {});
      
      // Re-throw with more context
      const enhancedError = new Error(`WhatsApp API failed: ${err.message}`);
      enhancedError.details = errorDetails;
      enhancedError.code = err.code;
      enhancedError.responseData = err.responseData;
      throw enhancedError;
    }
  };

  // Execute with or without retry
  if (retry) {
    return withRetry(executeRequest, MAX_RETRIES, RETRY_DELAY_MS);
  }
  return executeRequest();
}

// ═══════════════════════════════════════════════════════════════
// TEXT MESSAGE (YOUR LOGIC - PRESERVED)
// ═══════════════════════════════════════════════════════════════

export async function sendText(to, text, env, options = {}) {
  const payload = { 
    messaging_product: 'whatsapp', 
    to: normalizeIN(to), 
    type: 'text', 
    text: { 
      body: sanitize(text, MAX_TEXT_LENGTH),
      preview_url: options.previewUrl !== false // Enable link preview by default
    } 
  };
  return sendAPIRequest(payload, env, options);
}

export async function sendLocalizedText(to, text, lang = 'en', env, options = {}) {
  const localized = await fromEnglish(text, lang);
  return sendText(to, localized, env, options);
}

export async function sendTextWithLinks(to, text, env, options = {}) {
  return sendText(to, text, env, { ...options, previewUrl: true });
}

/**
 * Send text with typing indicator (ENHANCED)
 */
export async function sendTextWithTyping(to, text, env, typingDelayMs = 1000) {
  // Note: WhatsApp Cloud API doesn't support typing indicators directly
  // This is a placeholder for future implementation or webhooks
  await sleep(typingDelayMs);
  return sendText(to, text, env);
}

// ═══════════════════════════════════════════════════════════════
// REPLY BUTTONS (YOUR LOGIC - PRESERVED EXACTLY)
// ═══════════════════════════════════════════════════════════════

/**
 * Send reply buttons (WhatsApp supports up to 3 quick reply buttons)
 * YOUR ORIGINAL FUNCTION - PRESERVED
 */
export async function sendReplyButtons(to, bodyText, buttons /* [{id,title}] max 3 */, env, footer = '', options = {}) {
  const normalizedTo = normalizeIN(to);
  
  if (!buttons || !buttons.length) {
    return sendText(normalizedTo, bodyText, env, options);
  }
  
  // WhatsApp max 3 buttons (YOUR LOGIC)
  if (buttons.length > MAX_BUTTONS) buttons = buttons.slice(0, MAX_BUTTONS);
  
  const waButtons = buttons.map((b) => ({
    type: 'reply',
    reply: { 
      id: String(b.id).slice(0, 256), 
      title: String(b.title).slice(0, MAX_BUTTON_TITLE_LENGTH) 
    },
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: sanitize(bodyText, MAX_TEXT_LENGTH) },
      action: { buttons: waButtons },
    },
  };
  
  if (footer) {
    payload.interactive.footer = { text: footer.slice(0, 60) };
  }

  // Add header if provided (ENHANCED)
  if (options.header) {
    payload.interactive.header = options.header;
  }
  
  return sendAPIRequest(payload, env, options);
}

/**
 * Send reply buttons with image header (ENHANCED)
 */
export async function sendReplyButtonsWithImage(to, imageUrl, bodyText, buttons, env, footer = '') {
  return sendReplyButtons(to, bodyText, buttons, env, footer, {
    header: {
      type: 'image',
      image: { link: imageUrl }
    }
  });
}

/**
 * Send reply buttons with document header (ENHANCED)
 */
export async function sendReplyButtonsWithDocument(to, documentUrl, filename, bodyText, buttons, env, footer = '') {
  return sendReplyButtons(to, bodyText, buttons, env, footer, {
    header: {
      type: 'document',
      document: { link: documentUrl, filename }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// CTA URL (YOUR LOGIC - PRESERVED EXACTLY)
// ═══════════════════════════════════════════════════════════════

/**
 * CTA url interactive (send text first to ensure a tappable URL)
 * YOUR ORIGINAL FUNCTION - PRESERVED
 */
export async function sendCtaUrl(to, bodyText, displayText, url, env, footer = '', options = {}) {
  const normalizedTo = normalizeIN(to);
  
  // Send text first to ensure a tappable URL (YOUR LOGIC)
  await sendText(normalizedTo, `${bodyText}\n\n🔗 ${displayText}: ${url}`, env, { ...options, logMessage: false });
  
  // Try interactive CTA button
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: sanitize(bodyText, MAX_TEXT_LENGTH) },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: displayText.slice(0, MAX_BUTTON_TITLE_LENGTH),
          url: url
        }
      }
    },
  };
  
  if (footer) {
    payload.interactive.footer = { text: footer.slice(0, 60) };
  }
  
  try {
    return await sendAPIRequest(payload, env, { ...options, retry: false });
  } catch {
    // Best-effort: text already sent (YOUR LOGIC)
    return { ok: true, note: 'cta_url_fallback_to_text' };
  }
}

/**
 * Send multiple CTA buttons (ENHANCED)
 */
export async function sendMultipleCtaUrls(to, bodyText, ctaButtons /* [{displayText, url}] */, env, footer = '') {
  const normalizedTo = normalizeIN(to);
  
  // Build text with all links
  let linksText = bodyText + '\n';
  ctaButtons.forEach((cta, i) => {
    linksText += `\n${i + 1}️⃣ ${cta.displayText}: ${cta.url}`;
  });
  
  return sendText(normalizedTo, linksText, env);
}

// ═══════════════════════════════════════════════════════════════
// LIST MESSAGE (YOUR LOGIC - ENHANCED)
// ═══════════════════════════════════════════════════════════════

export async function sendListMessage(to, bodyText, buttonText, sections, env, footer = '', options = {}) {
  const normalizedTo = normalizeIN(to);
  
  // Validate and format sections (ENHANCED)
  const formattedSections = sections.slice(0, MAX_LIST_SECTIONS).map(section => ({
    title: sanitize(section.title, 24),
    rows: section.rows.slice(0, MAX_LIST_ROWS).map(row => ({
      id: String(row.id).slice(0, 200),
      title: sanitize(row.title, 24),
      description: sanitize(row.description || '', 72)
    }))
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: sanitize(bodyText, MAX_TEXT_LENGTH) },
      action: {
        button: buttonText.slice(0, MAX_BUTTON_TITLE_LENGTH),
        sections: formattedSections
      }
    }
  };
  
  if (footer) {
    payload.interactive.footer = { text: footer.slice(0, 60) };
  }

  // Add header if provided (ENHANCED)
  if (options.header) {
    payload.interactive.header = options.header;
  }
  
  return sendAPIRequest(payload, env, options);
}

// Alias for backwards compatibility
export const sendList = sendListMessage;

// ═══════════════════════════════════════════════════════════════
// MEDIA MESSAGES (YOUR LOGIC - ENHANCED)
// ═══════════════════════════════════════════════════════════════

export async function sendImage(to, imageUrl, caption = '', env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'image',
    image: {
      link: imageUrl,
      caption: sanitize(caption, MAX_CAPTION_LENGTH)
    }
  };
  return sendAPIRequest(payload, env, options);
}

/**
 * Send image by media ID (ENHANCED)
 */
export async function sendImageById(to, mediaId, caption = '', env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'image',
    image: {
      id: mediaId,
      caption: sanitize(caption, MAX_CAPTION_LENGTH)
    }
  };
  return sendAPIRequest(payload, env, options);
}

export async function sendVideo(to, videoUrl, caption = '', env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'video',
    video: {
      link: videoUrl,
      caption: sanitize(caption, MAX_CAPTION_LENGTH)
    }
  };
  return sendAPIRequest(payload, env, options);
}

/**
 * Send video by media ID (ENHANCED)
 */
export async function sendVideoById(to, mediaId, caption = '', env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'video',
    video: {
      id: mediaId,
      caption: sanitize(caption, MAX_CAPTION_LENGTH)
    }
  };
  return sendAPIRequest(payload, env, options);
}

export async function sendDocument(to, documentUrl, filename, caption = '', env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'document',
    document: {
      link: documentUrl,
      filename: filename || 'document',
      caption: sanitize(caption, MAX_CAPTION_LENGTH)
    }
  };
  return sendAPIRequest(payload, env, options);
}

/**
 * Send document by media ID (ENHANCED)
 */
export async function sendDocumentById(to, mediaId, filename, caption = '', env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'document',
    document: {
      id: mediaId,
      filename: filename || 'document',
      caption: sanitize(caption, MAX_CAPTION_LENGTH)
    }
  };
  return sendAPIRequest(payload, env, options);
}

export async function sendAudio(to, audioUrl, env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'audio',
    audio: { link: audioUrl }
  };
  return sendAPIRequest(payload, env, options);
}

/**
 * Send audio by media ID (ENHANCED)
 */
export async function sendAudioById(to, mediaId, env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'audio',
    audio: { id: mediaId }
  };
  return sendAPIRequest(payload, env, options);
}

export async function sendSticker(to, stickerUrl, env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'sticker',
    sticker: { link: stickerUrl }
  };
  return sendAPIRequest(payload, env, options);
}

/**
 * Send sticker by media ID (ENHANCED)
 */
export async function sendStickerById(to, mediaId, env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'sticker',
    sticker: { id: mediaId }
  };
  return sendAPIRequest(payload, env, options);
}

export async function sendLocation(to, latitude, longitude, name = '', address = '', env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'location',
    location: {
      latitude: latitude,
      longitude: longitude,
      name: name,
      address: address
    }
  };
  return sendAPIRequest(payload, env, options);
}

export async function sendContacts(to, contacts, env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'contacts',
    contacts: contacts
  };
  return sendAPIRequest(payload, env, options);
}

/**
 * Send a single contact (ENHANCED)
 */
export async function sendContact(to, name, phone, email = '', env, options = {}) {
  const contact = {
    name: {
      formatted_name: name,
      first_name: name.split(' ')[0],
      last_name: name.split(' ').slice(1).join(' ') || ''
    },
    phones: [{ phone: phone, type: 'CELL' }]
  };
  
  if (email) {
    contact.emails = [{ email: email, type: 'WORK' }];
  }
  
  return sendContacts(to, [contact], env, options);
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE MESSAGES (YOUR LOGIC - ENHANCED)
// ═══════════════════════════════════════════════════════════════

export async function sendTemplate(to, templateName, languageCode = 'en', components = [], env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components
    }
  };
  return sendAPIRequest(payload, env, options);
}

/**
 * Send template with text parameters only (ENHANCED)
 */
export async function sendTemplateWithParams(to, templateName, params = [], languageCode = 'en', env, options = {}) {
  const bodyComponent = {
    type: 'body',
    parameters: params.map(p => ({ type: 'text', text: String(p) }))
  };
  
  return sendTemplate(to, templateName, languageCode, [bodyComponent], env, options);
}

/**
 * Send template with header image (ENHANCED)
 */
export async function sendTemplateWithImage(to, templateName, imageUrl, bodyParams = [], languageCode = 'en', env, options = {}) {
  const components = [
    {
      type: 'header',
      parameters: [{ type: 'image', image: { link: imageUrl } }]
    }
  ];
  
  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map(p => ({ type: 'text', text: String(p) }))
    });
  }
  
  return sendTemplate(to, templateName, languageCode, components, env, options);
}

/**
 * Send order confirmation template
 * YOUR ORIGINAL - PRESERVED
 */
export async function sendOrderConfirmationTemplate(to, orderId, total, env, options = {}) {
  return sendTemplate(to, 'order_confirmation', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: orderId },
        { type: 'currency', currency: { code: 'INR', amount_1000: Math.round(total * 1000), fallback_value: formatCurrency(total) } }
      ]
    }
  ], env, options);
}

/**
 * Send shipping update template
 * YOUR ORIGINAL - PRESERVED
 */
export async function sendShippingTemplate(to, orderId, trackingUrl, env, options = {}) {
  return sendTemplate(to, 'shipping_update', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: orderId },
        { type: 'text', text: trackingUrl }
      ]
    }
  ], env, options);
}

/**
 * Send payment reminder template (ENHANCED)
 */
export async function sendPaymentReminderTemplate(to, orderId, amount, paymentLink, env, options = {}) {
  return sendTemplate(to, 'payment_reminder', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: orderId },
        { type: 'currency', currency: { code: 'INR', amount_1000: Math.round(amount * 1000), fallback_value: formatCurrency(amount) } }
      ]
    },
    {
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [{ type: 'text', text: paymentLink }]
    }
  ], env, options);
}

/**
 * Send delivery confirmation template (ENHANCED)
 */
export async function sendDeliveryConfirmationTemplate(to, orderId, deliveryDate, env, options = {}) {
  return sendTemplate(to, 'delivery_confirmation', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: orderId },
        { type: 'text', text: formatDate(deliveryDate, 'long') }
      ]
    }
  ], env, options);
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT MESSAGES (CATALOG) - YOUR LOGIC + ENHANCED
// ═══════════════════════════════════════════════════════════════

export async function sendProduct(to, productRetailerId, bodyText = '', env, options = {}) {
  const config = getConfig(env);
  
  if (!config.catalogId) {
    console.warn('[sendProduct] No CATALOG_ID configured, sending catalog link');
    return sendCtaUrl(
      to, 
      bodyText || '✨ Check out our beautiful collection!',
      '📱 View Catalog',
      LINKS.whatsappCatalog,
      env
    );
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'interactive',
    interactive: {
      type: 'product',
      body: { text: sanitize(bodyText || '✨ Check out this beautiful piece!', MAX_TEXT_LENGTH) },
      footer: { text: 'Tap to view details 💎' },
      action: {
        catalog_id: config.catalogId,
        product_retailer_id: productRetailerId
      }
    }
  };
  return sendAPIRequest(payload, env, options);
}

export async function sendProductList(to, sections, headerText = '', bodyText = '', env, options = {}) {
  const config = getConfig(env);
  
  if (!config.catalogId) {
    console.warn('[sendProductList] No CATALOG_ID configured');
    return sendCtaUrl(to, bodyText || 'Browse our catalog', '📱 Catalogue', LINKS.whatsappCatalog, env);
  }

  const formattedSections = sections.map(section => ({
    title: sanitize(section.title, 24),
    product_items: section.products.slice(0, 30).map(p => ({
      product_retailer_id: typeof p === 'string' ? p : p.product_retailer_id
    }))
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'interactive',
    interactive: {
      type: 'product_list',
      header: { type: 'text', text: sanitize(headerText || '💎 KAAPAV Collection', 60) },
      body: { text: sanitize(bodyText || 'Browse our exclusive designs', MAX_TEXT_LENGTH) },
      footer: { text: 'Free shipping above ₹498 🚚' },
      action: {
        catalog_id: config.catalogId,
        sections: formattedSections
      }
    }
  };
  return sendAPIRequest(payload, env, options);
}

/**
 * Send multiple products (ENHANCED)
 */
export async function sendMultipleProducts(to, productIds, headerText = '', bodyText = '', env, options = {}) {
  return sendProductList(to, [{
    title: 'Products',
    products: productIds.map(id => ({ product_retailer_id: id }))
  }], headerText, bodyText, env, options);
}

// ═══════════════════════════════════════════════════════════════
// FLOW MESSAGES (ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Send a WhatsApp Flow message
 */
export async function sendFlow(to, flowId, flowToken, bodyText, ctaText, env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'interactive',
    interactive: {
      type: 'flow',
      body: { text: sanitize(bodyText, MAX_TEXT_LENGTH) },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowToken,
          flow_id: flowId,
          flow_cta: ctaText.slice(0, MAX_BUTTON_TITLE_LENGTH),
          flow_action: 'navigate',
          flow_action_payload: {
            screen: options.screen || 'INIT'
          }
        }
      }
    }
  };

  if (options.footer) {
    payload.interactive.footer = { text: options.footer.slice(0, 60) };
  }

  return sendAPIRequest(payload, env, options);
}

// ═══════════════════════════════════════════════════════════════
// REACTIONS & READ RECEIPTS (YOUR LOGIC - PRESERVED)
// ═══════════════════════════════════════════════════════════════

export async function sendReaction(to, messageId, emoji, env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji
    }
  };
  return sendAPIRequest(payload, env, { ...options, logMessage: false, retry: false });
}

/**
 * Remove reaction (ENHANCED)
 */
export async function removeReaction(to, messageId, env, options = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: '' // Empty emoji removes the reaction
    }
  };
  return sendAPIRequest(payload, env, { ...options, logMessage: false, retry: false });
}

export async function markAsRead(to, messageId, env) {
  const config = getConfig(env);
  
  try {
    await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    });
  } catch (e) {
    console.warn('[markAsRead] Failed:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// BATCH SENDING (ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Send message to multiple recipients with rate limiting
 */
export async function sendBatch(recipients, messageFn, env, options = {}) {
  const {
    rateLimit = 20, // messages per second
    delayMs = 50,   // delay between messages
    onProgress,     // callback(sent, total, result)
    onError         // callback(phone, error)
  } = options;

  const results = [];
  const total = recipients.length;
  let sent = 0;

  for (const recipient of recipients) {
    try {
      const result = await messageFn(recipient, env);
      results.push({ phone: recipient, success: true, result });
      sent++;
      
      if (onProgress) {
        onProgress(sent, total, result);
      }
    } catch (error) {
      results.push({ phone: recipient, success: false, error: error.message });
      
      if (onError) {
        onError(recipient, error);
      }
    }

    // Rate limiting
    if (sent < total) {
      await sleep(delayMs);
    }
  }

  return {
    total,
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

/**
 * Send same text to multiple recipients
 */
export async function broadcastText(recipients, text, env, options = {}) {
  return sendBatch(recipients, (phone) => sendText(phone, text, env), env, options);
}

/**
 * Send template to multiple recipients
 */
export async function broadcastTemplate(recipients, templateName, languageCode, components, env, options = {}) {
  return sendBatch(recipients, (phone) => sendTemplate(phone, templateName, languageCode, components, env), env, options);
}

// ═══════════════════════════════════════════════════════════════
// MENUS (YOUR LOGIC - PRESERVED EXACTLY)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// MAIN MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendMainMenu(to, lang = 'en', env, options = {}) {
  const normalizedTo = normalizeIN(to);
  
  const body = await fromEnglish(
    "✨ Welcome to *KAAPAV Luxury Jewellery*! ✨\n\n" +
    "👑 Crafted Elegance • Timeless Sparkle 💎\n" +
    "Choose an option below 👇",
    lang
  );

  const footer = await fromEnglish("💖 Luxury Meets You, Only at KAAPAV", lang);

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: [
          { type: "reply", reply: { id: "JEWELLERY_MENU", title: await fromEnglish("💎 Jewellery", lang) } },
          { type: "reply", reply: { id: "CHAT_MENU", title: await fromEnglish("💬 Chat with Us!", lang) } },
          { type: "reply", reply: { id: "OFFERS_MENU", title: await fromEnglish("🎉 Offers & More", lang) } },
        ],
      },
    },
  };
  
  return sendAPIRequest(payload, env, options);
}

// ─────────────────────────────────────────────────────────────────
// JEWELLERY MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendJewelleryCategoriesMenu(to, lang = 'en', env, options = {}) {
  const normalizedTo = normalizeIN(to);
  
  const body = await fromEnglish(
    "💎 *Explore KAAPAV Collections* 💎\n\n" +
    "✨ Handcrafted designs, curated for royalty 👑",
    lang
  );

  const footer = await fromEnglish("🌐 kaapav.com | 📱 Catalogue", lang);

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: [
          { type: "reply", reply: { id: "OPEN_WEBSITE", title: await fromEnglish("🌐 Website", lang) } },
          { type: "reply", reply: { id: "OPEN_CATALOG", title: await fromEnglish("📱 Catalogue", lang) } },
          { type: "reply", reply: { id: "MAIN_MENU", title: await fromEnglish("🏠 Home", lang) } },
        ],
      },
    },
  };
  
  return sendAPIRequest(payload, env, options);
}

// ─────────────────────────────────────────────────────────────────
// OFFERS MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendOffersAndMoreMenu(to, lang = 'en', env, options = {}) {
  const normalizedTo = normalizeIN(to);
  
  const body = await fromEnglish(
    "💫 *Exclusive Luxury Offers!* 💫\n\n" +
    "🎉 Flat 50% OFF Select Styles ✨\n" +
    "🚚 Free Shipping Above ₹498/- 💝",
    lang
  );

  const footer = await fromEnglish("🛍️ KAAPAV Bestsellers", lang);

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: [
          { type: "reply", reply: { id: "BESTSELLERS", title: await fromEnglish("🛍️ Bestsellers", lang) } },
          { type: "reply", reply: { id: "PAYMENT_MENU", title: await fromEnglish("💳 Payment & Track", lang) } },
          { type: "reply", reply: { id: "MAIN_MENU", title: await fromEnglish("🏠 Home", lang) } },
        ],
      },
    },
  };
  
  return sendAPIRequest(payload, env, options);
}

// ─────────────────────────────────────────────────────────────────
// PAYMENT & TRACK MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendPaymentAndTrackMenu(to, lang = 'en', env, options = {}) {
  const normalizedTo = normalizeIN(to);
  
  const body = await fromEnglish(
    "💎 *Complete Your Sparkle with KAAPAV* 💎\n\n" +
    "Choose a secure option:\n" +
    "1️⃣ 💳 Payment – UPI or Cards\n" +
    "2️⃣ 📦 Track Your Order – Shiprocket\n\n" +
    "🚫 No COD ❌",
    lang
  );

  const footer = await fromEnglish("👑 KAAPAV – Luxury, Seamless & Secure ✨", lang);

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: [
          { type: "reply", reply: { id: "PAY_NOW", title: await fromEnglish("💳 Payment", lang) } },
          { type: "reply", reply: { id: "TRACK_ORDER", title: await fromEnglish("📦 Track Order", lang) } },
          { type: "reply", reply: { id: "MAIN_MENU", title: await fromEnglish("🏠 Home", lang) } },
        ],
      },
    },
  };
  
  return sendAPIRequest(payload, env, options);
}

// ─────────────────────────────────────────────────────────────────
// CHAT MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendChatWithUsCta(to, lang = 'en', env, options = {}) {
  const normalizedTo = normalizeIN(to);
  
  const body = await fromEnglish(
    "💬 *Need Help? We're Here for You!* 💬\n\n" +
    "Please describe your query below ⬇️\n" +
    "Our support team will assist you with luxury care 👑✨",
    lang
  );

  const footer = await fromEnglish("We are just a tap away 💖", lang);

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: [
          { type: "reply", reply: { id: "CHAT_NOW", title: await fromEnglish("💬 Chat Now", lang) } },
          { type: "reply", reply: { id: "SOCIAL_MENU", title: await fromEnglish("🌐 FB & Instagram", lang) } },
          { type: "reply", reply: { id: "MAIN_MENU", title: await fromEnglish("🏠 Home", lang) } },
        ],
      },
    },
  };
  
  return sendAPIRequest(payload, env, options);
}

// ─────────────────────────────────────────────────────────────────
// SOCIAL MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendSocialMenu(to, lang = 'en', env, options = {}) {
  const normalizedTo = normalizeIN(to);
  
  const body = await fromEnglish(
    "🌐 *Follow KAAPAV on Social Media* 🌐\n\n" +
    "Stay connected for luxury vibes 👑✨",
    lang
  );

  const footer = await fromEnglish("📲 Choose your platform below 👇", lang);

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: [
          { type: "reply", reply: { id: "OPEN_FACEBOOK", title: await fromEnglish("📘 Facebook", lang) } },
          { type: "reply", reply: { id: "OPEN_INSTAGRAM", title: await fromEnglish("📸 Instagram", lang) } },
          { type: "reply", reply: { id: "MAIN_MENU", title: await fromEnglish("🏠 Home", lang) } },
        ],
      },
    },
  };
  
  return sendAPIRequest(payload, env, options);
}

// ─────────────────────────────────────────────────────────────────
// ORDER MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendOrderMenu(to, lang = 'en', env, options = {}) {
  const normalizedTo = normalizeIN(to);
  
  const body = await fromEnglish(
    "🛒 *Place Your Order* 🛒\n\n" +
    "Easy steps:\n" +
    "1️⃣ Share product name/image\n" +
    "2️⃣ Share delivery address\n" +
    "3️⃣ Complete secure payment\n\n" +
    "💎 We'll ship within 24 hours!",
    lang
  );

  const footer = await fromEnglish("🚚 Free shipping above ₹498", lang);

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: [
          { type: "reply", reply: { id: "START_ORDER", title: await fromEnglish("🛒 Start Order", lang) } },
          { type: "reply", reply: { id: "OPEN_CATALOG", title: await fromEnglish("📱 View Catalog", lang) } },
          { type: "reply", reply: { id: "MAIN_MENU", title: await fromEnglish("🏠 Home", lang) } },
        ],
      },
    },
  };
  
  return sendAPIRequest(payload, env, options);
}

// ─────────────────────────────────────────────────────────────────
// LANGUAGE SELECTION MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendLanguageMenu(to, env, options = {}) {
  const normalizedTo = normalizeIN(to);
  
  const body = 
    "🌐 *Choose Your Language*\n" +
    "भाषा चुनें | ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ\n\n" +
    "Select below 👇";

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedTo,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      footer: { text: "💎 KAAPAV - Luxury for Everyone" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "LANG_EN", title: "🇬🇧 English" } },
          { type: "reply", reply: { id: "LANG_HI", title: "🇮🇳 हिंदी" } },
          { type: "reply", reply: { id: "LANG_KN", title: "🇮🇳 ಕನ್ನಡ" } },
        ],
      },
    },
  };
  
  return sendAPIRequest(payload, env, options);
}

// ─────────────────────────────────────────────────────────────────
// CATEGORY MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendCategoryMenu(to, lang = 'en', env, options = {}) {
  const normalizedTo = normalizeIN(to);
  
  const body = await fromEnglish(
    "💎 *Shop by Category* 💎\n\n" +
    "What are you looking for today?",
    lang
  );

  return sendListMessage(
    normalizedTo,
    body,
    "View Categories",
    [
      {
        title: "Jewellery Types",
        rows: [
          { id: "CAT_EARRINGS", title: "✨ Earrings", description: "Studs, drops, hoops & more" },
          { id: "CAT_NECKLACES", title: "📿 Necklaces", description: "Chains, pendants, chokers" },
          { id: "CAT_BANGLES", title: "💫 Bangles", description: "Traditional & modern designs" },
          { id: "CAT_RINGS", title: "💍 Rings", description: "Statement & everyday rings" },
          { id: "CAT_PENDANTS", title: "🔮 Pendants", description: "Beautiful pendant designs" },
        ]
      },
      {
        title: "Special Collections",
        rows: [
          { id: "BESTSELLERS", title: "🏆 Bestsellers", description: "Top rated by customers" },
          { id: "NEW_ARRIVALS", title: "🆕 New Arrivals", description: "Just added this week" },
          { id: "OFFERS", title: "🎉 On Sale", description: "Flat 50% off select items" },
        ]
      }
    ],
    env,
    "Free shipping above ₹498 🚚",
    options
  );
}

// ─────────────────────────────────────────────────────────────────
// SIMPLE INFO (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendSimpleInfo(to, text, lang = "en", env, options = {}) {
  const localized = await fromEnglish(text, lang);
  return sendText(to, localized, env, options);
}

// ═══════════════════════════════════════════════════════════════
// ORDER CONFIRMATION MESSAGE (YOUR LOGIC - PRESERVED)
// ═══════════════════════════════════════════════════════════════

export async function sendOrderConfirmation(to, order, lang = 'en', env, options = {}) {
  const itemsList = typeof order.items === 'string' 
    ? JSON.parse(order.items) 
    : order.items;
  
  const itemsText = itemsList.map(item => 
    `• ${item.name} x${item.quantity || 1} - ${formatCurrency(item.price)}`
  ).join('\n');
  
  const message = await fromEnglish(
    `✅ *Order Confirmed!* ✅\n\n` +
    `📦 Order ID: *${order.order_id}*\n\n` +
    `*Items:*\n${itemsText}\n\n` +
    `💰 Total: *${formatCurrency(order.total)}*\n\n` +
    `📍 Shipping to:\n${order.shipping_address}\n${order.shipping_city}, ${order.shipping_pincode}\n\n` +
    `🚚 Estimated Delivery: 3-5 business days\n\n` +
    `Thank you for shopping with KAAPAV! 💎`,
    lang
  );
  
  return sendReplyButtons(to, message, [
    { id: `TRACK_${order.order_id}`, title: '📦 Track Order' },
    { id: 'MAIN_MENU', title: '🏠 Home' }
  ], env, '👑 Crafted with love by KAAPAV', options);
}

// ═══════════════════════════════════════════════════════════════
// PAYMENT LINK MESSAGE (YOUR LOGIC - PRESERVED)
// ═══════════════════════════════════════════════════════════════

export async function sendPaymentLink(to, orderId, amount, paymentLink, lang = 'en', env, options = {}) {
  const message = await fromEnglish(
    `💳 *Complete Your Payment* 💳\n\n` +
    `📦 Order: *${orderId}*\n` +
    `💰 Amount: *${formatCurrency(amount)}*\n\n` +
    `🔒 Secure Payment Options:\n` +
    `✅ UPI (GPay, PhonePe, Paytm)\n` +
    `✅ Credit/Debit Cards\n` +
    `✅ Net Banking\n\n` +
    `Tap below to pay 👇`,
    lang
  );
  
  return sendCtaUrl(to, message, '💳 Pay Now', paymentLink, env, '🔐 100% Secure Checkout', options);
}

// ═══════════════════════════════════════════════════════════════
// SHIPPING UPDATE MESSAGE (YOUR LOGIC - PRESERVED)
// ═══════════════════════════════════════════════════════════════

export async function sendShippingUpdate(to, orderId, trackingId, courier, status, lang = 'en', env, options = {}) {
  let statusEmoji = '📦';
  let statusText = 'Order Update';
  
  switch (status) {
    case 'shipped':
      statusEmoji = '🚚';
      statusText = 'Shipped!';
      break;
    case 'in_transit':
      statusEmoji = '🛣️';
      statusText = 'In Transit';
      break;
    case 'out_for_delivery':
      statusEmoji = '🏃';
      statusText = 'Out for Delivery!';
      break;
    case 'delivered':
      statusEmoji = '🎉';
      statusText = 'Delivered!';
      break;
  }
  
  const trackingUrl = `${LINKS.shiprocket}?tracking_id=${trackingId}`;
  
  const message = await fromEnglish(
    `${statusEmoji} *${statusText}* ${statusEmoji}\n\n` +
    `📦 Order: *${orderId}*\n` +
    `🚚 Courier: ${courier}\n` +
    `📋 Tracking: ${trackingId}\n\n` +
    `Track your package in real-time 👇`,
    lang
  );
  
  return sendCtaUrl(to, message, '📦 Track Package', trackingUrl, env, '', options);
}

// ═══════════════════════════════════════════════════════════════
// FEEDBACK & REVIEW REQUESTS (ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Send feedback request
 */
export async function sendFeedbackRequest(to, orderId, lang = 'en', env, options = {}) {
  const message = await fromEnglish(
    `🌟 *How was your experience?* 🌟\n\n` +
    `Order: *${orderId}*\n\n` +
    `We'd love to hear your feedback!\n` +
    `Your review helps us serve you better. 💎`,
    lang
  );
  
  return sendReplyButtons(to, message, [
    { id: 'FEEDBACK_GREAT', title: '😍 Loved it!' },
    { id: 'FEEDBACK_GOOD', title: '😊 Good' },
    { id: 'FEEDBACK_ISSUE', title: '😕 Had Issues' }
  ], env, 'Thank you for shopping with KAAPAV!', options);
}

/**
 * Send Google review request
 */
export async function sendReviewRequest(to, lang = 'en', env, options = {}) {
  const message = await fromEnglish(
    `⭐ *Loved KAAPAV?* ⭐\n\n` +
    `Your 5-star review means the world to us! 🌟\n\n` +
    `Share your experience and help others discover KAAPAV. 💎`,
    lang
  );
  
  return sendCtaUrl(to, message, '⭐ Leave Review', LINKS.googleReview, env, 'Thank you! 💖', options);
}

// ═══════════════════════════════════════════════════════════════
// CART & ABANDONED CART (ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Send cart reminder
 */
export async function sendCartReminder(to, cart, lang = 'en', env, options = {}) {
  const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
  
  const itemsList = items.slice(0, 3).map(item => 
    `• ${item.name}`
  ).join('\n');
  
  const moreText = items.length > 3 ? `\n...and ${items.length - 3} more items` : '';
  
  const message = await fromEnglish(
    `🛒 *Your Cart is Waiting!* 🛒\n\n` +
    `You left some beautiful pieces behind:\n\n` +
    `${itemsList}${moreText}\n\n` +
    `💰 Total: *${formatCurrency(cart.total)}*\n\n` +
    `Complete your order before they're gone! ✨`,
    lang
  );
  
  return sendReplyButtons(to, message, [
    { id: 'CHECKOUT_NOW', title: '🛒 Checkout Now' },
    { id: 'VIEW_CART', title: '👀 View Cart' },
    { id: 'MAIN_MENU', title: '🏠 Home' }
  ], env, '🚚 Free shipping above ₹498', options);
}

/**
 * Send abandoned cart with discount
 */
export async function sendAbandonedCartWithDiscount(to, cart, discountCode, discountPercent, lang = 'en', env, options = {}) {
  const message = await fromEnglish(
    `🎁 *Special Offer Just for You!* 🎁\n\n` +
    `Complete your order and get *${discountPercent}% OFF!* 🎉\n\n` +
    `Use code: *${discountCode}*\n\n` +
    `💰 Cart Total: ${formatCurrency(cart.total)}\n` +
    `✨ With Discount: *${formatCurrency(cart.total * (1 - discountPercent/100))}*\n\n` +
    `Hurry! Offer expires soon. ⏰`,
    lang
  );
  
  return sendReplyButtons(to, message, [
    { id: 'APPLY_DISCOUNT', title: '🎁 Apply & Checkout' },
    { id: 'VIEW_CART', title: '👀 View Cart' }
  ], env, `Code: ${discountCode}`, options);
}

// ═══════════════════════════════════════════════════════════════
// SUPPORT & HELP (ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Send business hours message
 */
export async function sendBusinessHours(to, lang = 'en', env, options = {}) {
  const message = await fromEnglish(
    `🕐 *Our Business Hours* 🕐\n\n` +
    `Monday - Saturday: 9 AM - 9 PM\n` +
    `Sunday: 10 AM - 6 PM\n\n` +
    `(Indian Standard Time)\n\n` +
    `We'll get back to you within 2-4 hours during business hours. 💎`,
    lang
  );
  
  return sendReplyButtons(to, message, [
    { id: 'CHAT_NOW', title: '💬 Leave Message' },
    { id: 'MAIN_MENU', title: '🏠 Home' }
  ], env, '', options);
}

/**
 * Send FAQ menu
 */
export async function sendFAQMenu(to, lang = 'en', env, options = {}) {
  return sendListMessage(
    to,
    await fromEnglish("❓ *Frequently Asked Questions* ❓\n\nSelect a topic:", lang),
    "View FAQs",
    [
      {
        title: "Orders & Shipping",
        rows: [
          { id: "FAQ_DELIVERY", title: "🚚 Delivery Time", description: "How long does delivery take?" },
          { id: "FAQ_SHIPPING_COST", title: "💰 Shipping Cost", description: "What are the shipping charges?" },
          { id: "FAQ_TRACK", title: "📦 Track Order", description: "How to track my order?" },
        ]
      },
      {
        title: "Payments & Returns",
        rows: [
          { id: "FAQ_PAYMENT", title: "💳 Payment Options", description: "Available payment methods" },
          { id: "FAQ_COD", title: "🚫 COD", description: "Is COD available?" },
          { id: "FAQ_RETURN", title: "↩️ Returns", description: "Return & exchange policy" },
        ]
      },
      {
        title: "Products",
        rows: [
          { id: "FAQ_MATERIAL", title: "✨ Material Quality", description: "What materials are used?" },
          { id: "FAQ_WARRANTY", title: "🛡️ Warranty", description: "Warranty information" },
        ]
      }
    ],
    env,
    "Can't find your question? Chat with us!",
    options
  );
}

// ═══════════════════════════════════════════════════════════════
// EXPORT ALL (for convenience)
// ═══════════════════════════════════════════════════════════════

export default {
  // Constants
  LINKS,
  
  // Phone utilities
  normalizeIN,
  isValidPhone,
  
  // Text formatting
  bold,
  italic,
  strike,
  code,
  formatCurrency,
  formatDate,
  truncate,
  sanitize,
  
  // Core API
  sendAPIRequest,
  
  // Text messages
  sendText,
  sendLocalizedText,
  sendTextWithLinks,
  sendTextWithTyping,
  
  // Interactive
  sendReplyButtons,
  sendReplyButtonsWithImage,
  sendReplyButtonsWithDocument,
  sendCtaUrl,
  sendMultipleCtaUrls,
  sendListMessage,
  sendList,
  
  // Media
  sendImage,
  sendImageById,
  sendVideo,
  sendVideoById,
  sendDocument,
  sendDocumentById,
  sendAudio,
  sendAudioById,
  sendSticker,
  sendStickerById,
  sendLocation,
  sendContacts,
  sendContact,
  
  // Templates
  sendTemplate,
  sendTemplateWithParams,
  sendTemplateWithImage,
  sendOrderConfirmationTemplate,
  sendShippingTemplate,
  sendPaymentReminderTemplate,
  sendDeliveryConfirmationTemplate,
  
  // Products
  sendProduct,
  sendProductList,
  sendMultipleProducts,
  
  // Flows
  sendFlow,
  
  // Reactions & Status
  sendReaction,
  removeReaction,
  markAsRead,
  
  // Batch
  sendBatch,
  broadcastText,
  broadcastTemplate,
  
  // Menus
  sendMainMenu,
  sendJewelleryCategoriesMenu,
  sendOffersAndMoreMenu,
  sendPaymentAndTrackMenu,
  sendChatWithUsCta,
  sendSocialMenu,
  sendOrderMenu,
  sendLanguageMenu,
  sendCategoryMenu,
  sendSimpleInfo,
  
  // Order
  sendOrderConfirmation,
  sendPaymentLink,
  sendShippingUpdate,
  
  // Feedback
  sendFeedbackRequest,
  sendReviewRequest,
  
  // Cart
  sendCartReminder,
  sendAbandonedCartWithDiscount,
  
  // Support
  sendBusinessHours,
  sendFAQMenu
};

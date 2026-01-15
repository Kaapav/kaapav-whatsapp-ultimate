/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - MESSAGE SENDER UTILITIES
 * ═══════════════════════════════════════════════════════════════
 * BASED ON YOUR ORIGINAL sendMessage.js - FULLY PRESERVED
 * Enhanced for Cloudflare Workers (fetch instead of axios)
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
  googleReview: "https://g.page/r/CaGZJvP_W_uLEBM/review", // Update with your actual link
  facebook: "https://www.facebook.com/kaapavfashionjewellery/",
  instagram: "https://www.instagram.com/kaapavfashionjewellery/",
};

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

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION HELPER
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

// ═══════════════════════════════════════════════════════════════
// CORE API SENDER (YOUR LOGIC - PRESERVED & ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Send request to WhatsApp Cloud API
 * YOUR sendAPIRequest - PRESERVED with enhancements
 */
export async function sendAPIRequest(payload, env) {
  const config = getConfig(env);
  
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
      
      throw new Error(`WhatsApp API Error: ${result.error.message}`);
    }

    // Success logging (YOUR LOGIC)
    console.log('[sendAPIRequest] ✅ SUCCESS! Response:', {
      status: response.status,
      messageId: result?.messages?.[0]?.id,
      to: payload.to
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
      messageId: result?.messages?.[0]?.id 
    }, env).catch(() => {});

    return result;
    
  } catch (err) {
    // Detailed error information (YOUR LOGIC - ENHANCED)
    const errorDetails = {
      message: err.message,
      code: err.code,
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
    console.error('Request URL:', errorDetails.request.url);
    console.error('Request To:', errorDetails.request.to);
    console.error('Request Type:', errorDetails.request.type);
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
    const enhancedError = new Error(`WhatsApp API failed: ${errorDetails.message}`);
    enhancedError.details = errorDetails;
    throw enhancedError;
  }
}

// ═══════════════════════════════════════════════════════════════
// TEXT MESSAGE (YOUR LOGIC - PRESERVED)
// ═══════════════════════════════════════════════════════════════

export async function sendText(to, text, env) {
  const payload = { 
    messaging_product: 'whatsapp', 
    to: normalizeIN(to), 
    type: 'text', 
    text: { body: text } 
  };
  return sendAPIRequest(payload, env);
}

export async function sendLocalizedText(to, text, lang = 'en', env) {
  const localized = await fromEnglish(text, lang);
  return sendText(to, localized, env);
}

export async function sendTextWithLinks(to, text, env) {
  return sendText(to, text, env);
}

// ═══════════════════════════════════════════════════════════════
// REPLY BUTTONS (YOUR LOGIC - PRESERVED EXACTLY)
// ═══════════════════════════════════════════════════════════════

/**
 * Send reply buttons (WhatsApp supports up to 3 quick reply buttons)
 * YOUR ORIGINAL FUNCTION - PRESERVED
 */
export async function sendReplyButtons(to, bodyText, buttons /* [{id,title}] max 3 */, env, footer = '') {
  const normalizedTo = normalizeIN(to);
  
  if (!buttons || !buttons.length) {
    return sendText(normalizedTo, bodyText, env);
  }
  
  // WhatsApp max 3 buttons
  if (buttons.length > 3) buttons = buttons.slice(0, 3);
  
  const waButtons = buttons.map((b) => ({
    type: 'reply',
    reply: { 
      id: String(b.id).slice(0, 256), 
      title: String(b.title).slice(0, 20) 
    },
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: waButtons },
    },
  };
  
  if (footer) {
    payload.interactive.footer = { text: footer.slice(0, 60) };
  }
  
  return sendAPIRequest(payload, env);
}

// ═══════════════════════════════════════════════════════════════
// CTA URL (YOUR LOGIC - PRESERVED EXACTLY)
// ═══════════════════════════════════════════════════════════════

/**
 * CTA url interactive (send text first to ensure a tappable URL)
 * YOUR ORIGINAL FUNCTION - PRESERVED
 */
export async function sendCtaUrl(to, bodyText, displayText, url, env, footer = '') {
  const normalizedTo = normalizeIN(to);
  
  // Send text first to ensure a tappable URL (YOUR LOGIC)
  await sendText(normalizedTo, `${bodyText}\n\n🔗 ${displayText}: ${url}`, env);
  
  // Try interactive CTA button
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: bodyText },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: displayText.slice(0, 20),
          url: url
        }
      }
    },
  };
  
  if (footer) {
    payload.interactive.footer = { text: footer.slice(0, 60) };
  }
  
  try {
    return await sendAPIRequest(payload, env);
  } catch {
    // Best-effort: text already sent (YOUR LOGIC)
    return { ok: true, note: 'cta_url_fallback_to_text' };
  }
}

// ═══════════════════════════════════════════════════════════════
// LIST MESSAGE (ENHANCED)
// ═══════════════════════════════════════════════════════════════

export async function sendListMessage(to, bodyText, buttonText, sections, env, footer = '') {
  const normalizedTo = normalizeIN(to);
  
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.map(section => ({
          title: section.title.slice(0, 24),
          rows: section.rows.slice(0, 10).map(row => ({
            id: String(row.id).slice(0, 200),
            title: String(row.title).slice(0, 24),
            description: (row.description || '').slice(0, 72)
          }))
        }))
      }
    }
  };
  
  if (footer) {
    payload.interactive.footer = { text: footer.slice(0, 60) };
  }
  
  return sendAPIRequest(payload, env);
}

// ═══════════════════════════════════════════════════════════════
// MEDIA MESSAGES (ENHANCED)
// ═══════════════════════════════════════════════════════════════

export async function sendImage(to, imageUrl, caption = '', env) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'image',
    image: {
      link: imageUrl,
      caption: caption.slice(0, 1024)
    }
  };
  return sendAPIRequest(payload, env);
}

export async function sendVideo(to, videoUrl, caption = '', env) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'video',
    video: {
      link: videoUrl,
      caption: caption.slice(0, 1024)
    }
  };
  return sendAPIRequest(payload, env);
}

export async function sendDocument(to, documentUrl, filename, caption = '', env) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'document',
    document: {
      link: documentUrl,
      filename: filename,
      caption: caption.slice(0, 1024)
    }
  };
  return sendAPIRequest(payload, env);
}

export async function sendAudio(to, audioUrl, env) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'audio',
    audio: { link: audioUrl }
  };
  return sendAPIRequest(payload, env);
}

export async function sendSticker(to, stickerUrl, env) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'sticker',
    sticker: { link: stickerUrl }
  };
  return sendAPIRequest(payload, env);
}

export async function sendLocation(to, latitude, longitude, name = '', address = '', env) {
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
  return sendAPIRequest(payload, env);
}

export async function sendContacts(to, contacts, env) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'contacts',
    contacts: contacts
  };
  return sendAPIRequest(payload, env);
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE MESSAGES (ENHANCED)
// ═══════════════════════════════════════════════════════════════

export async function sendTemplate(to, templateName, languageCode = 'en', components = [], env) {
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
  return sendAPIRequest(payload, env);
}

/**
 * Send order confirmation template
 */
export async function sendOrderConfirmationTemplate(to, orderId, total, env) {
  return sendTemplate(to, 'order_confirmation', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: orderId },
        { type: 'currency', currency: { code: 'INR', amount_1000: total * 1000, fallback_value: `₹${total}` } }
      ]
    }
  ], env);
}

/**
 * Send shipping update template
 */
export async function sendShippingTemplate(to, orderId, trackingUrl, env) {
  return sendTemplate(to, 'shipping_update', 'en', [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: orderId },
        { type: 'text', text: trackingUrl }
      ]
    }
  ], env);
}

// ═══════════════════════════════════════════════════════════════
// PRODUCT MESSAGES (CATALOG) - ENHANCED
// ═══════════════════════════════════════════════════════════════

export async function sendProduct(to, productRetailerId, bodyText = '', env) {
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
      body: { text: bodyText || '✨ Check out this beautiful piece!' },
      footer: { text: 'Tap to view details 💎' },
      action: {
        catalog_id: config.catalogId,
        product_retailer_id: productRetailerId
      }
    }
  };
  return sendAPIRequest(payload, env);
}

export async function sendProductList(to, sections, headerText = '', bodyText = '', env) {
  const config = getConfig(env);
  
  if (!config.catalogId) {
    console.warn('[sendProductList] No CATALOG_ID configured');
    return sendCtaUrl(to, bodyText || 'Browse our catalog', '📱 Catalogue', LINKS.whatsappCatalog, env);
  }

  const formattedSections = sections.map(section => ({
    title: section.title.slice(0, 24),
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
      header: { type: 'text', text: (headerText || '💎 KAAPAV Collection').slice(0, 60) },
      body: { text: (bodyText || 'Browse our exclusive designs').slice(0, 1024) },
      footer: { text: 'Free shipping above ₹498 🚚' },
      action: {
        catalog_id: config.catalogId,
        sections: formattedSections
      }
    }
  };
  return sendAPIRequest(payload, env);
}

// ═══════════════════════════════════════════════════════════════
// REACTIONS & READ RECEIPTS
// ═══════════════════════════════════════════════════════════════

export async function sendReaction(to, messageId, emoji, env) {
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeIN(to),
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji
    }
  };
  return sendAPIRequest(payload, env);
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
// MENUS (YOUR LOGIC - PRESERVED EXACTLY)
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// MAIN MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendMainMenu(to, lang = 'en', env) {
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
  
  return sendAPIRequest(payload, env);
}

// ─────────────────────────────────────────────────────────────────
// JEWELLERY MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendJewelleryCategoriesMenu(to, lang = 'en', env) {
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
  
  return sendAPIRequest(payload, env);
}

// ─────────────────────────────────────────────────────────────────
// OFFERS MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendOffersAndMoreMenu(to, lang = 'en', env) {
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
  
  return sendAPIRequest(payload, env);
}

// ─────────────────────────────────────────────────────────────────
// PAYMENT & TRACK MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendPaymentAndTrackMenu(to, lang = 'en', env) {
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
  
  return sendAPIRequest(payload, env);
}

// ─────────────────────────────────────────────────────────────────
// CHAT MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendChatWithUsCta(to, lang = 'en', env) {
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
  
  return sendAPIRequest(payload, env);
}

// ─────────────────────────────────────────────────────────────────
// SOCIAL MENU (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendSocialMenu(to, lang = 'en', env) {
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
  
  return sendAPIRequest(payload, env);
}

// ─────────────────────────────────────────────────────────────────
// ORDER MENU (NEW - ENHANCED)
// ─────────────────────────────────────────────────────────────────
export async function sendOrderMenu(to, lang = 'en', env) {
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
  
  return sendAPIRequest(payload, env);
}

// ─────────────────────────────────────────────────────────────────
// LANGUAGE SELECTION MENU (NEW)
// ─────────────────────────────────────────────────────────────────
export async function sendLanguageMenu(to, env) {
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
  
  return sendAPIRequest(payload, env);
}

// ─────────────────────────────────────────────────────────────────
// CATEGORY MENU (NEW)
// ─────────────────────────────────────────────────────────────────
export async function sendCategoryMenu(to, lang = 'en', env) {
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
    "Free shipping above ₹498 🚚"
  );
}

// ─────────────────────────────────────────────────────────────────
// SIMPLE INFO (YOUR LOGIC - PRESERVED)
// ─────────────────────────────────────────────────────────────────
export async function sendSimpleInfo(to, text, lang = "en", env) {
  const localized = await fromEnglish(text, lang);
  return sendText(to, localized, env);
}

// ═══════════════════════════════════════════════════════════════
// ORDER CONFIRMATION MESSAGE
// ═══════════════════════════════════════════════════════════════

export async function sendOrderConfirmation(to, order, lang = 'en', env) {
  const itemsList = typeof order.items === 'string' 
    ? JSON.parse(order.items) 
    : order.items;
  
  const itemsText = itemsList.map(item => 
    `• ${item.name} x${item.quantity || 1} - ₹${item.price}`
  ).join('\n');
  
  const message = await fromEnglish(
    `✅ *Order Confirmed!* ✅\n\n` +
    `📦 Order ID: *${order.order_id}*\n\n` +
    `*Items:*\n${itemsText}\n\n` +
    `💰 Total: *₹${order.total}*\n\n` +
    `📍 Shipping to:\n${order.shipping_address}\n${order.shipping_city}, ${order.shipping_pincode}\n\n` +
    `🚚 Estimated Delivery: 3-5 business days\n\n` +
    `Thank you for shopping with KAAPAV! 💎`,
    lang
  );
  
  return sendReplyButtons(to, message, [
    { id: `TRACK_${order.order_id}`, title: '📦 Track Order' },
    { id: 'MAIN_MENU', title: '🏠 Home' }
  ], env, '👑 Crafted with love by KAAPAV');
}

// ═══════════════════════════════════════════════════════════════
// PAYMENT LINK MESSAGE
// ═══════════════════════════════════════════════════════════════

export async function sendPaymentLink(to, orderId, amount, paymentLink, lang = 'en', env) {
  const message = await fromEnglish(
    `💳 *Complete Your Payment* 💳\n\n` +
    `📦 Order: *${orderId}*\n` +
    `💰 Amount: *₹${amount}*\n\n` +
    `🔒 Secure Payment Options:\n` +
    `✅ UPI (GPay, PhonePe, Paytm)\n` +
    `✅ Credit/Debit Cards\n` +
    `✅ Net Banking\n\n` +
    `Tap below to pay 👇`,
    lang
  );
  
  return sendCtaUrl(to, message, '💳 Pay Now', paymentLink, env, '🔐 100% Secure Checkout');
}

// ═══════════════════════════════════════════════════════════════
// SHIPPING UPDATE MESSAGE
// ═══════════════════════════════════════════════════════════════

export async function sendShippingUpdate(to, orderId, trackingId, courier, status, lang = 'en', env) {
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
  
  return sendCtaUrl(to, message, '📦 Track Package', trackingUrl, env);
}
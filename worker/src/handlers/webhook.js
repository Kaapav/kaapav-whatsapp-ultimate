/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - WEBHOOK HANDLER (ENHANCED v2.1)
 * ═══════════════════════════════════════════════════════════════
 * Processes all incoming WhatsApp webhook events
 * Includes: Security, Deduplication, Error Handling, Analytics
 * ═══════════════════════════════════════════════════════════════
 */

import { handleButtonClick } from './buttonHandler.js';
import { handleOrderFlow } from './orderHandler.js';
import { handleAIResponse } from './aiHandler.js';
import { handleMediaMessage } from './mediaHandler.js';
import { 
  sendText, 
  sendMainMenu, 
  sendReplyButtons,
  sendReaction,
  markAsRead,
  normalizeIN,
  LINKS
} from '../utils/sendMessage.js';
import { 
  getQuickReply, 
  extractOrderId, 
  extractPincode,
  sanitize,
  sleep
} from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const MESSAGE_DEDUP_TTL = 300; // 5 minutes
const MAX_TEXT_LENGTH = 4096;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Menu triggers (configurable)
const MENU_TRIGGERS = new Set([
  'menu', 'hi', 'hello', 'hey', 'hii', 'start', 'help', 
  '0', 'home', 'main', 'hola', 'namaste', '/menu', '/start'
]);

// Category keywords mapping
const CATEGORY_KEYWORDS = {
  'earring': 'CAT_EARRINGS',
  'earrings': 'CAT_EARRINGS',
  'tops': 'CAT_EARRINGS',
  'jhumka': 'CAT_EARRINGS',
  'necklace': 'CAT_NECKLACES',
  'necklaces': 'CAT_NECKLACES',
  'chain': 'CAT_NECKLACES',
  'haar': 'CAT_NECKLACES',
  'bangle': 'CAT_BANGLES',
  'bangles': 'CAT_BANGLES',
  'kangan': 'CAT_BANGLES',
  'ring': 'CAT_RINGS',
  'rings': 'CAT_RINGS',
  'pendant': 'CAT_PENDANTS',
  'pendants': 'CAT_PENDANTS',
  'locket': 'CAT_PENDANTS',
  'bracelet': 'CAT_BRACELETS',
  'bracelets': 'CAT_BRACELETS'
};

// Action keywords mapping
const ACTION_KEYWORDS = {
  'order': 'START_ORDER',
  'buy': 'START_ORDER',
  'purchase': 'START_ORDER',
  'khareed': 'START_ORDER',
  'catalog': 'OPEN_CATALOG',
  'catalogue': 'OPEN_CATALOG',
  'shop': 'OPEN_CATALOG',
  'products': 'OPEN_CATALOG',
  'pay': 'PAY_NOW',
  'payment': 'PAY_NOW',
  'upi': 'PAY_NOW',
  'gpay': 'PAY_NOW',
  'track': 'TRACK_ORDER',
  'tracking': 'TRACK_ORDER',
  'status': 'TRACK_ORDER',
  'where': 'TRACK_ORDER',
  'kahan': 'TRACK_ORDER',
  'offer': 'OFFERS_MENU',
  'offers': 'OFFERS_MENU',
  'discount': 'OFFERS_MENU',
  'sale': 'BESTSELLERS',
  'best': 'BESTSELLERS',
  'popular': 'BESTSELLERS',
  'trending': 'BESTSELLERS',
  'support': 'CHAT_NOW',
  'help': 'CHAT_NOW',
  'complaint': 'CHAT_NOW',
  'problem': 'CHAT_NOW',
  'issue': 'CHAT_NOW',
  'return': 'RETURNS',
  'refund': 'RETURNS',
  'exchange': 'RETURNS',
  'cancel': 'CANCEL_ORDER',
  'size': 'SIZE_GUIDE',
  'sizing': 'SIZE_GUIDE'
};

// ═══════════════════════════════════════════════════════════════
// WEBHOOK VERIFICATION (GET Request)
// ═══════════════════════════════════════════════════════════════

export function handleWebhookVerification(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  console.log('[Webhook] 🔐 Verification request:', { 
    mode, 
    tokenMatch: token === env.VERIFY_TOKEN,
    ip: request.headers.get('CF-Connecting-IP')
  });

  if (mode === 'subscribe' && token === env.VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verification successful');
    return new Response(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  console.log('[Webhook] ❌ Verification failed - token mismatch');
  return new Response('Forbidden', { status: 403 });
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK SIGNATURE VERIFICATION
// ═══════════════════════════════════════════════════════════════

export async function verifyWebhookSignature(body, signature, secret) {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSig = 'sha256=' + Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Timing-safe comparison
    if (signature.length !== expectedSig.length) return false;
    
    let match = true;
    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== expectedSig[i]) match = false;
    }
    return match;
  } catch (error) {
    console.error('[Webhook] Signature verification error:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK MESSAGE HANDLER (POST Request)
// ═══════════════════════════════════════════════════════════════

export async function handleWebhookMessage(body, env) {
  const startTime = Date.now();
  
  try {
    // ─────────────────────────────────────────────────────────────
    // Validate webhook structure
    // ─────────────────────────────────────────────────────────────
    if (!body?.entry?.[0]?.changes?.[0]?.value) {
      console.log('[Webhook] ⚠️ Invalid webhook structure');
      return;
    }

    const value = body.entry[0].changes[0].value;
    const field = body.entry[0].changes[0].field;
    const webhookId = body.entry[0].id;

    // Only process messages field
    if (field !== 'messages') {
      console.log('[Webhook] 📋 Non-message field:', field);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // Handle status updates
    // ─────────────────────────────────────────────────────────────
    if (value.statuses && value.statuses.length > 0) {
      await handleStatusUpdates(value.statuses, env);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // Handle incoming messages
    // ─────────────────────────────────────────────────────────────
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const contact = value.contacts?.[0];
      const metadata = value.metadata;
      
      // Deduplication check
      const isDuplicate = await checkDuplicateMessage(message.id, env);
      if (isDuplicate) {
        console.log('[Webhook] ⚠️ Duplicate message ignored:', message.id.slice(-10));
        return;
      }
      
      await processIncomingMessage(message, contact, metadata, env);
    }

  } catch (error) {
    console.error('[Webhook] ❌ Critical Error:', error.message);
    console.error('[Webhook] Stack:', error.stack);
    
    // Log error to database for monitoring
    await logWebhookError(error, body, env).catch(() => {});
  } finally {
    console.log(`[Webhook] ⏱️ Processed in ${Date.now() - startTime}ms`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MESSAGE DEDUPLICATION
// ═══════════════════════════════════════════════════════════════

async function checkDuplicateMessage(messageId, env) {
  if (!env.KV) return false;
  
  try {
    const key = `msg:${messageId}`;
    const exists = await env.KV.get(key);
    
    if (exists) {
      return true;
    }
    
    // Mark as processed
    await env.KV.put(key, '1', { expirationTtl: MESSAGE_DEDUP_TTL });
    return false;
  } catch (error) {
    console.warn('[Dedup] Error:', error.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// PROCESS INCOMING MESSAGE
// ═══════════════════════════════════════════════════════════════

async function processIncomingMessage(message, contact, metadata, env) {
  const phone = normalizeIN(message.from);
  const messageId = message.id;
  const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
  const messageType = message.type;
  const customerName = sanitize(contact?.profile?.name || '', 100);

  console.log(`[Webhook] 📥 Incoming from ${phone}:`, {
    type: messageType,
    name: customerName || 'Unknown',
    id: messageId.slice(-10)
  });

  // ─────────────────────────────────────────────────────────────
  // Mark message as read (non-blocking)
  // ─────────────────────────────────────────────────────────────
  markAsRead(phone, messageId, env).catch(err => {
    console.warn('[ReadReceipt] Failed:', err.message);
  });

  // ─────────────────────────────────────────────────────────────
  // Get customer data in parallel
  // ─────────────────────────────────────────────────────────────
  const [lang, activeFlow, customerData] = await Promise.all([
    getCustomerLanguage(phone, env),
    getConversationState(phone, env),
    getCustomerData(phone, env)
  ]);

  // ─────────────────────────────────────────────────────────────
  // Save to database (parallel operations)
  // ─────────────────────────────────────────────────────────────
  const dbPromises = [
    saveMessage(message, phone, customerName, timestamp, env),
    updateChat(phone, customerName, message, timestamp, env),
    updateCustomer(phone, customerName, lang, env),
    logAnalytics('message_in', phone, message, env)
  ];

  // Don't await these - let them run in background
  Promise.all(dbPromises).catch(err => {
    console.error('[DB] Background save error:', err.message);
  });

  // ─────────────────────────────────────────────────────────────
  // Log to external services (non-blocking)
  // ─────────────────────────────────────────────────────────────
  logToExternalServices(message, phone, customerName, env).catch(() => {});

  // ─────────────────────────────────────────────────────────────
  // Check for active conversation flow
  // ─────────────────────────────────────────────────────────────
  if (activeFlow) {
    try {
      const handled = await handleActiveFlow(activeFlow, message, phone, lang, env);
      if (handled) {
        console.log('[Flow] ✅ Handled by active flow');
        return;
      }
    } catch (flowError) {
      console.error('[Flow] Error:', flowError.message);
      // Clear broken flow state
      await clearConversationState(phone, env).catch(() => {});
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Route by message type
  // ─────────────────────────────────────────────────────────────
  try {
    switch (messageType) {
      case 'text':
        await handleTextMessage(message, phone, lang, customerData, env);
        break;

      case 'interactive':
        await handleInteractiveMessage(message, phone, lang, env);
        break;

      case 'image':
      case 'video':
      case 'audio':
      case 'document':
      case 'sticker':
        await handleMediaMessage(message, phone, lang, env);
        break;

      case 'location':
        await handleLocationMessage(message, phone, lang, env);
        break;

      case 'contacts':
        await handleContactsMessage(message, phone, lang, env);
        break;

      case 'order':
        await handleNativeOrderMessage(message, phone, lang, env);
        break;

      case 'button':
        await handleTemplateButton(message, phone, lang, env);
        break;

      case 'reaction':
        await handleReactionMessage(message, phone, env);
        break;

      case 'unsupported':
        console.log('[Webhook] ⚠️ Unsupported message type');
        break;

      default:
        console.log(`[Webhook] ⚠️ Unknown type: ${messageType}`);
        // Don't spam user with menu for unknown types
    }
  } catch (routeError) {
    console.error('[Webhook] Route error:', routeError.message);
    
    // Fallback response
    await sendFallbackResponse(phone, lang, env).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// TEXT MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleTextMessage(message, phone, lang, customerData, env) {
  const rawText = message.text?.body || '';
  const text = sanitize(rawText, MAX_TEXT_LENGTH);
  const lowerText = text.toLowerCase().trim();

  // Ignore empty messages
  if (!lowerText) {
    console.log('[Text] ⚠️ Empty message ignored');
    return;
  }

  console.log(`[Text] 💬 Processing: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);

  // ─────────────────────────────────────────────────────────────
  // Priority 1: Menu triggers
  // ─────────────────────────────────────────────────────────────
  if (MENU_TRIGGERS.has(lowerText)) {
    console.log('[Text] 🏠 Menu trigger matched');
    
    // Send reaction first (optional, adds engagement)
    sendReaction(phone, message.id, '👋', env).catch(() => {});
    
    return sendMainMenu(phone, lang, env);
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 2: Quick replies from database
  // ─────────────────────────────────────────────────────────────
  const quickReply = await getQuickReply(text, lang, env);
  if (quickReply) {
    console.log(`[Text] ⚡ Quick reply matched: "${quickReply.keyword}"`);
    
    // Update usage stats (non-blocking)
    updateQuickReplyStats(quickReply.id, env).catch(() => {});

    // Handle different response types
    return await sendQuickReplyResponse(quickReply, phone, env);
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 3: Order ID tracking
  // ─────────────────────────────────────────────────────────────
  const orderId = extractOrderId(text);
  if (orderId) {
    console.log(`[Text] 📦 Order ID detected: ${orderId}`);
    return handleOrderTracking(orderId, phone, lang, env);
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 4: Phone number (for order lookup)
  // ─────────────────────────────────────────────────────────────
  const phoneMatch = lowerText.match(/\b(\d{10})\b/);
  if (phoneMatch && lowerText.includes('order')) {
    const lookupPhone = normalizeIN(phoneMatch[1]);
    return handleOrdersByPhone(lookupPhone, phone, lang, env);
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 5: Category keywords
  // ─────────────────────────────────────────────────────────────
  for (const [keyword, buttonId] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lowerText.includes(keyword)) {
      console.log(`[Text] 🏷️ Category keyword: ${keyword}`);
      return handleButtonClick(buttonId, phone, lang, env);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 6: Action keywords
  // ─────────────────────────────────────────────────────────────
  for (const [keyword, buttonId] of Object.entries(ACTION_KEYWORDS)) {
    if (lowerText.includes(keyword)) {
      console.log(`[Text] 🎯 Action keyword: ${keyword}`);
      return handleButtonClick(buttonId, phone, lang, env);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 7: Pincode detection (for delivery check)
  // ─────────────────────────────────────────────────────────────
  const pincode = extractPincode(text);
  if (pincode) {
    console.log(`[Text] 📍 Pincode detected: ${pincode}`);
    return handlePincodeInput(pincode, phone, lang, env);
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 8: Greeting patterns
  // ─────────────────────────────────────────────────────────────
  if (isGreeting(lowerText)) {
    console.log('[Text] 👋 Greeting detected');
    return sendPersonalizedGreeting(phone, customerData, lang, env);
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 9: Thank you patterns
  // ─────────────────────────────────────────────────────────────
  if (isThankYou(lowerText)) {
    console.log('[Text] 🙏 Thank you detected');
    return sendThankYouResponse(phone, lang, env);
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 10: AI Response (if enabled and appropriate)
  // ─────────────────────────────────────────────────────────────
  if (env.OPENAI_API_KEY && shouldUseAI(text, customerData)) {
    try {
      const aiHandled = await handleAIResponseWithTimeout(text, phone, lang, customerData, env);
      if (aiHandled) {
        console.log('[Text] 🤖 AI handled');
        return;
      }
    } catch (aiError) {
      console.warn('[Text] AI error:', aiError.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Default: Smart fallback
  // ─────────────────────────────────────────────────────────────
  console.log('[Text] 🏠 No match, sending smart fallback');
  return sendSmartFallback(phone, text, customerData, lang, env);
}

// ═══════════════════════════════════════════════════════════════
// INTERACTIVE MESSAGE HANDLER (Buttons & Lists)
// ═══════════════════════════════════════════════════════════════

async function handleInteractiveMessage(message, phone, lang, env) {
  const interactive = message.interactive;
  const type = interactive?.type;

  if (!type) {
    console.log('[Interactive] ⚠️ Missing type');
    return sendMainMenu(phone, lang, env);
  }

  switch (type) {
    case 'button_reply': {
      const buttonId = interactive.button_reply?.id;
      const buttonTitle = interactive.button_reply?.title;
      
      console.log(`[Interactive] 🔘 Button: ${buttonId} - "${buttonTitle}"`);
      
      if (!buttonId) {
        console.log('[Interactive] ⚠️ Missing button ID');
        return sendMainMenu(phone, lang, env);
      }
      
      // Log button click
      logButtonClick(buttonId, buttonTitle, phone, env).catch(() => {});

      return handleButtonClick(buttonId, phone, lang, env);
    }

    case 'list_reply': {
      const listId = interactive.list_reply?.id;
      const listTitle = interactive.list_reply?.title;
      const listDescription = interactive.list_reply?.description;
      
      console.log(`[Interactive] 📋 List: ${listId} - "${listTitle}"`);
      
      if (!listId) {
        console.log('[Interactive] ⚠️ Missing list ID');
        return sendMainMenu(phone, lang, env);
      }
      
      // Log list selection
      logListSelection(listId, listTitle, phone, env).catch(() => {});

      return handleButtonClick(listId, phone, lang, env);
    }

    case 'nfm_reply': {
      // Flow message reply
      const responseJson = interactive.nfm_reply?.response_json;
      console.log(`[Interactive] 📝 Flow reply received`);
      
      if (responseJson) {
        try {
          const flowData = JSON.parse(responseJson);
          return handleFlowResponse(flowData, phone, lang, env);
        } catch (e) {
          console.error('[Interactive] Flow parse error:', e.message);
        }
      }
      return sendMainMenu(phone, lang, env);
    }

    case 'product_list_reply':
    case 'product': {
      const product = interactive.product_list_reply || interactive.product;
      console.log(`[Interactive] 🛍️ Product selected:`, product?.product_retailer_id);
      return handleProductSelection(product, phone, lang, env);
    }

    case 'catalog_message': {
      console.log('[Interactive] 📦 Catalog interaction');
      return handleButtonClick('OPEN_CATALOG', phone, lang, env);
    }

    default:
      console.log(`[Interactive] ⚠️ Unknown type: ${type}`);
      return sendMainMenu(phone, lang, env);
  }
}

// ═══════════════════════════════════════════════════════════════
// LOCATION MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleLocationMessage(message, phone, lang, env) {
  const location = message.location;
  
  if (!location) {
    return sendMainMenu(phone, lang, env);
  }

  console.log(`[Location] 📍 Received:`, {
    lat: location.latitude,
    lng: location.longitude,
    name: location.name?.slice(0, 50),
    address: location.address?.slice(0, 100)
  });

  // Save location to customer profile
  await saveCustomerLocation(phone, location, env).catch(() => {});

  // Check if in order flow expecting address
  const activeFlow = await getConversationState(phone, env);
  if (activeFlow?.current_flow === 'order' && 
      ['address', 'location', 'delivery'].includes(activeFlow?.current_step)) {
    const address = location.address || location.name || 
                    `${location.latitude}, ${location.longitude}`;
    
    return handleOrderFlow('LOCATION_RECEIVED', phone, { 
      address, 
      location: {
        lat: location.latitude,
        lng: location.longitude,
        name: location.name,
        address: location.address
      }
    }, lang, env);
  }

  // Default response
  const address = location.address || location.name || 'Your location';
  
  return sendReplyButtons(phone, 
    `📍 *Location Received!*\n\n` +
    `${address}\n\n` +
    `We deliver across India 🇮🇳\n` +
    `Estimated delivery: 3-5 business days\n\n` +
    `Would you like to place an order?`,
    [
      { id: 'START_ORDER', title: '🛒 Place Order' },
      { id: 'OPEN_CATALOG', title: '📱 View Catalog' },
      { id: 'MAIN_MENU', title: '🏠 Main Menu' }
    ],
    env
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTACTS MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleContactsMessage(message, phone, lang, env) {
  const contacts = message.contacts;
  
  console.log(`[Contacts] 📱 Received ${contacts?.length || 0} contact(s)`);

  if (!contacts || contacts.length === 0) {
    return sendMainMenu(phone, lang, env);
  }

  // Extract first contact info
  const contact = contacts[0];
  const contactName = contact.name?.formatted_name || 'Shared Contact';
  const contactPhone = contact.phones?.[0]?.phone;

  // Check if in referral/order flow
  const activeFlow = await getConversationState(phone, env);
  if (activeFlow?.current_flow === 'referral') {
    return handleOrderFlow('REFERRAL_CONTACT', phone, { 
      contact: contactPhone,
      name: contactName 
    }, lang, env);
  }

  return sendText(phone, 
    `📱 *Contact Received!*\n\n` +
    `Name: ${contactName}\n` +
    `${contactPhone ? `Phone: ${contactPhone}\n` : ''}\n` +
    `Thanks for sharing! For orders, please:\n\n` +
    `1️⃣ Browse our catalog\n` +
    `2️⃣ Select products you love\n` +
    `3️⃣ Share your delivery address\n\n` +
    `Our team will assist you! 💎`,
    env
  );
}

// ═══════════════════════════════════════════════════════════════
// NATIVE WHATSAPP ORDER MESSAGE
// ═══════════════════════════════════════════════════════════════

async function handleNativeOrderMessage(message, phone, lang, env) {
  const order = message.order;
  
  if (!order) {
    return sendMainMenu(phone, lang, env);
  }

  const products = order.product_items || [];
  const catalogId = order.catalog_id;
  
  console.log(`[Order] 🛒 Native WhatsApp order:`, {
    catalogId,
    productCount: products.length,
    products: products.map(p => p.product_retailer_id)
  });

  if (products.length === 0) {
    return sendText(phone, 
      `Your cart appears to be empty! 🛒\n\n` +
      `Browse our catalog and add items to place an order.`,
      env
    );
  }

  // Process the native catalog order
  return handleOrderFlow('CATALOG_ORDER', phone, { 
    products,
    catalogId,
    source: 'whatsapp_native'
  }, lang, env);
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleTemplateButton(message, phone, lang, env) {
  const payload = message.button?.payload;
  const text = message.button?.text;
  
  console.log(`[Template] 📑 Button:`, { payload, text });

  // Track template button click
  logButtonClick(payload || text, 'template', phone, env).catch(() => {});

  if (payload) {
    return handleButtonClick(payload, phone, lang, env);
  }

  if (text) {
    // Treat button text as regular text message
    return handleTextMessage({ text: { body: text } }, phone, lang, null, env);
  }

  return sendMainMenu(phone, lang, env);
}

// ═══════════════════════════════════════════════════════════════
// REACTION MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleReactionMessage(message, phone, env) {
  const reaction = message.reaction;
  const emoji = reaction?.emoji;
  const reactedMessageId = reaction?.message_id;
  
  console.log(`[Reaction] ${emoji} on message ${reactedMessageId?.slice(-10)}`);

  // Log reaction for analytics
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, data, created_at)
    VALUES ('reaction', ?, ?, ?, datetime('now'))
  `).bind(
    emoji || 'unknown',
    phone,
    JSON.stringify({ message_id: reactedMessageId, emoji })
  ).run().catch(() => {});

  // No response needed for reactions
}

// ═══════════════════════════════════════════════════════════════
// STATUS UPDATE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleStatusUpdates(statuses, env) {
  const statusPromises = statuses.map(status => 
    handleSingleStatus(status, env)
  );
  
  await Promise.allSettled(statusPromises);
}

async function handleSingleStatus(status, env) {
  const messageId = status.id;
  const recipientId = status.recipient_id;
  const statusType = status.status;
  const timestamp = status.timestamp;
  const errors = status.errors;

  // Log based on status type
  const emoji = {
    'sent': '📤',
    'delivered': '✅',
    'read': '👁️',
    'failed': '❌'
  }[statusType] || '📋';

  console.log(`[Status] ${emoji} ${statusType.toUpperCase()}: ${recipientId?.slice(-10)} - ${messageId?.slice(-10)}`);

  try {
    // Update message status in database
    await env.DB.prepare(`
      UPDATE messages 
      SET 
        status = ?,
        status_timestamp = ?,
        updated_at = datetime('now')
      WHERE message_id = ?
    `).bind(statusType, timestamp, messageId).run();

    // Log analytics
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, created_at)
      VALUES ('message_status', ?, ?, ?, datetime('now'))
    `).bind(
      statusType, 
      recipientId, 
      JSON.stringify({ 
        messageId: messageId?.slice(-20), 
        errors: errors || null 
      })
    ).run();

    // Handle failures
    if (statusType === 'failed' && errors) {
      await handleMessageFailure(messageId, recipientId, errors, env);
    }

    // Update chat with read status
    if (statusType === 'read') {
      await env.DB.prepare(`
        UPDATE chats 
        SET last_read_at = datetime('now')
        WHERE phone = ?
      `).bind(normalizeIN(recipientId)).run();
    }

  } catch (error) {
    console.error(`[Status] DB error:`, error.message);
  }
}

async function handleMessageFailure(messageId, recipientId, errors, env) {
  console.error(`[Status] ❌ Message failed:`, {
    messageId: messageId?.slice(-10),
    recipient: recipientId?.slice(-10),
    errors
  });

  // Check error type
  const errorCode = errors?.[0]?.code;
  const errorTitle = errors?.[0]?.title;

  // Log failure reason
  await env.DB.prepare(`
    INSERT INTO message_failures (message_id, phone, error_code, error_message, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).bind(
    messageId,
    recipientId,
    errorCode || 0,
    errorTitle || 'Unknown error'
  ).run().catch(() => {});

  // Handle specific error types
  switch (errorCode) {
    case 131047: // Re-engagement required
      // Customer hasn't messaged in 24 hours
      console.log('[Status] Customer needs re-engagement');
      break;
    
    case 131051: // Unsupported message type
      console.log('[Status] Unsupported message type');
      break;
    
    case 130429: // Rate limit
      console.log('[Status] Rate limit hit');
      break;
    
    case 131026: // Phone number not on WhatsApp
      await markPhoneAsInvalid(recipientId, env);
      break;
  }
}

// ═══════════════════════════════════════════════════════════════
// DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════

async function saveMessage(message, phone, customerName, timestamp, env) {
  const messageType = message.type;
  let text = '';
  let mediaId = null;
  let mediaUrl = null;
  let buttonId = null;
  let buttonTitle = null;
  let replyToId = null;

  // Extract text and media based on type
  switch (messageType) {
    case 'text':
      text = message.text?.body || '';
      break;
    case 'image':
      text = message.image?.caption || '[Image]';
      mediaId = message.image?.id;
      mediaUrl = message.image?.url;
      break;
    case 'video':
      text = message.video?.caption || '[Video]';
      mediaId = message.video?.id;
      break;
    case 'audio':
      text = '[Audio Message]';
      mediaId = message.audio?.id;
      break;
    case 'document':
      text = message.document?.caption || `[Document: ${message.document?.filename || 'file'}]`;
      mediaId = message.document?.id;
      break;
    case 'sticker':
      text = '[Sticker]';
      mediaId = message.sticker?.id;
      break;
    case 'location':
      text = `[Location: ${message.location?.name || message.location?.address || 'Shared'}]`;
      break;
    case 'contacts':
      const contactName = message.contacts?.[0]?.name?.formatted_name || 'Unknown';
      text = `[Contact: ${contactName}]`;
      break;
    case 'interactive':
      if (message.interactive?.button_reply) {
        buttonId = message.interactive.button_reply.id;
        buttonTitle = message.interactive.button_reply.title;
        text = `[Button: ${buttonTitle}]`;
      } else if (message.interactive?.list_reply) {
        buttonId = message.interactive.list_reply.id;
        buttonTitle = message.interactive.list_reply.title;
        text = `[List: ${buttonTitle}]`;
      } else {
        text = '[Interactive]';
      }
      break;
    case 'order':
      const itemCount = message.order?.product_items?.length || 0;
      text = `[WhatsApp Order: ${itemCount} items]`;
      break;
    case 'reaction':
      text = `[Reaction: ${message.reaction?.emoji || '👍'}]`;
      break;
    default:
      text = `[${messageType}]`;
  }

  // Check for reply context
  if (message.context?.id) {
    replyToId = message.context.id;
  }

  try {
    await env.DB.prepare(`
      INSERT INTO messages (
        message_id, phone, text, direction, message_type, timestamp,
        media_id, media_url, button_id, button_title,
        context_message_id, forwarded, frequently_forwarded,
        created_at
      ) VALUES (?, ?, ?, 'incoming', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      message.id,
      phone,
      sanitize(text, 1000),
      messageType,
      timestamp,
      mediaId,
      mediaUrl,
      buttonId,
      buttonTitle,
      replyToId,
      message.context?.forwarded ? 1 : 0,
      message.context?.frequently_forwarded ? 1 : 0
    ).run();

    return true;
  } catch (error) {
    // Handle duplicate key error gracefully
    if (error.message?.includes('UNIQUE constraint')) {
      console.log('[DB] Message already exists:', message.id.slice(-10));
      return false;
    }
    console.error('[DB] Save message failed:', error.message);
    return false;
  }
}

async function updateChat(phone, customerName, message, timestamp, env) {
  const text = message.text?.body || 
               message.interactive?.button_reply?.title ||
               message.interactive?.list_reply?.title ||
               `[${message.type}]`;

  try {
    // Try to update existing chat
    const result = await env.DB.prepare(`
      UPDATE chats SET
        customer_name = COALESCE(NULLIF(?, ''), customer_name),
        last_message = ?,
        last_message_type = ?,
        last_timestamp = ?,
        last_direction = 'incoming',
        unread_count = unread_count + 1,
        total_messages = total_messages + 1,
        last_customer_message_at = ?,
        needs_attention = CASE WHEN status = 'resolved' THEN 1 ELSE needs_attention END,
        status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END,
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(
      customerName,
      sanitize(text, 500),
      message.type,
      timestamp,
      timestamp,
      phone
    ).run();

    // If no rows updated, create new chat
    if (result.meta.changes === 0) {
      await env.DB.prepare(`
        INSERT INTO chats (
          phone, customer_name, last_message, last_message_type,
          last_timestamp, last_direction, unread_count, total_messages,
          first_message_at, last_customer_message_at, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'incoming', 1, 1, ?, ?, 'open', datetime('now'), datetime('now'))
      `).bind(
        phone,
        customerName || 'Unknown',
        sanitize(text, 500),
        message.type,
        timestamp,
        timestamp,
        timestamp
      ).run();
    }

    return true;
  } catch (error) {
    console.error('[DB] Update chat failed:', error.message);
    return false;
  }
}

async function updateCustomer(phone, customerName, lang, env) {
  try {
    const result = await env.DB.prepare(`
      UPDATE customers SET
        name = COALESCE(NULLIF(?, ''), name),
        message_count = message_count + 1,
        last_seen = datetime('now'),
        language = COALESCE(?, language, 'en'),
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(customerName, lang, phone).run();

    // If no rows updated, create new customer
    if (result.meta.changes === 0) {
      await env.DB.prepare(`
        INSERT INTO customers (
          phone, name, language, first_seen, last_seen, 
          message_count, segment, created_at
        ) VALUES (?, ?, ?, datetime('now'), datetime('now'), 1, 'new', datetime('now'))
      `).bind(phone, customerName || 'Unknown', lang || 'en').run();
    }

    return true;
  } catch (error) {
    console.error('[DB] Update customer failed:', error.message);
    return false;
  }
}

async function getCustomerLanguage(phone, env) {
  try {
    const result = await env.DB.prepare(`
      SELECT language FROM customers WHERE phone = ?
    `).bind(phone).first();
    return result?.language || 'en';
  } catch {
    return 'en';
  }
}

async function getCustomerData(phone, env) {
  try {
    const customer = await env.DB.prepare(`
      SELECT * FROM customers WHERE phone = ?
    `).bind(phone).first();
    
    if (customer) {
      return {
        ...customer,
        labels: safeParseJSON(customer.labels, [])
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

async function getConversationState(phone, env) {
  try {
    const state = await env.DB.prepare(`
      SELECT * FROM conversation_state 
      WHERE phone = ? AND expires_at > datetime('now')
    `).bind(phone).first();
    
    if (state) {
      return {
        ...state,
        flow_data: safeParseJSON(state.flow_data, {})
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

async function clearConversationState(phone, env) {
  try {
    await env.DB.prepare(`
      DELETE FROM conversation_state WHERE phone = ?
    `).bind(phone).run();
  } catch (error) {
    console.error('[DB] Clear state failed:', error.message);
  }
}

async function saveCustomerLocation(phone, location, env) {
  try {
    await env.DB.prepare(`
      UPDATE customers SET
        last_location_lat = ?,
        last_location_lng = ?,
        last_location_address = ?,
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(
      location.latitude,
      location.longitude,
      location.address || location.name,
      phone
    ).run();
  } catch (error) {
    console.error('[DB] Save location failed:', error.message);
  }
}

async function markPhoneAsInvalid(phone, env) {
  try {
    await env.DB.prepare(`
      UPDATE customers SET
        is_valid_whatsapp = 0,
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(normalizeIN(phone)).run();
  } catch (error) {
    console.error('[DB] Mark invalid failed:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// FLOW HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleActiveFlow(state, message, phone, lang, env) {
  const flow = state.current_flow;
  const step = state.current_step;
  const flowData = state.flow_data || {};
  
  console.log(`[Flow] 🔄 Active: ${flow}/${step}`);

  // Check for cancel commands
  const messageText = message.text?.body?.toLowerCase() || '';
  if (['cancel', 'exit', 'quit', 'stop', 'back'].includes(messageText)) {
    await clearConversationState(phone, env);
    await sendText(phone, 'Cancelled! ✅', env);
    await sendMainMenu(phone, lang, env);
    return true;
  }

  switch (flow) {
    case 'order':
      return handleOrderFlow(step, phone, { message, flowData }, lang, env);
    
    case 'support':
      return handleSupportFlow(step, phone, { message, flowData }, lang, env);
    
    case 'feedback':
      return handleFeedbackFlow(step, phone, { message, flowData }, lang, env);
    
    case 'referral':
      return handleReferralFlow(step, phone, { message, flowData }, lang, env);
    
    default:
      console.log(`[Flow] Unknown flow: ${flow}`);
      await clearConversationState(phone, env);
      return false;
  }
}

async function handleSupportFlow(step, phone, data, lang, env) {
  // Handle support conversation flow
  console.log('[Support] Flow step:', step);
  return false; // Not handled, fall through
}

async function handleFeedbackFlow(step, phone, data, lang, env) {
  // Handle feedback collection flow
  console.log('[Feedback] Flow step:', step);
  return false;
}

async function handleReferralFlow(step, phone, data, lang, env) {
  // Handle referral program flow
  console.log('[Referral] Flow step:', step);
  return false;
}

async function handleOrderTracking(orderId, phone, lang, env) {
  try {
    const order = await env.DB.prepare(`
      SELECT * FROM orders WHERE order_id = ? OR order_id LIKE ?
    `).bind(orderId, `%${orderId}%`).first();

    if (!order) {
      return sendReplyButtons(phone, 
        `❌ Order *${orderId}* not found.\n\n` +
        `Please check the order ID and try again.\n` +
        `Format: KAA-XXXXXX\n\n` +
        `Or contact our support team for help.`,
        [
          { id: 'CHAT_NOW', title: '💬 Contact Support' },
          { id: 'MAIN_MENU', title: '🏠 Main Menu' }
        ],
        env
      );
    }

    // Build status timeline
    const statusEmoji = {
      'pending': '⏳',
      'confirmed': '✅',
      'processing': '⚙️',
      'packed': '📦',
      'shipped': '🚚',
      'out_for_delivery': '🛵',
      'delivered': '🎉',
      'cancelled': '❌',
      'returned': '↩️'
    };

    const emoji = statusEmoji[order.status] || '📦';
    const statusText = order.status.replace(/_/g, ' ').toUpperCase();

    let response = `${emoji} *Order: ${order.order_id}*\n\n`;
    response += `📋 *Status:* ${statusText}\n`;
    response += `💰 *Total:* ₹${order.total?.toLocaleString()}\n`;
    response += `📅 *Placed:* ${formatDate(order.created_at)}\n`;
    
    if (order.tracking_id) {
      response += `\n📦 *Tracking ID:* ${order.tracking_id}\n`;
      if (order.courier) {
        response += `🚚 *Courier:* ${order.courier}\n`;
      }
    }

    if (order.status === 'shipped' && order.estimated_delivery) {
      response += `\n📅 *Expected:* ${formatDate(order.estimated_delivery)}\n`;
    }

    // Add tracking link if available
    const buttons = [];
    
    if (order.tracking_url) {
      buttons.push({ id: 'TRACK_SHIPMENT', title: '📍 Track Shipment' });
    }
    
    buttons.push(
      { id: 'CHAT_NOW', title: '💬 Need Help?' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    );

    // Store order ID for tracking button
    if (order.tracking_url) {
      await setConversationState(phone, 'order_tracking', 'view', {
        orderId: order.order_id,
        trackingUrl: order.tracking_url
      }, env);
    }

    return sendReplyButtons(phone, response, buttons.slice(0, 3), env);

  } catch (error) {
    console.error('[Tracking] Error:', error.message);
    return sendText(phone, 
      `Sorry, we couldn't retrieve order information.\n\n` +
      `Please try again or contact our support team.`,
      env
    );
  }
}

async function handleOrdersByPhone(lookupPhone, phone, lang, env) {
  try {
    const { results: orders } = await env.DB.prepare(`
      SELECT order_id, status, total, created_at
      FROM orders 
      WHERE phone = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).bind(lookupPhone).all();

    if (!orders || orders.length === 0) {
      return sendText(phone, 
        `No orders found for this phone number.\n\n` +
        `If you have an order ID, please share it to track your order.`,
        env
      );
    }

    let response = `📦 *Recent Orders*\n\n`;
    
    orders.forEach((order, i) => {
      const emoji = order.status === 'delivered' ? '✅' : '📦';
      response += `${i + 1}. ${emoji} *${order.order_id}*\n`;
      response += `   Status: ${order.status}\n`;
      response += `   ₹${order.total} | ${formatDate(order.created_at)}\n\n`;
    });

    response += `Reply with an order ID for details.`;

    return sendText(phone, response, env);

  } catch (error) {
    console.error('[OrdersByPhone] Error:', error.message);
    return sendMainMenu(phone, lang, env);
  }
}

async function handlePincodeInput(pincode, phone, lang, env) {
  // Check if in order flow
  const activeFlow = await getConversationState(phone, env);
  if (activeFlow?.current_flow === 'order' && 
      ['pincode', 'address', 'delivery'].includes(activeFlow?.current_step)) {
    return handleOrderFlow('PINCODE_RECEIVED', phone, { pincode }, lang, env);
  }

  // Check delivery availability
  const deliveryInfo = await checkDeliveryAvailability(pincode, env);
  
  if (deliveryInfo.available) {
    return sendReplyButtons(phone, 
      `✅ *Great News!*\n\n` +
      `📍 Pincode: ${pincode}\n` +
      `🚚 Delivery: Available\n` +
      `⏰ Estimated: ${deliveryInfo.days || '3-5'} business days\n` +
      `💰 Shipping: ${deliveryInfo.cost === 0 ? 'FREE' : '₹' + deliveryInfo.cost}\n\n` +
      `Would you like to place an order?`,
      [
        { id: 'START_ORDER', title: '🛒 Place Order' },
        { id: 'OPEN_CATALOG', title: '📱 View Catalog' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ],
      env
    );
  } else {
    return sendReplyButtons(phone,
      `❌ *Sorry!*\n\n` +
      `We currently don't deliver to pincode ${pincode}.\n\n` +
      `Please check back later or contact support for alternatives.`,
      [
        { id: 'CHAT_NOW', title: '💬 Contact Support' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ],
      env
    );
  }
}

async function checkDeliveryAvailability(pincode, env) {
  // Check if pincode is valid Indian format
  if (!/^[1-9]\d{5}$/.test(pincode)) {
    return { available: false, reason: 'invalid' };
  }

  try {
    // Check database for pincode restrictions
    const restriction = await env.DB.prepare(`
      SELECT * FROM delivery_pincodes WHERE pincode = ?
    `).bind(pincode).first();

    if (restriction?.blocked) {
      return { available: false, reason: 'blocked' };
    }

    // Get shipping zone
    const zone = getShippingZone(pincode);
    
    return {
      available: true,
      days: zone.days,
      cost: zone.cost,
      zone: zone.name
    };

  } catch (error) {
    // Default to available if check fails
    return { available: true, days: '5-7', cost: 0 };
  }
}

function getShippingZone(pincode) {
  // Simple zone calculation based on first 2 digits
  const prefix = parseInt(pincode.substring(0, 2));
  
  // Metro areas (faster delivery)
  const metroZones = [11, 12, 40, 41, 56, 60, 70, 80]; // Delhi, Mumbai, Bangalore, Chennai, Kolkata, Hyderabad
  
  if (metroZones.includes(prefix)) {
    return { name: 'metro', days: '2-3', cost: 0 };
  }
  
  // Tier 2 cities
  if (prefix >= 30 && prefix <= 99) {
    return { name: 'tier2', days: '3-5', cost: 0 };
  }
  
  // Remote areas
  return { name: 'remote', days: '5-7', cost: 50 };
}

async function handleFlowResponse(flowData, phone, lang, env) {
  console.log('[Flow] Response data:', flowData);
  
  // Handle based on flow type
  if (flowData.screen_name) {
    // WhatsApp Flow response
    const screenName = flowData.screen_name;
    const formData = flowData.data || {};
    
    console.log(`[Flow] Screen: ${screenName}`, formData);
    
    // Process based on screen
    switch (screenName) {
      case 'ORDER_DETAILS':
        return handleOrderFlow('FLOW_ORDER_DETAILS', phone, formData, lang, env);
      case 'ADDRESS':
        return handleOrderFlow('FLOW_ADDRESS', phone, formData, lang, env);
      case 'PAYMENT':
        return handleOrderFlow('FLOW_PAYMENT', phone, formData, lang, env);
      default:
        console.log(`[Flow] Unknown screen: ${screenName}`);
    }
  }
  
  return sendMainMenu(phone, lang, env);
}

async function handleProductSelection(product, phone, lang, env) {
  if (!product) {
    return sendMainMenu(phone, lang, env);
  }

  const productId = product.product_retailer_id;
  const quantity = product.quantity || 1;
  
  console.log('[Product] Selected:', { productId, quantity });

  // Look up product in database
  const productData = await env.DB.prepare(`
    SELECT * FROM products WHERE sku = ? OR id = ?
  `).bind(productId, productId).first();

  if (!productData) {
    return sendText(phone,
      `Sorry, this product is currently unavailable.\n\n` +
      `Please browse our catalog for available items.`,
      env
    );
  }

  return handleOrderFlow('PRODUCT_SELECTED', phone, { 
    product: productData,
    quantity 
  }, lang, env);
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function isGreeting(text) {
  const greetings = [
    'good morning', 'good afternoon', 'good evening', 'good night',
    'gm', 'morning', 'evening',
    'namaste', 'namaskar', 'pranam',
    'salam', 'salaam'
  ];
  return greetings.some(g => text.includes(g));
}

function isThankYou(text) {
  const thanks = [
    'thank', 'thanks', 'thankyou', 'thank you',
    'dhanyawad', 'dhanyavaad', 'shukriya',
    'appreciated', 'grateful'
  ];
  return thanks.some(t => text.includes(t));
}

function shouldUseAI(text, customerData) {
  // Use AI for longer, complex messages
  if (text.length < 10) return false;
  if (text.length > 500) return true;
  
  // Use AI for question-like messages
  if (text.includes('?')) return true;
  
  // Use AI for returning customers
  if (customerData?.order_count > 0) return true;
  
  // Random sampling for new customers
  return Math.random() < 0.3;
}

async function handleAIResponseWithTimeout(text, phone, lang, customerData, env) {
  const timeout = 8000; // 8 seconds
  
  const aiPromise = handleAIResponse(text, phone, lang, env, customerData);
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('AI timeout')), timeout);
  });
  
  try {
    return await Promise.race([aiPromise, timeoutPromise]);
  } catch (error) {
    console.warn('[AI] Timeout or error:', error.message);
    return false;
  }
}

async function sendPersonalizedGreeting(phone, customerData, lang, env) {
  const name = customerData?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  
  let greeting = 'Hello';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else greeting = 'Good evening';
  
  let message = `${greeting}, ${name}! 👋💎\n\n`;
  
  if (customerData?.order_count > 0) {
    message += `Welcome back! Great to see you again.\n\n`;
  } else {
    message += `Welcome to KAAPAV - your destination for exquisite jewelry! ✨\n\n`;
  }
  
  message += `How can I help you today?`;
  
  await sendText(phone, message, env);
  return sendMainMenu(phone, lang, env);
}

async function sendThankYouResponse(phone, lang, env) {
  const responses = [
    `You're welcome! 🙏\n\nIs there anything else I can help you with?`,
    `Happy to help! 😊\n\nFeel free to reach out anytime.`,
    `My pleasure! 💎\n\nLet me know if you need anything else.`
  ];
  
  const response = responses[Math.floor(Math.random() * responses.length)];
  
  return sendReplyButtons(phone, response, [
    { id: 'OPEN_CATALOG', title: '📱 Browse Catalog' },
    { id: 'MAIN_MENU', title: '🏠 Main Menu' }
  ], env);
}

async function sendSmartFallback(phone, text, customerData, lang, env) {
  // Analyze message for context
  const isQuestion = text.includes('?');
  const isLong = text.length > 100;
  
  let response = '';
  
  if (isQuestion) {
    response = `Thanks for your question! 🤔\n\n`;
    response += `For quick assistance, you can:\n\n`;
    response += `📱 *Browse Catalog* - See all products\n`;
    response += `📦 *Track Order* - Check order status\n`;
    response += `💬 *Chat Support* - Talk to our team\n\n`;
    response += `Or choose from the menu below:`;
  } else if (isLong) {
    response = `Thanks for your detailed message! 📝\n\n`;
    response += `Our team will review and respond shortly.\n\n`;
    response += `Meanwhile, here's what I can help with:`;
  } else {
    response = `Thanks for reaching out! 💎\n\n`;
    response += `Here's what I can help you with:`;
  }
  
  await sendText(phone, response, env);
  return sendMainMenu(phone, lang, env);
}

async function sendFallbackResponse(phone, lang, env) {
  await sendText(phone,
    `Oops! Something went wrong on our end. 😅\n\n` +
    `Please try again or contact our support team.`,
    env
  );
  return sendMainMenu(phone, lang, env);
}

async function sendQuickReplyResponse(quickReply, phone, env) {
  // Handle different response types
  switch (quickReply.response_type) {
    case 'buttons':
      const buttons = safeParseJSON(quickReply.buttons, []);
      if (buttons.length > 0) {
        return sendReplyButtons(phone, quickReply.response, buttons, env);
      }
      return sendText(phone, quickReply.response, env);
    
    case 'list':
      const { sendList } = await import('../utils/sendMessage.js');
      const listData = safeParseJSON(quickReply.list_data, null);
      if (listData) {
        return sendList(phone, quickReply.response, listData.button, listData.sections, env);
      }
      return sendText(phone, quickReply.response, env);
    
    case 'image':
      const { sendImage } = await import('../utils/sendMessage.js');
      if (quickReply.media_url) {
        return sendImage(phone, quickReply.media_url, quickReply.response, env);
      }
      return sendText(phone, quickReply.response, env);
    
    case 'text':
    default:
      return sendText(phone, quickReply.response, env);
  }
}

async function updateQuickReplyStats(id, env) {
  await env.DB.prepare(`
    UPDATE quick_replies 
    SET use_count = use_count + 1, last_used_at = datetime('now')
    WHERE id = ?
  `).bind(id).run();
}

async function setConversationState(phone, flow, step, data, env, expiresInMinutes = 30) {
  try {
    await env.DB.prepare(`
      INSERT INTO conversation_state (phone, current_flow, current_step, flow_data, expires_at, created_at)
      VALUES (?, ?, ?, ?, datetime('now', '+${expiresInMinutes} minutes'), datetime('now'))
      ON CONFLICT(phone) DO UPDATE SET
        current_flow = ?,
        current_step = ?,
        flow_data = ?,
        expires_at = datetime('now', '+${expiresInMinutes} minutes'),
        updated_at = datetime('now')
    `).bind(
      phone, flow, step, JSON.stringify(data),
      flow, step, JSON.stringify(data)
    ).run();
  } catch (error) {
    console.error('[State] Set failed:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// LOGGING & ANALYTICS
// ═══════════════════════════════════════════════════════════════

async function logAnalytics(eventType, phone, data, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      eventType,
      data.type || 'message',
      phone,
      JSON.stringify({
        type: data.type,
        text_length: data.text?.body?.length,
        has_media: !!data.image || !!data.video || !!data.document
      })
    ).run();
  } catch (error) {
    console.warn('[Analytics] Log failed:', error.message);
  }
}

async function logButtonClick(buttonId, buttonTitle, phone, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, created_at)
      VALUES ('button_click', ?, ?, ?, datetime('now'))
    `).bind(buttonId, phone, JSON.stringify({ title: buttonTitle })).run();
  } catch {
    // Ignore
  }
}

async function logListSelection(listId, listTitle, phone, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, created_at)
      VALUES ('list_selection', ?, ?, ?, datetime('now'))
    `).bind(listId, phone, JSON.stringify({ title: listTitle })).run();
  } catch {
    // Ignore
  }
}

async function logToExternalServices(message, phone, customerName, env) {
  // Log to N8N webhook if configured
  if (env.N8N_WEBHOOK_URL) {
    try {
      await fetch(env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'wa_incoming',
          phone,
          name: customerName,
          type: message.type,
          text: message.text?.body?.slice(0, 200) || `[${message.type}]`,
          timestamp: Date.now()
        })
      });
    } catch (e) {
      console.warn('[N8N] Webhook failed:', e.message);
    }
  }
}

async function logWebhookError(error, body, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO error_logs (error_type, error_message, error_stack, context, created_at)
      VALUES ('webhook', ?, ?, ?, datetime('now'))
    `).bind(
      error.message,
      error.stack?.slice(0, 1000),
      JSON.stringify({
        entry_id: body?.entry?.[0]?.id,
        field: body?.entry?.[0]?.changes?.[0]?.field
      })
    ).run();
  } catch {
    // Ignore
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function safeParseJSON(str, fallback = null) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function sanitize(input, maxLength = 1000) {
  if (!input) return '';
  if (typeof input !== 'string') return String(input);
  return input.trim().slice(0, maxLength);
}

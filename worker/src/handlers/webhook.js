/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - WEBHOOK HANDLER (REVISED)
 * ═══════════════════════════════════════════════════════════════
 * Processes all incoming WhatsApp webhook events
 * Compatible with YOUR sendMessage.js structure
 * ═══════════════════════════════════════════════════════════════
 */

import { handleButtonClick } from './buttonHandler.js';
import { handleOrderFlow } from './orderHandler.js';
import { handleAIResponse } from './aiHandler.js';
import { handleMediaMessage } from './mediaHandler.js';
import { 
  sendText, 
  sendMainMenu, 
  sendReaction,
  markAsRead,
  normalizeIN,
  LINKS
} from '../utils/sendMessage.js';
import { getQuickReply, extractOrderId, extractPincode } from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════
// WEBHOOK VERIFICATION (GET Request)
// ═══════════════════════════════════════════════════════════════

export function handleWebhookVerification(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  console.log('[Webhook] 🔐 Verification request:', { mode, tokenMatch: token === env.VERIFY_TOKEN });

  if (mode === 'subscribe' && token === env.VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verification successful');
    return new Response(challenge, { status: 200 });
  }

  console.log('[Webhook] ❌ Verification failed');
  return new Response('Forbidden', { status: 403 });
}

// ═══════════════════════════════════════════════════════════════
// WEBHOOK MESSAGE HANDLER (POST Request)
// ═══════════════════════════════════════════════════════════════

export async function handleWebhookMessage(body, env) {
  try {
    // Validate webhook structure
    if (!body?.entry?.[0]?.changes?.[0]?.value) {
      console.log('[Webhook] ⚠️ Invalid webhook structure');
      return;
    }

    const value = body.entry[0].changes[0].value;
    const field = body.entry[0].changes[0].field;

    // Only process messages field
    if (field !== 'messages') {
      console.log('[Webhook] 📋 Non-message field:', field);
      return;
    }

    // Handle status updates
    if (value.statuses) {
      await handleStatusUpdate(value.statuses, env);
      return;
    }

    // Handle incoming messages
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const contact = value.contacts?.[0];
      
      await processIncomingMessage(message, contact, env);
    }

  } catch (error) {
    console.error('[Webhook] ❌ Error:', error.message);
    console.error('[Webhook] Stack:', error.stack);
  }
}

// ═══════════════════════════════════════════════════════════════
// PROCESS INCOMING MESSAGE
// ═══════════════════════════════════════════════════════════════

async function processIncomingMessage(message, contact, env) {
  const phone = normalizeIN(message.from);
  const messageId = message.id;
  const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
  const messageType = message.type;
  const customerName = contact?.profile?.name || '';

  console.log(`[Webhook] 📥 Incoming from ${phone}:`, {
    type: messageType,
    name: customerName,
    id: messageId.slice(-10)
  });

  // Mark message as read (non-blocking)
  markAsRead(phone, messageId, env).catch(() => {});

  // Get customer language preference
  const lang = await getCustomerLanguage(phone, env);

  // ─────────────────────────────────────────────────────────────
  // Save to database
  // ─────────────────────────────────────────────────────────────
  await saveMessage(message, phone, customerName, timestamp, env);
  await updateChat(phone, customerName, message, timestamp, env);
  await updateCustomer(phone, customerName, env);

  // ─────────────────────────────────────────────────────────────
  // Log to Google Sheets (via N8N or direct)
  // ─────────────────────────────────────────────────────────────
  await logIncomingToSheets(message, phone, env);

  // ─────────────────────────────────────────────────────────────
  // Check for active conversation flow
  // ─────────────────────────────────────────────────────────────
  const activeFlow = await getConversationState(phone, env);
  if (activeFlow) {
    const handled = await handleActiveFlow(activeFlow, message, phone, lang, env);
    if (handled) return;
  }

  // ─────────────────────────────────────────────────────────────
  // Route by message type
  // ─────────────────────────────────────────────────────────────
  try {
    switch (messageType) {
      case 'text':
        await handleTextMessage(message, phone, lang, env);
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

      default:
        console.log(`[Webhook] ⚠️ Unhandled type: ${messageType}`);
        await sendMainMenu(phone, lang, env);
    }
  } catch (routeError) {
    console.error('[Webhook] Route error:', routeError.message);
    // Fallback to main menu on error
    await sendMainMenu(phone, lang, env).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
// TEXT MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleTextMessage(message, phone, lang, env) {
  const text = message.text?.body?.trim() || '';
  const lowerText = text.toLowerCase();

  console.log(`[Text] 💬 Processing: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);

  // ─────────────────────────────────────────────────────────────
  // Priority 1: Menu triggers
  // ─────────────────────────────────────────────────────────────
  const menuTriggers = ['menu', 'hi', 'hello', 'hey', 'hii', 'start', 'help', '0', 'home', 'main'];
  if (menuTriggers.includes(lowerText) || lowerText === '/menu') {
    console.log('[Text] 🏠 Menu trigger matched');
    return sendMainMenu(phone, lang, env);
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 2: Quick replies from database
  // ─────────────────────────────────────────────────────────────
  const quickReply = await getQuickReply(text, lang, env);
  if (quickReply) {
    console.log(`[Text] ⚡ Quick reply matched: "${quickReply.keyword}"`);
    
    // Update usage stats
    await env.DB.prepare(`
      UPDATE quick_replies 
      SET use_count = use_count + 1, last_used_at = datetime('now')
      WHERE id = ?
    `).bind(quickReply.id).run().catch(() => {});

    // Send response based on type
    if (quickReply.response_type === 'buttons' && quickReply.buttons) {
      const { sendReplyButtons } = await import('../utils/sendMessage.js');
      const buttons = JSON.parse(quickReply.buttons);
      return sendReplyButtons(phone, quickReply.response, buttons, env);
    }
    
    return sendText(phone, quickReply.response, env);
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
  // Priority 4: Category/Product keywords
  // ─────────────────────────────────────────────────────────────
  const categoryKeywords = {
    'earring': 'CAT_EARRINGS',
    'necklace': 'CAT_NECKLACES',
    'bangle': 'CAT_BANGLES',
    'ring': 'CAT_RINGS',
    'pendant': 'CAT_PENDANTS',
    'bracelet': 'CAT_BANGLES'
  };
  
  for (const [keyword, buttonId] of Object.entries(categoryKeywords)) {
    if (lowerText.includes(keyword)) {
      console.log(`[Text] 🏷️ Category keyword: ${keyword}`);
      return handleButtonClick(buttonId, phone, lang, env);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 5: Action keywords
  // ─────────────────────────────────────────────────────────────
  const actionKeywords = {
    'order': 'START_ORDER',
    'buy': 'START_ORDER',
    'purchase': 'START_ORDER',
    'catalog': 'OPEN_CATALOG',
    'catalogue': 'OPEN_CATALOG',
    'shop': 'OPEN_CATALOG',
    'pay': 'PAY_NOW',
    'payment': 'PAY_NOW',
    'track': 'TRACK_ORDER',
    'tracking': 'TRACK_ORDER',
    'status': 'TRACK_ORDER',
    'offer': 'OFFERS_MENU',
    'discount': 'OFFERS_MENU',
    'sale': 'BESTSELLERS',
    'support': 'CHAT_NOW',
    'complaint': 'CHAT_NOW',
    'return': 'CHAT_NOW',
    'refund': 'CHAT_NOW',
    'exchange': 'CHAT_NOW'
  };
  
  for (const [keyword, buttonId] of Object.entries(actionKeywords)) {
    if (lowerText.includes(keyword)) {
      console.log(`[Text] 🎯 Action keyword: ${keyword}`);
      return handleButtonClick(buttonId, phone, lang, env);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 6: Pincode detection (for delivery)
  // ─────────────────────────────────────────────────────────────
  const pincode = extractPincode(text);
  if (pincode) {
    console.log(`[Text] 📍 Pincode detected: ${pincode}`);
    return handlePincodeInput(pincode, phone, lang, env);
  }

  // ─────────────────────────────────────────────────────────────
  // Priority 7: AI Response (if enabled)
  // ─────────────────────────────────────────────────────────────
  if (env.OPENAI_API_KEY) {
    try {
      const aiHandled = await handleAIResponse(text, phone, lang, env);
      if (aiHandled) {
        console.log('[Text] 🤖 AI handled');
        return;
      }
    } catch (aiError) {
      console.warn('[Text] AI error:', aiError.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Default: Main Menu
  // ─────────────────────────────────────────────────────────────
  console.log('[Text] 🏠 No match, sending main menu');
  
  // Send a friendly "I didn't understand" message before menu
  await sendText(phone, 
    `Thanks for your message! 💎\n\nHere's what I can help you with:`,
    env
  );
  
  return sendMainMenu(phone, lang, env);
}

// ═══════════════════════════════════════════════════════════════
// INTERACTIVE MESSAGE HANDLER (Buttons & Lists)
// ═══════════════════════════════════════════════════════════════

async function handleInteractiveMessage(message, phone, lang, env) {
  const interactive = message.interactive;
  const type = interactive.type;

  if (type === 'button_reply') {
    const buttonId = interactive.button_reply.id;
    const buttonTitle = interactive.button_reply.title;
    
    console.log(`[Interactive] 🔘 Button: ${buttonId} - "${buttonTitle}"`);
    
    // Save button info to message record
    await env.DB.prepare(`
      UPDATE messages SET button_id = ?, button_title = ?
      WHERE message_id = ?
    `).bind(buttonId, buttonTitle, message.id).run().catch(() => {});

    return handleButtonClick(buttonId, phone, lang, env);
  }

  if (type === 'list_reply') {
    const listId = interactive.list_reply.id;
    const listTitle = interactive.list_reply.title;
    
    console.log(`[Interactive] 📋 List: ${listId} - "${listTitle}"`);
    
    // Save list info
    await env.DB.prepare(`
      UPDATE messages SET list_id = ?, list_title = ?
      WHERE message_id = ?
    `).bind(listId, listTitle, message.id).run().catch(() => {});

    return handleButtonClick(listId, phone, lang, env);
  }

  if (type === 'nfm_reply') {
    // Flow message reply
    const responseJson = interactive.nfm_reply?.response_json;
    console.log(`[Interactive] 📝 Flow reply:`, responseJson);
    return handleFlowResponse(responseJson, phone, lang, env);
  }

  if (type === 'product_list_reply' || type === 'product') {
    const product = interactive.product_list_reply || interactive.product;
    console.log(`[Interactive] 🛍️ Product selected:`, product);
    return handleProductSelection(product, phone, lang, env);
  }

  console.log(`[Interactive] ⚠️ Unknown type: ${type}`);
  return sendMainMenu(phone, lang, env);
}

// ═══════════════════════════════════════════════════════════════
// LOCATION MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleLocationMessage(message, phone, lang, env) {
  const location = message.location;
  
  console.log(`[Location] 📍 Received:`, {
    lat: location.latitude,
    lng: location.longitude,
    name: location.name,
    address: location.address
  });

  // Check if in order flow expecting address
  const activeFlow = await getConversationState(phone, env);
  if (activeFlow?.current_flow === 'order' && activeFlow?.current_step === 'address') {
    const address = location.address || location.name || `${location.latitude}, ${location.longitude}`;
    
    // Update order with location
    await handleOrderFlow('LOCATION_RECEIVED', phone, { address, location }, lang, env);
    return;
  }

  // Default response
  const { sendReplyButtons } = await import('../utils/sendMessage.js');
  return sendReplyButtons(phone, 
    `📍 *Location Received!*\n\n` +
    `${location.address || location.name || 'Your location'}\n\n` +
    `We deliver across India 🇮🇳\n` +
    `Would you like to place an order?`,
    [
      { id: 'START_ORDER', title: '🛒 Place Order' },
      { id: 'OPEN_CATALOG', title: '📱 View Catalog' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
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

  return sendText(phone, 
    `📱 *Contact Received!*\n\n` +
    `Thanks for sharing! For orders, please:\n\n` +
    `1️⃣ Share product name/image\n` +
    `2️⃣ Share delivery address\n\n` +
    `Our team will assist you! 💎`,
    env
  );
}

// ═══════════════════════════════════════════════════════════════
// NATIVE WHATSAPP ORDER MESSAGE
// ═══════════════════════════════════════════════════════════════

async function handleNativeOrderMessage(message, phone, lang, env) {
  const order = message.order;
  const products = order.product_items;
  
  console.log(`[Order] 🛒 Native WhatsApp order:`, {
    catalogId: order.catalog_id,
    productCount: products?.length
  });

  // Process the native catalog order
  return handleOrderFlow('CATALOG_ORDER', phone, { 
    products,
    catalogId: order.catalog_id 
  }, lang, env);
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleTemplateButton(message, phone, lang, env) {
  const payload = message.button?.payload;
  const text = message.button?.text;
  
  console.log(`[Template] 📑 Button:`, { payload, text });

  if (payload) {
    return handleButtonClick(payload, phone, lang, env);
  }

  if (text) {
    return handleTextMessage({ text: { body: text } }, phone, lang, env);
  }

  return sendMainMenu(phone, lang, env);
}

// ═══════════════════════════════════════════════════════════════
// STATUS UPDATE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleStatusUpdate(statuses, env) {
  for (const status of statuses) {
    const messageId = status.id;
    const recipientId = status.recipient_id;
    const statusType = status.status;
    const errors = status.errors;

    console.log(`[Status] ${statusType.toUpperCase()}: ${recipientId} - ${messageId.slice(-10)}`);

    // Update message status in database
    await env.DB.prepare(`
      UPDATE messages 
      SET status = ?, updated_at = datetime('now')
      WHERE message_id = ?
    `).bind(statusType, messageId).run().catch(() => {});

    // Log analytics
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, timestamp)
      VALUES ('message_status', ?, ?, ?, datetime('now'))
    `).bind(
      statusType, 
      recipientId, 
      JSON.stringify({ messageId, errors })
    ).run().catch(() => {});

    // Handle failures
    if (statusType === 'failed' && errors) {
      console.error(`[Status] ❌ Failed:`, errors);
      // Could trigger alert or retry logic here
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// DATABASE HELPERS
// ═══════════════════════════════════════════════════════════════

async function saveMessage(message, phone, customerName, timestamp, env) {
  const messageType = message.type;
  let text = '';
  let mediaId = null;
  let buttonId = null;
  let buttonTitle = null;

  switch (messageType) {
    case 'text':
      text = message.text?.body || '';
      break;
    case 'image':
      text = message.image?.caption || '[Image]';
      mediaId = message.image?.id;
      break;
    case 'video':
      text = message.video?.caption || '[Video]';
      mediaId = message.video?.id;
      break;
    case 'audio':
      text = '[Audio]';
      mediaId = message.audio?.id;
      break;
    case 'document':
      text = message.document?.caption || `[Document: ${message.document?.filename}]`;
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
      text = `[Contact: ${message.contacts?.[0]?.name?.formatted_name || 'Shared'}]`;
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
      }
      break;
    case 'order':
      text = '[WhatsApp Order]';
      break;
    default:
      text = `[${messageType}]`;
  }

  try {
    await env.DB.prepare(`
      INSERT INTO messages (
        message_id, phone, text, direction, message_type, timestamp,
        media_id, button_id, button_title,
        context_message_id, forwarded
      ) VALUES (?, ?, ?, 'incoming', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      message.id,
      phone,
      text.slice(0, 1000),
      messageType,
      timestamp,
      mediaId,
      buttonId,
      buttonTitle,
      message.context?.id || null,
      message.context?.forwarded ? 1 : 0
    ).run();
  } catch (error) {
    console.error('[DB] Save message failed:', error.message);
  }
}

async function updateChat(phone, customerName, message, timestamp, env) {
  const text = message.text?.body || 
               message.interactive?.button_reply?.title || 
               `[${message.type}]`;

  try {
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
      text.slice(0, 500),
      message.type,
      timestamp,
      timestamp,
      phone
    ).run();

    if (result.meta.changes === 0) {
      await env.DB.prepare(`
        INSERT INTO chats (
          phone, customer_name, last_message, last_message_type,
          last_timestamp, last_direction, unread_count, total_messages,
          first_message_at, last_customer_message_at, status
        ) VALUES (?, ?, ?, ?, ?, 'incoming', 1, 1, ?, ?, 'open')
      `).bind(
        phone,
        customerName,
        text.slice(0, 500),
        message.type,
        timestamp,
        timestamp,
        timestamp
      ).run();
    }
  } catch (error) {
    console.error('[DB] Update chat failed:', error.message);
  }
}

async function updateCustomer(phone, customerName, env) {
  try {
    const result = await env.DB.prepare(`
      UPDATE customers SET
        name = COALESCE(NULLIF(?, ''), name),
        message_count = message_count + 1,
        last_seen = datetime('now'),
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(customerName, phone).run();

    if (result.meta.changes === 0) {
      await env.DB.prepare(`
        INSERT INTO customers (
          phone, name, first_seen, last_seen, message_count, segment
        ) VALUES (?, ?, datetime('now'), datetime('now'), 1, 'new')
      `).bind(phone, customerName).run();
    }
  } catch (error) {
    console.error('[DB] Update customer failed:', error.message);
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

async function getConversationState(phone, env) {
  try {
    const state = await env.DB.prepare(`
      SELECT * FROM conversation_state 
      WHERE phone = ? AND expires_at > datetime('now')
    `).bind(phone).first();
    return state;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// FLOW HANDLERS
// ═══════════════════════════════════════════════════════════════

async function handleActiveFlow(state, message, phone, lang, env) {
  const flow = state.current_flow;
  const step = state.current_step;
  const flowData = state.flow_data ? JSON.parse(state.flow_data) : {};
  
  console.log(`[Flow] 🔄 Active: ${flow}/${step}`);

  if (flow === 'order') {
    return handleOrderFlow(step, phone, { message, flowData }, lang, env);
  }

  // Add more flows as needed
  return false;
}

async function handleOrderTracking(orderId, phone, lang, env) {
  try {
    const order = await env.DB.prepare(`
      SELECT * FROM orders WHERE order_id = ?
    `).bind(orderId).first();

    if (!order) {
      return sendText(phone, 
        `❌ Order *${orderId}* not found.\n\n` +
        `Please check the order ID and try again.\n` +
        `Format: KAA-XXXXXX`,
        env
      );
    }

    let statusEmoji = '📦';
    switch (order.status) {
      case 'confirmed': statusEmoji = '✅'; break;
      case 'processing': statusEmoji = '⚙️'; break;
      case 'shipped': statusEmoji = '🚚'; break;
      case 'delivered': statusEmoji = '🎉'; break;
      case 'cancelled': statusEmoji = '❌'; break;
    }

    let response = `${statusEmoji} *Order: ${orderId}*\n\n`;
    response += `📋 Status: ${order.status.toUpperCase()}\n`;
    response += `💰 Total: ₹${order.total}\n`;
    response += `📅 Placed: ${new Date(order.created_at).toLocaleDateString('en-IN')}\n`;
    
    if (order.tracking_id) {
      response += `\n📦 Tracking: ${order.tracking_id}\n`;
      const trackingUrl = `${LINKS.shiprocket}?tracking_id=${order.tracking_id}`;
      response += `🔗 Track: ${trackingUrl}`;
    }

    const { sendReplyButtons } = await import('../utils/sendMessage.js');
    return sendReplyButtons(phone, response, [
      { id: 'CHAT_NOW', title: '💬 Need Help?' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ], env);

  } catch (error) {
    console.error('[Tracking] Error:', error.message);
    return sendText(phone, 
      `Sorry, we couldn't find order *${orderId}*.\n\n` +
      `Please contact our support team.`,
      env
    );
  }
}

async function handlePincodeInput(pincode, phone, lang, env) {
  // Check if in order flow
  const activeFlow = await getConversationState(phone, env);
  if (activeFlow?.current_flow === 'order') {
    return handleOrderFlow('PINCODE_RECEIVED', phone, { pincode }, lang, env);
  }

  // Check delivery availability
  const deliverable = await checkPincodeDelivery(pincode, env);
  
  return sendText(phone, 
    deliverable 
      ? `✅ *Delivery Available!*\n\nPincode: ${pincode}\n🚚 Estimated delivery: 3-5 business days\n\nWould you like to place an order?`
      : `❌ *Sorry!*\n\nWe currently don't deliver to pincode ${pincode}.\n\nPlease check back later or contact support.`,
    env
  );
}

async function checkPincodeDelivery(pincode, env) {
  // For now, assume all Indian pincodes are deliverable
  // In production, integrate with Shiprocket API
  return /^[1-9]\d{5}$/.test(pincode);
}

async function handleFlowResponse(responseJson, phone, lang, env) {
  console.log('[Flow] Response:', responseJson);
  return sendMainMenu(phone, lang, env);
}

async function handleProductSelection(product, phone, lang, env) {
  console.log('[Product] Selected:', product);
  return handleOrderFlow('PRODUCT_SELECTED', phone, { product }, lang, env);
}

async function logIncomingToSheets(message, phone, env) {
  if (!env.N8N_WEBHOOK_URL && !env.GOOGLE_SHEET_ID) return;
  
  try {
    if (env.N8N_WEBHOOK_URL) {
      await fetch(env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'wa_incoming',
          phone,
          type: message.type,
          text: message.text?.body || `[${message.type}]`,
          ts: Date.now()
        })
      });
    }
  } catch (e) {
    console.warn('[Sheets] Log failed:', e.message);
  }
}
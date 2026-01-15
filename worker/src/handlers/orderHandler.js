/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - ORDER HANDLER
 * ═══════════════════════════════════════════════════════════════
 * Complete order flow management
 * ═══════════════════════════════════════════════════════════════
 */

import {
  sendText,
  sendReplyButtons,
  sendCtaUrl,
  normalizeIN,
  LINKS
} from '../utils/sendMessage.js';
import { fromEnglish } from '../utils/translate.js';
import { 
  generateOrderId, 
  calculateShipping, 
  estimateDelivery,
  extractPincode
} from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════
// MAIN ORDER FLOW HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleOrderFlow(action, phone, data, lang, env) {
  const normalizedPhone = normalizeIN(phone);
  
  console.log(`[Order] 🛒 Action: ${action} for ${normalizedPhone}`);

  try {
    switch (action.toUpperCase()) {
      case 'START':
      case 'NEW':
        return await startNewOrder(normalizedPhone, lang, env);

      case 'PRODUCT_SELECTED':
      case 'ADD_PRODUCT':
        return await addProductToOrder(normalizedPhone, data, lang, env);

      case 'CATALOG_ORDER':
      case 'CREATE_FROM_CATALOG':
        return await createFromCatalog(normalizedPhone, data, lang, env);

      case 'COLLECT_ADDRESS':
      case 'ADDRESS':
        return await collectAddress(normalizedPhone, lang, env);

      case 'ADDRESS_RECEIVED':
        return await processAddress(normalizedPhone, data, lang, env);

      case 'LOCATION_RECEIVED':
        return await processLocation(normalizedPhone, data, lang, env);

      case 'PINCODE_RECEIVED':
        return await processPincode(normalizedPhone, data, lang, env);

      case 'REVIEW':
      case 'SUMMARY':
        return await showOrderSummary(normalizedPhone, lang, env);

      case 'CONFIRM':
      case 'PLACE':
        return await confirmOrder(normalizedPhone, lang, env);

      case 'PAYMENT':
      case 'PAY':
        return await sendPaymentDetails(normalizedPhone, data, lang, env);

      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_SUCCESS':
        return await handlePaymentSuccess(normalizedPhone, data, lang, env);

      case 'PAYMENT_FAILED':
        return await handlePaymentFailed(normalizedPhone, data, lang, env);

      case 'UPDATE_STATUS':
        return await updateOrderStatus(normalizedPhone, data, env);

      case 'CANCEL':
        return await cancelOrder(normalizedPhone, data, lang, env);

      default:
        console.log(`[Order] ⚠️ Unknown action: ${action}`);
        return await showOrderSummary(normalizedPhone, lang, env);
    }
  } catch (error) {
    console.error(`[Order] ❌ Error in ${action}:`, error.message);
    
    return sendReplyButtons(
      normalizedPhone,
      await fromEnglish(
        "Sorry, something went wrong with your order.\n\nPlease try again or contact support.",
        lang
      ),
      [
        { id: 'START_ORDER', title: '🔄 Try Again' },
        { id: 'CHAT_NOW', title: '💬 Support' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ],
      env
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// ORDER FLOW STEPS
// ═══════════════════════════════════════════════════════════════

async function startNewOrder(phone, lang, env) {
  await setConversationState(phone, 'order', 'product', {}, env);

  return sendReplyButtons(
    phone,
    await fromEnglish(
      "🛒 *Let's Create Your Order!* 🛒\n\n" +
      "How would you like to add products?\n\n" +
      "1️⃣ Browse our catalog\n" +
      "2️⃣ Send product name/photo\n" +
      "3️⃣ Share from our website",
      lang
    ),
    [
      { id: 'OPEN_CATALOG', title: '📱 Browse Catalog' },
      { id: 'BESTSELLERS', title: '🏆 Bestsellers' },
      { id: 'MAIN_MENU', title: '❌ Cancel' }
    ],
    env,
    await fromEnglish("💎 KAAPAV - Crafted for you", lang)
  );
}

async function addProductToOrder(phone, data, lang, env) {
  const { product, message } = data;
  
  let cart = await getOrCreateCart(phone, env);
  let items = cart.items ? JSON.parse(cart.items) : [];

  let productInfo = null;
  
  if (product?.product_retailer_id) {
    productInfo = await getProductById(product.product_retailer_id, env);
  } else if (message?.text?.body) {
    productInfo = await extractProductFromText(message.text.body, env);
  } else if (message?.image) {
    return sendText(
      phone,
      await fromEnglish(
        "📸 Got it! Please share the product name or item code from our catalog.",
        lang
      ),
      env
    );
  }

  if (!productInfo) {
    return sendReplyButtons(
      phone,
      await fromEnglish(
        "I couldn't identify the product. Please:\n\n" +
        "• Select from our catalog, or\n" +
        "• Share the exact product name",
        lang
      ),
      [
        { id: 'OPEN_CATALOG', title: '📱 Open Catalog' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ],
      env
    );
  }

  items.push({
    product_id: productInfo.product_id,
    name: productInfo.name,
    price: productInfo.price,
    quantity: 1
  });

  const total = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  await updateCart(phone, items, total, env);
  await setConversationState(phone, 'order', 'more_items', { items, total }, env);

  return sendReplyButtons(
    phone,
    await fromEnglish(
      `✅ *Added to Cart!*\n\n` +
      `📦 ${productInfo.name}\n` +
      `💰 ₹${productInfo.price}\n\n` +
      `🛒 Cart Total: ₹${total}\n\n` +
      `Would you like to add more items?`,
      lang
    ),
    [
      { id: 'OPEN_CATALOG', title: '➕ Add More' },
      { id: 'CONFIRM_ORDER', title: '✅ Checkout' },
      { id: 'VIEW_CART', title: '🛒 View Cart' }
    ],
    env
  );
}

async function createFromCatalog(phone, data, lang, env) {
  const { products } = data;
  
  if (!products || products.length === 0) {
    return sendText(phone, 'No products found in order.', env);
  }

  let items = [];
  let total = 0;

  for (const product of products) {
    const productInfo = await getProductById(product.product_retailer_id, env);
    
    if (productInfo) {
      const qty = product.quantity || 1;
      items.push({
        product_id: productInfo.product_id,
        name: productInfo.name,
        price: productInfo.price,
        quantity: qty
      });
      total += productInfo.price * qty;
    }
  }

  if (items.length === 0) {
    return sendText(phone, 'Unable to process order. Please try again.', env);
  }

  await updateCart(phone, items, total, env);
  await setConversationState(phone, 'order', 'address', { items, total }, env);

  let message = await fromEnglish("🛒 *Order Summary*\n\n", lang);
  items.forEach((item, i) => {
    message += `${i + 1}. ${item.name}\n   Qty: ${item.quantity} × ₹${item.price}\n\n`;
  });
  message += `💰 *Total: ₹${total}*\n\n`;
  message += await fromEnglish("Please share your delivery address:", lang);

  return sendReplyButtons(
    phone,
    message,
    [
      { id: 'MODIFY_ORDER', title: '✏️ Modify' },
      { id: 'CANCEL_ORDER', title: '❌ Cancel' }
    ],
    env,
    await fromEnglish("📍 Share address or location", lang)
  );
}

async function collectAddress(phone, lang, env) {
  await setConversationState(phone, 'order', 'address', {}, env);

  return sendText(
    phone,
    await fromEnglish(
      "📍 *Delivery Address*\n\n" +
      "Please share your complete address:\n\n" +
      "Include:\n" +
      "• Full name\n" +
      "• House/Flat no., Street\n" +
      "• Landmark\n" +
      "• City, State\n" +
      "• Pincode\n\n" +
      "Or tap 📎 → Location to share your location.",
      lang
    ),
    env
  );
}

async function processAddress(phone, data, lang, env) {
  const { message } = data;
  const addressText = message?.text?.body || '';
  const pincode = extractPincode(addressText);
  
  if (!pincode) {
    return sendText(
      phone,
      await fromEnglish("Please include your 6-digit pincode in the address.", lang),
      env
    );
  }

  const state = await getConversationState(phone, env);
  const flowData = state?.flow_data ? JSON.parse(state.flow_data) : {};

  flowData.address = addressText;
  flowData.pincode = pincode;
  
  const shipping = calculateShipping(flowData.total || 0, pincode);
  flowData.shipping = shipping;
  flowData.grandTotal = (flowData.total || 0) + shipping;

  await setConversationState(phone, 'order', 'confirm', flowData, env);
  return showOrderSummary(phone, lang, env);
}

async function processLocation(phone, data, lang, env) {
  const { address, location } = data;
  const state = await getConversationState(phone, env);
  const flowData = state?.flow_data ? JSON.parse(state.flow_data) : {};

  flowData.address = address;
  flowData.location = location;

  await setConversationState(phone, 'order', 'pincode', flowData, env);

  return sendText(
    phone,
    await fromEnglish(
      `📍 Location saved!\n\n${address}\n\nPlease share your 6-digit pincode for delivery estimation:`,
      lang
    ),
    env
  );
}

async function processPincode(phone, data, lang, env) {
  const { pincode } = data;
  
  if (!/^[1-9]\d{5}$/.test(pincode)) {
    return sendText(phone, await fromEnglish("Please enter a valid 6-digit pincode.", lang), env);
  }

  const state = await getConversationState(phone, env);
  const flowData = state?.flow_data ? JSON.parse(state.flow_data) : {};

  flowData.pincode = pincode;
  const shipping = calculateShipping(flowData.total || 0, pincode);
  flowData.shipping = shipping;
  flowData.grandTotal = (flowData.total || 0) + shipping;

  await setConversationState(phone, 'order', 'confirm', flowData, env);
  return showOrderSummary(phone, lang, env);
}

async function showOrderSummary(phone, lang, env) {
  const state = await getConversationState(phone, env);
  const flowData = state?.flow_data ? JSON.parse(state.flow_data) : {};

  if (!flowData.items) {
    const cart = await getCart(phone, env);
    if (cart) {
      flowData.items = JSON.parse(cart.items || '[]');
      flowData.total = cart.total;
    }
  }

  if (!flowData.items || flowData.items.length === 0) {
    return sendReplyButtons(
      phone,
      await fromEnglish("Your cart is empty!", lang),
      [
        { id: 'OPEN_CATALOG', title: '📱 Browse Catalog' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ],
      env
    );
  }

  const items = flowData.items;
  const subtotal = flowData.total || items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const shipping = flowData.shipping ?? calculateShipping(subtotal, flowData.pincode);
  const grandTotal = subtotal + shipping;

  let message = await fromEnglish("📋 *Order Summary*\n\n*Items:*\n", lang);
  
  items.forEach((item, i) => {
    message += `${i + 1}. ${item.name}\n   ${item.quantity || 1} × ₹${item.price} = ₹${item.price * (item.quantity || 1)}\n`;
  });
  
  message += `\n💰 Subtotal: ₹${subtotal}\n`;
  message += `🚚 Shipping: ${shipping === 0 ? 'FREE ✨' : `₹${shipping}`}\n`;
  message += `━━━━━━━━━━━━━━\n`;
  message += `✨ *Total: ₹${grandTotal}*\n\n`;

  if (flowData.address) {
    message += await fromEnglish("*Delivery Address:*\n", lang);
    message += `📍 ${flowData.address}\n\n`;
  }

  const estimatedDate = estimateDelivery();
  message += `📅 Estimated Delivery: ${estimatedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}\n`;

  const buttons = flowData.address 
    ? [
        { id: 'CONFIRM_ORDER', title: '✅ Place Order' },
        { id: 'MODIFY_ORDER', title: '✏️ Modify' },
        { id: 'CANCEL_ORDER', title: '❌ Cancel' }
      ]
    : [
        { id: 'COLLECT_ADDRESS', title: '📍 Add Address' },
        { id: 'MODIFY_ORDER', title: '✏️ Modify' },
        { id: 'CANCEL_ORDER', title: '❌ Cancel' }
      ];

  return sendReplyButtons(phone, message, buttons, env);
}

async function confirmOrder(phone, lang, env) {
  const state = await getConversationState(phone, env);
  const flowData = state?.flow_data ? JSON.parse(state.flow_data) : {};

  if (!flowData.items || flowData.items.length === 0) {
    return sendReplyButtons(
      phone,
      await fromEnglish("No items in order. Please add products first.", lang),
      [{ id: 'START_ORDER', title: '🛒 Start Order' }],
      env
    );
  }

  if (!flowData.address) {
    return collectAddress(phone, lang, env);
  }

  const orderId = generateOrderId();
  const items = flowData.items;
  const subtotal = flowData.total || items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const shipping = flowData.shipping ?? calculateShipping(subtotal, flowData.pincode);
  const grandTotal = subtotal + shipping;

  const customer = await env.DB.prepare(`SELECT name FROM customers WHERE phone = ?`).bind(phone).first();

  try {
    await env.DB.prepare(`
      INSERT INTO orders (
        order_id, phone, customer_name, items, item_count,
        subtotal, shipping_cost, total, 
        shipping_address, shipping_pincode,
        status, payment_status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', 'whatsapp')
    `).bind(
      orderId, phone, customer?.name || '', JSON.stringify(items), items.length,
      subtotal, shipping, grandTotal, flowData.address, flowData.pincode || ''
    ).run();

    await env.DB.prepare(`UPDATE customers SET order_count = order_count + 1, updated_at = datetime('now') WHERE phone = ?`).bind(phone).run();
    await env.DB.prepare(`UPDATE carts SET status = 'converted', converted_at = datetime('now') WHERE phone = ? AND status = 'active'`).bind(phone).run();
    await clearConversationState(phone, env);

    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, order_id, data, timestamp)
      VALUES ('order', 'created', ?, ?, ?, datetime('now'))
    `).bind(phone, orderId, JSON.stringify({ total: grandTotal, items: items.length })).run();

  } catch (error) {
    console.error('[Order] Create failed:', error.message);
    return sendText(phone, await fromEnglish("Sorry, we couldn't create your order. Please try again.", lang), env);
  }

  const paymentLink = LINKS.payment;

  let message = await fromEnglish(
    `✅ *Order Created!* ✅\n\n` +
    `📦 Order ID: *${orderId}*\n` +
    `💰 Amount: *₹${grandTotal}*\n\n` +
    `*Next Step:* Complete payment\n\n` +
    `🔒 Secure payment via Razorpay`,
    lang
  );

  return sendCtaUrl(phone, message, await fromEnglish("💳 Pay Now", lang), paymentLink, env, `Order: ${orderId}`);
}

async function sendPaymentDetails(phone, data, lang, env) {
  const { orderId } = data;
  const order = await env.DB.prepare(`SELECT * FROM orders WHERE order_id = ? AND phone = ?`).bind(orderId, phone).first();

  if (!order) {
    return sendText(phone, 'Order not found.', env);
  }

  return sendCtaUrl(
    phone,
    `💳 *Complete Payment*\n\nOrder: ${order.order_id}\nAmount: ₹${order.total}`,
    '💳 Pay Now',
    order.payment_link || LINKS.payment,
    env
  );
}

async function handlePaymentSuccess(phone, data, lang, env) {
  const { orderId, paymentId } = data;

  await env.DB.prepare(`
    UPDATE orders SET 
      payment_status = 'paid', payment_id = ?, paid_at = datetime('now'),
      status = 'confirmed', confirmed_at = datetime('now'), updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(paymentId, orderId).run();

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE order_id = ?`).bind(orderId).first();

  await env.DB.prepare(`
    UPDATE customers SET total_spent = total_spent + ?, last_order_amount = ?, last_purchase = datetime('now'), updated_at = datetime('now')
    WHERE phone = ?
  `).bind(order.total, order.total, phone).run();

  const items = JSON.parse(order.items);
  let itemsText = items.map(i => `• ${i.name} x${i.quantity || 1}`).join('\n');

  return sendReplyButtons(
    phone,
    `✅ *Payment Successful!* ✅\n\n` +
    `📦 Order: *${orderId}*\n\n` +
    `*Items:*\n${itemsText}\n\n` +
    `💰 Total: ₹${order.total}\n\n` +
    `🚚 Estimated Delivery: 3-5 business days\n\n` +
    `Thank you for shopping with KAAPAV! 💎`,
    [
      { id: `TRACK_${orderId}`, title: '📦 Track Order' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    env
  );
}

async function handlePaymentFailed(phone, data, lang, env) {
  const { orderId } = data;

  return sendReplyButtons(
    phone,
    await fromEnglish(
      `❌ *Payment Failed*\n\nOrder: ${orderId}\n\nPlease try again or use a different payment method.`,
      lang
    ),
    [
      { id: `PAY_${orderId}`, title: '🔄 Retry Payment' },
      { id: 'CHAT_NOW', title: '💬 Support' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    env
  );
}

async function updateOrderStatus(phone, data, env) {
  const { orderId, status, trackingId, courier } = data;

  const updates = ['status = ?', 'updated_at = datetime("now")'];
  const values = [status];

  if (status === 'shipped' && trackingId) {
    updates.push('tracking_id = ?', 'courier = ?', 'shipped_at = datetime("now")');
    values.push(trackingId, courier || 'Shiprocket');
  }
  if (status === 'delivered') updates.push('delivered_at = datetime("now")');

  values.push(orderId);

  await env.DB.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE order_id = ?`).bind(...values).run();
  return { success: true };
}

async function cancelOrder(phone, data, lang, env) {
  const { orderId, reason } = data;

  if (orderId) {
    await env.DB.prepare(`
      UPDATE orders SET status = 'cancelled', cancellation_reason = ?, cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE order_id = ? AND phone = ?
    `).bind(reason || 'Customer requested', orderId, phone).run();

    return sendText(phone, await fromEnglish(`❌ Order ${orderId} has been cancelled.\n\nIf you paid, refund will be processed within 7-10 business days.`, lang), env);
  }

  await clearConversationState(phone, env);
  
  return sendReplyButtons(
    phone,
    await fromEnglish("Order cancelled. What would you like to do next?", lang),
    [
      { id: 'OPEN_CATALOG', title: '📱 Browse' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    env
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function setConversationState(phone, flow, step, data, env) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO conversation_state (phone, current_flow, current_step, flow_data, started_at, updated_at, expires_at)
    VALUES (?, ?, ?, ?, COALESCE((SELECT started_at FROM conversation_state WHERE phone = ?), datetime('now')), datetime('now'), datetime('now', '+2 hours'))
  `).bind(phone, flow, step, JSON.stringify(data), phone).run();
}

async function getConversationState(phone, env) {
  return env.DB.prepare(`SELECT * FROM conversation_state WHERE phone = ? AND expires_at > datetime('now')`).bind(phone).first();
}

async function clearConversationState(phone, env) {
  await env.DB.prepare(`DELETE FROM conversation_state WHERE phone = ?`).bind(phone).run();
}

async function getOrCreateCart(phone, env) {
  let cart = await env.DB.prepare(`SELECT * FROM carts WHERE phone = ? AND status = 'active'`).bind(phone).first();
  if (!cart) {
    await env.DB.prepare(`INSERT INTO carts (phone, items, item_count, total, status) VALUES (?, '[]', 0, 0, 'active')`).bind(phone).run();
    cart = { items: '[]', total: 0, item_count: 0 };
  }
  return cart;
}

async function getCart(phone, env) {
  return env.DB.prepare(`SELECT * FROM carts WHERE phone = ? AND status = 'active'`).bind(phone).first();
}

async function updateCart(phone, items, total, env) {
  await env.DB.prepare(`
    INSERT OR REPLACE INTO carts (phone, items, item_count, total, status, updated_at)
    VALUES (?, ?, ?, ?, 'active', datetime('now'))
  `).bind(phone, JSON.stringify(items), items.length, total).run();
}

async function getProductById(productId, env) {
  try {
    return env.DB.prepare(`SELECT * FROM products WHERE product_id = ? AND is_active = 1`).bind(productId).first();
  } catch { return null; }
}

async function extractProductFromText(text, env) {
  try {
    const searchTerm = text.toLowerCase().trim();
    return env.DB.prepare(`
      SELECT * FROM products WHERE is_active = 1 AND (LOWER(name) LIKE ? OR LOWER(product_id) LIKE ?) LIMIT 1
    `).bind(`%${searchTerm}%`, `%${searchTerm}%`).first();
  } catch { return null; }
}
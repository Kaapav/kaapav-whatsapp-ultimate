/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - BUTTON HANDLER
 * ═══════════════════════════════════════════════════════════════
 * YOUR ORIGINAL BUTTON LOGIC - FULLY PRESERVED & ENHANCED
 * Synced with your sendMessage.js button IDs
 * ═══════════════════════════════════════════════════════════════
 */

import {
  sendMainMenu,
  sendJewelleryCategoriesMenu,
  sendOffersAndMoreMenu,
  sendPaymentAndTrackMenu,
  sendChatWithUsCta,
  sendSocialMenu,
  sendOrderMenu,
  sendCategoryMenu,
  sendLanguageMenu,
  sendCtaUrl,
  sendText,
  sendReplyButtons,
  sendListMessage,
  sendProductList,
  sendProduct,
  normalizeIN,
  LINKS
} from '../utils/sendMessage.js';
import { fromEnglish } from '../utils/translate.js';

// ═══════════════════════════════════════════════════════════════
// MAIN BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleButtonClick(buttonId, phone, lang, env) {
  const normalizedPhone = normalizeIN(phone);
  
  // Normalize button ID (handle different formats)
  const id = String(buttonId).toUpperCase().replace(/-/g, '_').trim();
  
  console.log(`[Button] 🔘 Processing: ${id} for ${normalizedPhone}`);

  // Track button click analytics
  await trackButtonClick(id, normalizedPhone, env);

  try {
    // ═══════════════════════════════════════════════════════════
    // MAIN NAVIGATION (YOUR LOGIC - PRESERVED)
    // ═══════════════════════════════════════════════════════════
    
    switch (id) {
      // ─────────────────────────────────────────────────────────
      // HOME / MAIN MENU
      // ─────────────────────────────────────────────────────────
      case 'MAIN_MENU':
      case 'HOME':
      case 'BACK':
      case 'GO_BACK':
      case 'START':
      case 'MENU':
        return sendMainMenu(normalizedPhone, lang, env);

      // ─────────────────────────────────────────────────────────
      // JEWELLERY MENU (YOUR LOGIC - PRESERVED)
      // ─────────────────────────────────────────────────────────
      case 'JEWELLERY_MENU':
      case 'JEWELRY_MENU':
      case 'BROWSE_JEWELLERY':
      case 'BROWSE_JEWELRY':
      case 'SHOP':
      case 'COLLECTIONS':
        return sendJewelleryCategoriesMenu(normalizedPhone, lang, env);

      // ─────────────────────────────────────────────────────────
      // CHAT MENU (YOUR LOGIC - PRESERVED)
      // ─────────────────────────────────────────────────────────
      case 'CHAT_MENU':
      case 'CHAT_WITH_US':
      case 'SUPPORT':
      case 'HELP':
      case 'CONTACT':
        return sendChatWithUsCta(normalizedPhone, lang, env);

      // ─────────────────────────────────────────────────────────
      // OFFERS MENU (YOUR LOGIC - PRESERVED)
      // ─────────────────────────────────────────────────────────
      case 'OFFERS_MENU':
      case 'OFFERS_AND_MORE':
      case 'OFFERS':
      case 'DEALS':
      case 'PROMOTIONS':
        return sendOffersAndMoreMenu(normalizedPhone, lang, env);

      // ─────────────────────────────────────────────────────────
      // PAYMENT MENU (YOUR LOGIC - PRESERVED)
      // ─────────────────────────────────────────────────────────
      case 'PAYMENT_MENU':
      case 'PAYMENT_TRACK':
      case 'PAY_TRACK':
        return sendPaymentAndTrackMenu(normalizedPhone, lang, env);

      // ─────────────────────────────────────────────────────────
      // SOCIAL MENU (YOUR LOGIC - PRESERVED)
      // ─────────────────────────────────────────────────────────
      case 'SOCIAL_MENU':
      case 'FB_INSTAGRAM':
      case 'FOLLOW_US':
      case 'SOCIAL_MEDIA':
        return sendSocialMenu(normalizedPhone, lang, env);

      // ═══════════════════════════════════════════════════════════
      // WEBSITE & CATALOG (YOUR LOGIC - PRESERVED)
      // ═══════════════════════════════════════════════════════════

      case 'OPEN_WEBSITE':
      case 'WEBSITE':
      case 'VISIT_WEBSITE':
      case 'WWW':
        return sendCtaUrl(
          normalizedPhone,
          await fromEnglish(
            "🌐 *Explore KAAPAV's Luxury World* ✨\n\n" +
            "Discover handcrafted elegance at kaapav.com\n" +
            "💎 500+ Exclusive Designs\n" +
            "🚚 Free Shipping above ₹498",
            lang
          ),
          await fromEnglish("🛍️ Visit Website", lang),
          LINKS.website,
          env,
          await fromEnglish("👑 Crafted for Royalty", lang)
        );

      case 'OPEN_CATALOG':
      case 'CATALOG':
      case 'CATALOGUE':
      case 'WHATSAPP_CATALOG':
      case 'VIEW_CATALOG':
        return sendCtaUrl(
          normalizedPhone,
          await fromEnglish(
            "📱 *Browse Our WhatsApp Catalog* 📱\n\n" +
            "✨ 500+ Exclusive Designs\n" +
            "🆕 New arrivals every week\n" +
            "💝 Easy ordering via WhatsApp",
            lang
          ),
          await fromEnglish("📱 Open Catalog", lang),
          LINKS.whatsappCatalog,
          env,
          await fromEnglish("💎 Tap to explore", lang)
        );

      // ═══════════════════════════════════════════════════════════
      // BESTSELLERS & OFFERS (YOUR LOGIC - PRESERVED)
      // ═══════════════════════════════════════════════════════════

      case 'BESTSELLERS':
      case 'BEST_SELLERS':
      case 'TOP_SELLERS':
      case 'POPULAR':
        return sendCtaUrl(
          normalizedPhone,
          await fromEnglish(
            "🏆 *KAAPAV Bestsellers!* 🏆\n\n" +
            "✨ Top-rated by 10,000+ customers\n" +
            "🎉 Up to 50% OFF\n" +
            "🚚 FREE Shipping above ₹498\n\n" +
            "Don't miss these favorites! 💎",
            lang
          ),
          await fromEnglish("🛍️ Shop Bestsellers", lang),
          LINKS.offersBestsellers,
          env,
          await fromEnglish("💎 Limited stock!", lang)
        );

      case 'NEW_ARRIVALS':
      case 'NEW':
      case 'LATEST':
        return sendCtaUrl(
          normalizedPhone,
          await fromEnglish(
            "✨ *Just Arrived!* ✨\n\n" +
            "Fresh designs added this week\n" +
            "Be the first to own these beauties!\n\n" +
            "💎 Exclusive & Limited Edition",
            lang
          ),
          await fromEnglish("✨ See New Arrivals", lang),
          LINKS.website + '/shop/category/new-arrivals',
          env,
          await fromEnglish("🆕 Fresh from our artisans", lang)
        );

      case 'SALE':
      case 'DISCOUNT':
      case 'CLEARANCE':
        return sendCtaUrl(
          normalizedPhone,
          await fromEnglish(
            "🔥 *MASSIVE SALE!* 🔥\n\n" +
            "🎉 Flat 50% OFF on select styles\n" +
            "⏰ Limited time only!\n" +
            "🚚 FREE Shipping above ₹498",
            lang
          ),
          await fromEnglish("🛍️ Shop Sale", lang),
          LINKS.offersBestsellers,
          env,
          await fromEnglish("⏰ Hurry, limited stock!", lang)
        );

      // ═══════════════════════════════════════════════════════════
      // PAYMENT (YOUR LOGIC - PRESERVED)
      // ═══════════════════════════════════════════════════════════

      case 'PAY_NOW':
      case 'PAYMENT':
      case 'MAKE_PAYMENT':
      case 'PAY':
        return sendCtaUrl(
          normalizedPhone,
          await fromEnglish(
            "💳 *Secure Payment with KAAPAV* 💳\n\n" +
            "✅ UPI (GPay, PhonePe, Paytm)\n" +
            "✅ Credit/Debit Cards\n" +
            "✅ Net Banking\n" +
            "✅ Wallets\n\n" +
            "🔒 100% Secure Checkout\n" +
            "🚫 No COD Available",
            lang
          ),
          await fromEnglish("💳 Pay Now", lang),
          LINKS.payment,
          env,
          await fromEnglish("👑 Secure • Fast • Easy", lang)
        );

      // ═══════════════════════════════════════════════════════════
      // TRACKING (YOUR LOGIC - PRESERVED)
      // ═══════════════════════════════════════════════════════════

      case 'TRACK_ORDER':
      case 'TRACKING':
      case 'ORDER_STATUS':
      case 'WHERE_IS_MY_ORDER':
        return handleTrackOrderButton(normalizedPhone, lang, env);

      // ═══════════════════════════════════════════════════════════
      // CHAT NOW (YOUR LOGIC - PRESERVED)
      // ═══════════════════════════════════════════════════════════

      case 'CHAT_NOW':
      case 'TALK_TO_US':
      case 'HUMAN':
      case 'AGENT':
      case 'LIVE_CHAT':
        return handleChatNowButton(normalizedPhone, lang, env);

      // ═══════════════════════════════════════════════════════════
      // SOCIAL MEDIA (YOUR LOGIC - PRESERVED)
      // ═══════════════════════════════════════════════════════════

      case 'OPEN_FACEBOOK':
      case 'FACEBOOK':
      case 'FB':
        return sendCtaUrl(
          normalizedPhone,
          await fromEnglish(
            "📘 *Follow us on Facebook!*\n\n" +
            "Stay updated with:\n" +
            "✨ Latest designs\n" +
            "🎉 Exclusive offers\n" +
            "💎 Behind-the-scenes",
            lang
          ),
          await fromEnglish("📘 Facebook", lang),
          LINKS.facebook,
          env,
          await fromEnglish("👍 Like & Follow", lang)
        );

      case 'OPEN_INSTAGRAM':
      case 'INSTAGRAM':
      case 'INSTA':
      case 'IG':
        return sendCtaUrl(
          normalizedPhone,
          await fromEnglish(
            "📸 *Follow us on Instagram!*\n\n" +
            "Daily inspiration:\n" +
            "✨ Styling tips\n" +
            "🆕 First look at new arrivals\n" +
            "💎 Customer spotlights",
            lang
          ),
          await fromEnglish("📸 Instagram", lang),
          LINKS.instagram,
          env,
          await fromEnglish("📲 Follow for inspiration", lang)
        );

      // ═══════════════════════════════════════════════════════════
      // LANGUAGE SELECTION
      // ═══════════════════════════════════════════════════════════

      case 'CHANGE_LANGUAGE':
      case 'LANGUAGE':
      case 'LANG':
        return sendLanguageMenu(normalizedPhone, env);

      case 'LANG_EN':
      case 'ENGLISH':
        await setCustomerLanguage(normalizedPhone, 'en', env);
        await sendText(normalizedPhone, '✅ Language set to English', env);
        return sendMainMenu(normalizedPhone, 'en', env);

      case 'LANG_HI':
      case 'HINDI':
        await setCustomerLanguage(normalizedPhone, 'hi', env);
        await sendText(normalizedPhone, '✅ भाषा हिंदी में सेट की गई', env);
        return sendMainMenu(normalizedPhone, 'hi', env);

      case 'LANG_KN':
      case 'KANNADA':
        await setCustomerLanguage(normalizedPhone, 'kn', env);
        await sendText(normalizedPhone, '✅ ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಹೊಂದಿಸಲಾಗಿದೆ', env);
        return sendMainMenu(normalizedPhone, 'kn', env);

      // ═══════════════════════════════════════════════════════════
      // ORDER FLOW
      // ═══════════════════════════════════════════════════════════

      case 'START_ORDER':
      case 'BEGIN_ORDER':
      case 'NEW_ORDER':
      case 'ORDER':
      case 'BUY':
      case 'PURCHASE':
        return handleStartOrderButton(normalizedPhone, lang, env);

      case 'CONFIRM_ORDER':
      case 'PLACE_ORDER':
      case 'SUBMIT_ORDER':
        return handleConfirmOrderButton(normalizedPhone, lang, env);

      case 'CANCEL_ORDER':
      case 'CANCEL':
        return handleCancelOrderButton(normalizedPhone, lang, env);

      case 'MODIFY_ORDER':
      case 'EDIT_ORDER':
      case 'CHANGE_ORDER':
        return handleModifyOrderButton(normalizedPhone, lang, env);

      case 'VIEW_CART':
      case 'CART':
      case 'MY_CART':
        return handleViewCartButton(normalizedPhone, lang, env);

      case 'CLEAR_CART':
      case 'EMPTY_CART':
        return handleClearCartButton(normalizedPhone, lang, env);

      // ═══════════════════════════════════════════════════════════
      // PRODUCT CATEGORIES
      // ═══════════════════════════════════════════════════════════

      case 'CAT_EARRINGS':
      case 'EARRINGS':
        return handleCategoryButton('earrings', 'Earrings', normalizedPhone, lang, env);

      case 'CAT_NECKLACES':
      case 'NECKLACES':
        return handleCategoryButton('necklaces', 'Necklaces', normalizedPhone, lang, env);

      case 'CAT_BANGLES':
      case 'BANGLES':
        return handleCategoryButton('bangles', 'Bangles', normalizedPhone, lang, env);

      case 'CAT_RINGS':
      case 'RINGS':
        return handleCategoryButton('rings', 'Rings', normalizedPhone, lang, env);

      case 'CAT_PENDANTS':
      case 'PENDANTS':
        return handleCategoryButton('pendants', 'Pendants', normalizedPhone, lang, env);

      case 'CAT_BRACELETS':
      case 'BRACELETS':
        return handleCategoryButton('bracelets', 'Bracelets', normalizedPhone, lang, env);

      case 'ALL_CATEGORIES':
      case 'CATEGORIES':
      case 'BROWSE_CATEGORIES':
        return sendCategoryMenu(normalizedPhone, lang, env);

      // ═══════════════════════════════════════════════════════════
      // QUICK ACTIONS
      // ═══════════════════════════════════════════════════════════

      case 'YES':
      case 'CONFIRM':
      case 'OK':
      case 'ACCEPT':
        return handleYesButton(normalizedPhone, lang, env);

      case 'NO':
      case 'DENY':
      case 'REJECT':
      case 'DECLINE':
        return handleNoButton(normalizedPhone, lang, env);

      // ═══════════════════════════════════════════════════════════
      // REVIEW & FEEDBACK
      // ═══════════════════════════════════════════════════════════

      case 'GIVE_REVIEW':
      case 'REVIEW':
      case 'FEEDBACK':
      case 'RATE_US':
        return sendCtaUrl(
          normalizedPhone,
          await fromEnglish(
            "⭐ *Love KAAPAV?* ⭐\n\n" +
            "Your review helps us serve you better!\n\n" +
            "Share your experience and help other jewellery lovers discover KAAPAV 💎",
            lang
          ),
          await fromEnglish("⭐ Write Review", lang),
          LINKS.googleReview,
          env,
          await fromEnglish("🙏 Thank you!", lang)
        );

      // ═══════════════════════════════════════════════════════════
      // POLICIES & INFO
      // ═══════════════════════════════════════════════════════════

      case 'RETURN_POLICY':
      case 'RETURNS':
        return sendText(
          normalizedPhone,
          await fromEnglish(
            "↩️ *KAAPAV Return Policy*\n\n" +
            "📅 *7-Day Easy Returns*\n\n" +
            "✅ Product must be unused\n" +
            "✅ Original packaging required\n" +
            "✅ Tags must be intact\n\n" +
            "📞 To initiate return:\n" +
            "Reply with your Order ID\n\n" +
            "💡 Refund within 7-10 business days",
            lang
          ),
          env
        );

      case 'SHIPPING_INFO':
      case 'DELIVERY_INFO':
        return sendText(
          normalizedPhone,
          await fromEnglish(
            "🚚 *KAAPAV Shipping Info*\n\n" +
            "📦 *Delivery Time:* 3-5 business days\n" +
            "🌍 *Coverage:* Pan India\n\n" +
            "💰 *Shipping Charges:*\n" +
            "• Orders above ₹498: FREE 🎉\n" +
            "• Below ₹498: ₹49\n\n" +
            "📍 We ship via trusted partners:\n" +
            "Shiprocket, Delhivery, BlueDart",
            lang
          ),
          env
        );

      case 'ABOUT_US':
      case 'ABOUT':
        return sendText(
          normalizedPhone,
          await fromEnglish(
            "👑 *About KAAPAV*\n\n" +
            "KAAPAV Fashion Jewellery brings you handcrafted elegance at affordable prices.\n\n" +
            "✨ *Our Promise:*\n" +
            "• Premium quality materials\n" +
            "• Handpicked designs\n" +
            "• Skin-friendly & hypoallergenic\n" +
            "• 10,000+ happy customers\n\n" +
            "💎 *Crafted Elegance • Timeless Sparkle*\n\n" +
            "🌐 kaapav.com",
            lang
          ),
          env
        );

      // ═══════════════════════════════════════════════════════════
      // DEFAULT / UNKNOWN BUTTONS
      // ═══════════════════════════════════════════════════════════

      default:
        console.log(`[Button] ⚠️ Unknown button: ${id}`);
        
        // Check for dynamic button patterns
        if (id.startsWith('PROD_')) {
          return handleProductButton(id, normalizedPhone, lang, env);
        }
        
        if (id.startsWith('ORDER_')) {
          return handleOrderButton(id, normalizedPhone, lang, env);
        }
        
        if (id.startsWith('TRACK_')) {
          const orderId = id.replace('TRACK_', '');
          return handleTrackSpecificOrder(orderId, normalizedPhone, lang, env);
        }
        
        if (id.startsWith('CAT_')) {
          const category = id.replace('CAT_', '').toLowerCase();
          return handleCategoryButton(category, category, normalizedPhone, lang, env);
        }

        // Fallback to main menu
        return sendMainMenu(normalizedPhone, lang, env);
    }
    
  } catch (error) {
    console.error(`[Button] ❌ Error handling ${id}:`, error.message);
    
    // Send error message and fallback to menu
    await sendText(
      normalizedPhone,
      await fromEnglish(
        "Oops! Something went wrong. Let me show you the menu again.",
        lang
      ),
      env
    ).catch(() => {});
    
    return sendMainMenu(normalizedPhone, lang, env);
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function trackButtonClick(buttonId, phone, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, timestamp)
      VALUES ('button_click', ?, ?, ?, datetime('now'))
    `).bind(buttonId, phone, JSON.stringify({ button_id: buttonId })).run();
  } catch (e) {
    console.warn('[Button] Analytics failed:', e.message);
  }
}

async function setCustomerLanguage(phone, lang, env) {
  try {
    await env.DB.prepare(`
      UPDATE customers SET language = ?, updated_at = datetime('now')
      WHERE phone = ?
    `).bind(lang, phone).run();
  } catch (e) {
    console.warn('[Button] Set language failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// TRACK ORDER BUTTON
// ─────────────────────────────────────────────────────────────────

async function handleTrackOrderButton(phone, lang, env) {
  // Check for recent orders
  try {
    const recentOrders = await env.DB.prepare(`
      SELECT order_id, status, total, created_at, tracking_id
      FROM orders 
      WHERE phone = ? 
      ORDER BY created_at DESC 
      LIMIT 3
    `).bind(phone).all();

    if (recentOrders.results && recentOrders.results.length > 0) {
      const orders = recentOrders.results;
      let message = await fromEnglish("📦 *Your Recent Orders:*\n\n", lang);
      
      for (const order of orders) {
        const statusEmoji = getStatusEmoji(order.status);
        message += `${statusEmoji} *${order.order_id}*\n`;
        message += `   Status: ${order.status}\n`;
        message += `   Amount: ₹${order.total}\n`;
        if (order.tracking_id) {
          message += `   Tracking: ${order.tracking_id}\n`;
        }
        message += `\n`;
      }
      
      message += await fromEnglish("Reply with Order ID for details", lang);
      
      return sendReplyButtons(phone, message, [
        { id: 'CHAT_NOW', title: '💬 Need Help?' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ], env);
    }
  } catch (e) {
    console.warn('[Button] Get orders failed:', e.message);
  }

  // No orders found or error - show tracking link
  return sendCtaUrl(
    phone,
    await fromEnglish(
      "📦 *Track Your KAAPAV Order* 📦\n\n" +
      "Enter your AWB/Tracking number on Shiprocket\n\n" +
      "Or reply with your Order ID\n" +
      "(Format: KAA-XXXXXX)",
      lang
    ),
    await fromEnglish("📦 Track Now", lang),
    LINKS.shiprocket,
    env,
    await fromEnglish("🚚 Delivered with love", lang)
  );
}

async function handleTrackSpecificOrder(orderId, phone, lang, env) {
  try {
    const order = await env.DB.prepare(`
      SELECT * FROM orders WHERE order_id = ?
    `).bind(orderId).first();

    if (!order) {
      return sendText(phone, 
        `❌ Order *${orderId}* not found.\n\nPlease check the order ID.`,
        env
      );
    }

    const statusEmoji = getStatusEmoji(order.status);
    let message = `${statusEmoji} *Order: ${orderId}*\n\n`;
    message += `📋 Status: ${order.status.toUpperCase()}\n`;
    message += `💰 Total: ₹${order.total}\n`;
    message += `📅 Placed: ${new Date(order.created_at).toLocaleDateString('en-IN')}\n`;
    
    if (order.tracking_id) {
      message += `\n📦 Tracking: ${order.tracking_id}\n`;
      message += `🔗 ${LINKS.shiprocket}?tracking_id=${order.tracking_id}`;
    }

    return sendReplyButtons(phone, message, [
      { id: 'CHAT_NOW', title: '💬 Need Help?' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ], env);

  } catch (error) {
    console.error('[Button] Track order error:', error.message);
    return sendText(phone, 'Sorry, unable to fetch order details. Please try again.', env);
  }
}

function getStatusEmoji(status) {
  const emojis = {
    'pending': '⏳',
    'confirmed': '✅',
    'processing': '⚙️',
    'shipped': '🚚',
    'in_transit': '🛣️',
    'out_for_delivery': '🏃',
    'delivered': '🎉',
    'cancelled': '❌',
    'returned': '↩️',
    'refunded': '💸'
  };
  return emojis[status?.toLowerCase()] || '📦';
}

// ─────────────────────────────────────────────────────────────────
// CHAT NOW BUTTON
// ─────────────────────────────────────────────────────────────────

async function handleChatNowButton(phone, lang, env) {
  // Mark chat for agent attention
  try {
    await env.DB.prepare(`
      UPDATE chats SET 
        needs_attention = 1,
        priority = 'high',
        labels = json_insert(COALESCE(labels, '[]'), '$[#]', 'human-requested'),
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(phone).run();
  } catch (e) {
    console.warn('[Button] Update chat failed:', e.message);
  }

  return sendText(
    phone,
    await fromEnglish(
      "💬 *Great! Our team is here for you!* 💬\n\n" +
      "Please share your query, and we'll assist you promptly.\n\n" +
      "💎 Average response: 10-15 minutes\n" +
      "⏰ Available: 9 AM - 9 PM IST\n\n" +
      "You can also:\n" +
      "📞 Call: +91 91483 30016\n" +
      "📧 Email: support@kaapav.com",
      lang
    ),
    env
  );
}

// ─────────────────────────────────────────────────────────────────
// ORDER FLOW BUTTONS
// ─────────────────────────────────────────────────────────────────

async function handleStartOrderButton(phone, lang, env) {
  const { handleOrderFlow } = await import('./orderHandler.js');
  return handleOrderFlow('START', phone, {}, lang, env);
}

async function handleConfirmOrderButton(phone, lang, env) {
  const { handleOrderFlow } = await import('./orderHandler.js');
  return handleOrderFlow('CONFIRM', phone, {}, lang, env);
}

async function handleCancelOrderButton(phone, lang, env) {
  // Clear conversation state
  try {
    await env.DB.prepare(`
      DELETE FROM conversation_state WHERE phone = ?
    `).bind(phone).run();
  } catch (e) {
    console.warn('[Button] Clear state failed:', e.message);
  }

  return sendReplyButtons(
    phone,
    await fromEnglish(
      "❌ *Order Cancelled*\n\n" +
      "No worries! Your cart items are saved.\n" +
      "Come back anytime to complete your order 💎",
      lang
    ),
    [
      { id: 'START_ORDER', title: '🛒 New Order' },
      { id: 'OPEN_CATALOG', title: '📱 Catalog' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    env
  );
}

async function handleModifyOrderButton(phone, lang, env) {
  return sendReplyButtons(
    phone,
    await fromEnglish(
      "✏️ *Modify Your Order*\n\n" +
      "What would you like to change?",
      lang
    ),
    [
      { id: 'VIEW_CART', title: '🛒 View Cart' },
      { id: 'CLEAR_CART', title: '🗑️ Clear Cart' },
      { id: 'START_ORDER', title: '🔄 Start Over' }
    ],
    env
  );
}

async function handleViewCartButton(phone, lang, env) {
  try {
    const cart = await env.DB.prepare(`
      SELECT * FROM carts WHERE phone = ? AND status = 'active'
    `).bind(phone).first();

    if (!cart || !cart.items) {
      return sendReplyButtons(
        phone,
        await fromEnglish(
          "🛒 *Your Cart is Empty*\n\n" +
          "Add some beautiful pieces to your cart!",
          lang
        ),
        [
          { id: 'OPEN_CATALOG', title: '📱 Browse Catalog' },
          { id: 'BESTSELLERS', title: '🏆 Bestsellers' },
          { id: 'MAIN_MENU', title: '🏠 Home' }
        ],
        env
      );
    }

    const items = JSON.parse(cart.items);
    let message = await fromEnglish("🛒 *Your Cart*\n\n", lang);
    
    items.forEach((item, index) => {
      message += `${index + 1}. ${item.name}\n`;
      message += `   Qty: ${item.quantity || 1} × ₹${item.price}\n\n`;
    });
    
    message += `💰 *Total: ₹${cart.total}*`;

    return sendReplyButtons(phone, message, [
      { id: 'CONFIRM_ORDER', title: '✅ Checkout' },
      { id: 'CLEAR_CART', title: '🗑️ Clear' },
      { id: 'OPEN_CATALOG', title: '➕ Add More' }
    ], env);

  } catch (error) {
    console.error('[Button] View cart error:', error.message);
    return sendText(phone, 'Unable to load cart. Please try again.', env);
  }
}

async function handleClearCartButton(phone, lang, env) {
  try {
    await env.DB.prepare(`
      UPDATE carts SET status = 'cleared', items = '[]', total = 0, item_count = 0
      WHERE phone = ? AND status = 'active'
    `).bind(phone).run();
  } catch (e) {
    console.warn('[Button] Clear cart failed:', e.message);
  }

  return sendReplyButtons(
    phone,
    await fromEnglish("🗑️ *Cart Cleared*\n\nReady to start fresh!", lang),
    [
      { id: 'OPEN_CATALOG', title: '📱 Browse Catalog' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    env
  );
}

// ─────────────────────────────────────────────────────────────────
// CATEGORY BUTTONS
// ─────────────────────────────────────────────────────────────────

async function handleCategoryButton(categorySlug, categoryName, phone, lang, env) {
  try {
    // Try to get products from catalog
    const { results: products } = await env.DB.prepare(`
      SELECT product_id, name, price, image_url 
      FROM products 
      WHERE category = ? AND is_active = 1 
      ORDER BY order_count DESC
      LIMIT 10
    `).bind(categorySlug).all();

    if (products && products.length > 0) {
      // Try WhatsApp product list
      try {
        return await sendProductList(
          phone,
          [{
            title: categoryName,
            products: products.map(p => ({ product_retailer_id: p.product_id }))
          }],
          `💎 ${categoryName.toUpperCase()}`,
          `Explore our ${categoryName.toLowerCase()} collection`,
          env
        );
      } catch {
        // Fallback to text list
        let message = `💎 *${categoryName}*\n\n`;
        products.forEach((p, i) => {
          message += `${i + 1}. ${p.name} - ₹${p.price}\n`;
        });
        message += `\n📱 View full collection in our catalog`;
        
        return sendReplyButtons(phone, message, [
          { id: 'OPEN_CATALOG', title: '📱 Open Catalog' },
          { id: 'START_ORDER', title: '🛒 Order Now' },
          { id: 'MAIN_MENU', title: '🏠 Home' }
        ], env);
      }
    }
  } catch (e) {
    console.warn('[Button] Get products failed:', e.message);
  }

  // Fallback to catalog link
  return sendCtaUrl(
    phone,
    await fromEnglish(
      `💎 *${categoryName} Collection* 💎\n\n` +
      `Explore our beautiful ${categoryName.toLowerCase()} designs!\n` +
      `✨ Premium quality\n` +
      `🚚 Free shipping above ₹498`,
      lang
    ),
    await fromEnglish(`📱 View ${categoryName}`, lang),
    `${LINKS.website}/shop/category/${categorySlug}`,
    env
  );
}

// ─────────────────────────────────────────────────────────────────
// DYNAMIC BUTTON HANDLERS
// ─────────────────────────────────────────────────────────────────

async function handleProductButton(buttonId, phone, lang, env) {
  const productId = buttonId.replace('PROD_', '');
  
  try {
    // Get product details
    const product = await env.DB.prepare(`
      SELECT * FROM products WHERE product_id = ? AND is_active = 1
    `).bind(productId).first();

    if (product) {
      // Try to send product from catalog
      try {
        return await sendProduct(phone, productId, 
          `✨ ${product.name}\n💰 ₹${product.price}`, env);
      } catch {
        // Fallback to text
        let message = `✨ *${product.name}*\n\n`;
        message += `💰 Price: ₹${product.price}\n`;
        if (product.description) message += `\n${product.description}\n`;
        message += `\n🛒 Reply "order" to purchase`;
        
        return sendReplyButtons(phone, message, [
          { id: 'START_ORDER', title: '🛒 Order Now' },
          { id: 'OPEN_CATALOG', title: '📱 More Items' },
          { id: 'MAIN_MENU', title: '🏠 Home' }
        ], env);
      }
    }
  } catch (e) {
    console.warn('[Button] Get product failed:', e.message);
  }

  return sendCtaUrl(phone, 'View this product in our catalog', '📱 Catalog', LINKS.whatsappCatalog, env);
}

async function handleOrderButton(buttonId, phone, lang, env) {
  const orderId = buttonId.replace('ORDER_', '');
  return handleTrackSpecificOrder(orderId, phone, lang, env);
}

// ─────────────────────────────────────────────────────────────────
// YES/NO CONFIRMATION HANDLERS
// ─────────────────────────────────────────────────────────────────

async function handleYesButton(phone, lang, env) {
  // Check for active flow
  try {
    const state = await env.DB.prepare(`
      SELECT * FROM conversation_state 
      WHERE phone = ? AND expires_at > datetime('now')
    `).bind(phone).first();

    if (state?.current_flow === 'order') {
      const { handleOrderFlow } = await import('./orderHandler.js');
      return handleOrderFlow('CONFIRM', phone, {}, lang, env);
    }
  } catch (e) {
    console.warn('[Button] Get state failed:', e.message);
  }

  return sendMainMenu(phone, lang, env);
}

async function handleNoButton(phone, lang, env) {
  // Check for active flow
  try {
    const state = await env.DB.prepare(`
      SELECT * FROM conversation_state 
      WHERE phone = ? AND expires_at > datetime('now')
    `).bind(phone).first();

    if (state?.current_flow === 'order') {
      // Clear state and cancel
      await env.DB.prepare(`
        DELETE FROM conversation_state WHERE phone = ?
      `).bind(phone).run();
      
      return sendReplyButtons(
        phone,
        await fromEnglish("No problem! Is there anything else I can help you with?", lang),
        [
          { id: 'OPEN_CATALOG', title: '📱 Browse' },
          { id: 'CHAT_NOW', title: '💬 Support' },
          { id: 'MAIN_MENU', title: '🏠 Home' }
        ],
        env
      );
    }
  } catch (e) {
    console.warn('[Button] Get state failed:', e.message);
  }

  return sendMainMenu(phone, lang, env);
}
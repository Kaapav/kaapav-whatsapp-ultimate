/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - REMINDER TASKS
 * ═══════════════════════════════════════════════════════════════
 * Scheduled reminder functions
 * ═══════════════════════════════════════════════════════════════
 */

import { sendText, sendReplyButtons, sendTemplate } from '../utils/sendMessage.js';

// ═══════════════════════════════════════════════════════════════
// PAYMENT REMINDERS
// ═══════════════════════════════════════════════════════════════

export async function sendPaymentReminders(env) {
  console.log('[Reminders] 💳 Checking payment reminders...');

  try {
    // Orders unpaid for 1-24 hours
    const { results: unpaidOrders } = await env.DB.prepare(`
      SELECT o.*, 
        (SELECT COUNT(*) FROM analytics WHERE order_id = o.order_id AND event_name = 'payment_reminder') as reminder_count
      FROM orders o
      WHERE o.payment_status = 'unpaid' 
        AND o.status = 'pending'
        AND o.created_at >= datetime('now', '-24 hours')
        AND o.created_at <= datetime('now', '-1 hours')
      LIMIT 20
    `).all();

    let sent = 0;

    for (const order of unpaidOrders || []) {
      if (order.reminder_count >= 2) continue;

      await sendReplyButtons(
        order.phone,
        `⏰ *Complete Your Order!*\n\n` +
        `📦 Order: *${order.order_id}*\n` +
        `💰 Amount: *₹${order.total}*\n\n` +
        `Your order is waiting! Complete payment to confirm.`,
        [
          { id: `PAY_${order.order_id}`, title: '💳 Pay Now' },
          { id: 'CHAT_NOW', title: '💬 Need Help?' }
        ],
        env
      );

      // Log reminder
      await env.DB.prepare(`
        INSERT INTO analytics (event_type, event_name, phone, order_id, timestamp)
        VALUES ('reminder', 'payment_reminder', ?, ?, datetime('now'))
      `).bind(order.phone, order.order_id).run();

      sent++;
    }

    console.log(`[Reminders] 💳 Sent ${sent} payment reminders`);
    return { sent };

  } catch (error) {
    console.error('[Reminders] Payment reminder error:', error.message);
    return { error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// ABANDONED CART REMINDERS
// ═══════════════════════════════════════════════════════════════

export async function sendCartReminders(env) {
  console.log('[Reminders] 🛒 Checking abandoned carts...');

  try {
    const { results: abandonedCarts } = await env.DB.prepare(`
      SELECT c.*, cu.name as customer_name
      FROM carts c
      LEFT JOIN customers cu ON c.phone = cu.phone
      WHERE c.status = 'active' 
        AND c.item_count > 0
        AND c.updated_at <= datetime('now', '-24 hours')
        AND c.updated_at >= datetime('now', '-72 hours')
        AND c.reminder_count < 2
      LIMIT 20
    `).all();

    let sent = 0;

    for (const cart of abandonedCarts || []) {
      const items = JSON.parse(cart.items || '[]');
      const itemNames = items.slice(0, 2).map(i => i.name).join(', ');
      const more = items.length > 2 ? ` +${items.length - 2} more` : '';

      await sendReplyButtons(
        cart.phone,
        `🛒 *You Left Something Beautiful Behind!*\n\n` +
        `${itemNames}${more}\n\n` +
        `💰 Total: ₹${cart.total}\n` +
        `🚚 FREE shipping above ₹498!\n\n` +
        `Complete your purchase before items sell out! 💎`,
        [
          { id: 'VIEW_CART', title: '🛒 View Cart' },
          { id: 'OPEN_CATALOG', title: '📱 Browse More' }
        ],
        env
      );

      // Update reminder count
      await env.DB.prepare(`
        UPDATE carts SET reminder_count = reminder_count + 1, last_reminder_at = datetime('now')
        WHERE phone = ?
      `).bind(cart.phone).run();

      sent++;
    }

    console.log(`[Reminders] 🛒 Sent ${sent} cart reminders`);
    return { sent };

  } catch (error) {
    console.error('[Reminders] Cart reminder error:', error.message);
    return { error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY REMINDERS
// ═══════════════════════════════════════════════════════════════

export async function sendDeliveryReminders(env) {
  console.log('[Reminders] 📦 Checking delivery reminders...');

  try {
    // Orders out for delivery
    const { results: deliveryOrders } = await env.DB.prepare(`
      SELECT order_id, phone, customer_name
      FROM orders
      WHERE status = 'out_for_delivery'
    `).all();

    let sent = 0;

    for (const order of deliveryOrders || []) {
      await sendText(
        order.phone,
        `🏃 *Arriving Today!*\n\n` +
        `Your KAAPAV order *${order.order_id}* is out for delivery!\n\n` +
        `📦 Please ensure someone is available to receive it.\n\n` +
        `Can't wait for you to sparkle! ✨💎`,
        env
      );
      sent++;
    }

    console.log(`[Reminders] 📦 Sent ${sent} delivery reminders`);
    return { sent };

  } catch (error) {
    console.error('[Reminders] Delivery reminder error:', error.message);
    return { error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// REVIEW REQUEST (Post-Delivery)
// ═══════════════════════════════════════════════════════════════

export async function sendReviewRequests(env) {
  console.log('[Reminders] ⭐ Checking review requests...');

  try {
    // Orders delivered 3-5 days ago
    const { results: deliveredOrders } = await env.DB.prepare(`
      SELECT o.order_id, o.phone, o.customer_name,
        (SELECT COUNT(*) FROM analytics WHERE order_id = o.order_id AND event_name = 'review_request') as review_requested
      FROM orders o
      WHERE o.status = 'delivered'
        AND o.delivered_at >= datetime('now', '-5 days')
        AND o.delivered_at <= datetime('now', '-3 days')
      LIMIT 20
    `).all();

    let sent = 0;

    for (const order of deliveredOrders || []) {
      if (order.review_requested > 0) continue;

      await sendReplyButtons(
        order.phone,
        `⭐ *How was your KAAPAV experience?*\n\n` +
        `We hope you love your jewellery! 💎\n\n` +
        `Your feedback helps us serve you better and helps other customers discover KAAPAV.\n\n` +
        `Would you take a moment to share your thoughts?`,
        [
          { id: 'GIVE_REVIEW', title: '⭐ Write Review' },
          { id: 'CHAT_NOW', title: '💬 Feedback' }
        ],
        env
      );

      // Log request
      await env.DB.prepare(`
        INSERT INTO analytics (event_type, event_name, phone, order_id, timestamp)
        VALUES ('reminder', 'review_request', ?, ?, datetime('now'))
      `).bind(order.phone, order.order_id).run();

      sent++;
    }

    console.log(`[Reminders] ⭐ Sent ${sent} review requests`);
    return { sent };

  } catch (error) {
    console.error('[Reminders] Review request error:', error.message);
    return { error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// RE-ENGAGEMENT (Inactive Customers)
// ═══════════════════════════════════════════════════════════════

export async function sendReengagementMessages(env) {
  console.log('[Reminders] 👋 Checking re-engagement...');

  try {
    // Customers inactive for 30-45 days
    const { results: inactiveCustomers } = await env.DB.prepare(`
      SELECT c.phone, c.name, c.order_count, c.last_seen,
        (SELECT COUNT(*) FROM analytics WHERE phone = c.phone AND event_name = 'reengagement' AND timestamp >= datetime('now', '-30 days')) as recent_reengagement
      FROM customers c
      WHERE c.last_seen <= datetime('now', '-30 days')
        AND c.last_seen >= datetime('now', '-45 days')
        AND c.order_count >= 1
        AND c.opted_in_marketing = 1
      LIMIT 10
    `).all();

    let sent = 0;

    for (const customer of inactiveCustomers || []) {
      if (customer.recent_reengagement > 0) continue;

      const name = customer.name ? customer.name.split(' ')[0] : 'there';

      await sendReplyButtons(
        customer.phone,
        `👋 *Hey ${name}, we miss you!*\n\n` +
        `It's been a while since your last visit to KAAPAV.\n\n` +
        `✨ We've added new designs\n` +
        `🎉 Special offers waiting for you\n\n` +
        `Come back and explore! 💎`,
        [
          { id: 'BESTSELLERS', title: '🏆 New Arrivals' },
          { id: 'OFFERS_MENU', title: '🎉 Offers' }
        ],
        env
      );

      // Log
      await env.DB.prepare(`
        INSERT INTO analytics (event_type, event_name, phone, timestamp)
        VALUES ('reminder', 'reengagement', ?, datetime('now'))
      `).bind(customer.phone).run();

      sent++;
    }

    console.log(`[Reminders] 👋 Sent ${sent} re-engagement messages`);
    return { sent };

  } catch (error) {
    console.error('[Reminders] Re-engagement error:', error.message);
    return { error: error.message };
  }
}
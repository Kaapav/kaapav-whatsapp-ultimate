/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - SCHEDULED TASKS (CRON)
 * ═══════════════════════════════════════════════════════════════
 * Handles all scheduled/cron jobs
 * ═══════════════════════════════════════════════════════════════
 */

import { sendText, sendReplyButtons, sendTemplate, normalizeIN, LINKS } from '../utils/sendMessage.js';
import { fromEnglish } from '../utils/translate.js';

// ═══════════════════════════════════════════════════════════════
// MAIN CRON HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleScheduledTasks(event, env) {
  const cron = event.cron;
  
  console.log(`[Cron] ⏰ Triggered: ${cron} at ${new Date().toISOString()}`);

  try {
    switch (cron) {
      // Every 5 minutes - Check for pending tasks
      case '*/5 * * * *':
        await checkPendingReminders(env);
        await processScheduledBroadcasts(env);
        break;

      // 8:30 AM IST (3:00 UTC) - Morning tasks
      case '0 3 * * *':
        await sendMorningReminders(env);
        await checkAbandonedCarts(env);
        break;

      // 5:30 PM IST (12:00 UTC) - Evening tasks
      case '0 12 * * *':
        await sendEveningEngagement(env);
        await sendDeliveryReminders(env);
        break;

      // Midnight UTC - Daily cleanup & reports
      case '0 0 * * *':
        await runDailyCleanup(env);
        await generateDailyReport(env);
        await updateCustomerSegments(env);
        break;

      default:
        console.log(`[Cron] Unknown cron pattern: ${cron}`);
    }

    console.log(`[Cron] ✅ Completed: ${cron}`);
    
  } catch (error) {
    console.error(`[Cron] ❌ Error in ${cron}:`, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// REMINDER TASKS
// ═══════════════════════════════════════════════════════════════

async function checkPendingReminders(env) {
  console.log('[Cron] 📋 Checking pending reminders...');

  try {
    // Get orders needing follow-up
    const { results: pendingOrders } = await env.DB.prepare(`
      SELECT * FROM orders 
      WHERE status = 'pending' 
        AND payment_status = 'unpaid'
        AND created_at < datetime('now', '-2 hours')
        AND created_at > datetime('now', '-24 hours')
        AND (last_reminder_at IS NULL OR last_reminder_at < datetime('now', '-4 hours'))
      LIMIT 10
    `).all();

    for (const order of pendingOrders || []) {
      await sendPaymentReminder(order, env);
      
      // Update last reminder
      await env.DB.prepare(`
        UPDATE orders SET last_reminder_at = datetime('now') WHERE order_id = ?
      `).bind(order.order_id).run();
    }

    console.log(`[Cron] Sent ${pendingOrders?.length || 0} payment reminders`);

  } catch (error) {
    console.error('[Cron] Reminder check failed:', error.message);
  }
}

async function sendPaymentReminder(order, env) {
  const phone = order.phone;
  
  try {
    await sendReplyButtons(
      phone,
      `💳 *Payment Pending*\n\n` +
      `📦 Order: *${order.order_id}*\n` +
      `💰 Amount: *₹${order.total}*\n\n` +
      `Your order is waiting! Complete payment to ship within 24 hours.\n\n` +
      `⏰ Order expires in 24 hours`,
      [
        { id: `PAY_${order.order_id}`, title: '💳 Pay Now' },
        { id: 'CHAT_NOW', title: '💬 Need Help?' },
        { id: `CANCEL_${order.order_id}`, title: '❌ Cancel' }
      ],
      env,
      `Order: ${order.order_id}`
    );

    // Log
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, order_id, data, timestamp)
      VALUES ('reminder', 'payment_reminder', ?, ?, '{}', datetime('now'))
    `).bind(phone, order.order_id).run();

  } catch (error) {
    console.error(`[Cron] Payment reminder failed for ${order.order_id}:`, error.message);
  }
}

async function sendMorningReminders(env) {
  console.log('[Cron] 🌅 Sending morning reminders...');

  try {
    // Get customers with items in cart (not converted in 24 hours)
    const { results: abandonedCarts } = await env.DB.prepare(`
      SELECT c.*, cu.name as customer_name
      FROM carts c
      LEFT JOIN customers cu ON c.phone = cu.phone
      WHERE c.status = 'active' 
        AND c.item_count > 0
        AND c.updated_at < datetime('now', '-24 hours')
        AND c.reminder_count < 2
        AND cu.opted_in_marketing = 1
      LIMIT 20
    `).all();

    for (const cart of abandonedCarts || []) {
      await sendCartReminder(cart, env);
    }

    console.log(`[Cron] Sent ${abandonedCarts?.length || 0} cart reminders`);

  } catch (error) {
    console.error('[Cron] Morning reminders failed:', error.message);
  }
}

async function sendCartReminder(cart, env) {
  const phone = cart.phone;
  const name = cart.customer_name || 'there';
  const items = JSON.parse(cart.items || '[]');
  
  if (items.length === 0) return;

  try {
    const firstItem = items[0].name;
    const moreItems = items.length > 1 ? ` and ${items.length - 1} more` : '';

    await sendReplyButtons(
      phone,
      `Hey ${name}! 💎\n\n` +
      `You left something beautiful in your cart:\n\n` +
      `🛒 *${firstItem}*${moreItems}\n` +
      `💰 Total: ₹${cart.total}\n\n` +
      `Complete your order and sparkle! ✨\n\n` +
      `🚚 FREE shipping on orders above ₹498`,
      [
        { id: 'VIEW_CART', title: '🛒 View Cart' },
        { id: 'OPEN_CATALOG', title: '📱 Add More' },
        { id: 'CLEAR_CART', title: '🗑️ Clear Cart' }
      ],
      env
    );

    // Update reminder count
    await env.DB.prepare(`
      UPDATE carts SET reminder_count = reminder_count + 1, last_reminder_at = datetime('now')
      WHERE phone = ?
    `).bind(phone).run();

    // Log
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, timestamp)
      VALUES ('reminder', 'cart_reminder', ?, ?, datetime('now'))
    `).bind(phone, JSON.stringify({ total: cart.total, items: items.length })).run();

  } catch (error) {
    console.error(`[Cron] Cart reminder failed for ${phone}:`, error.message);
  }
}

async function checkAbandonedCarts(env) {
  console.log('[Cron] 🛒 Checking abandoned carts...');

  try {
    // Mark carts as abandoned if inactive for 7 days
    await env.DB.prepare(`
      UPDATE carts SET 
        status = 'abandoned',
        abandoned_at = datetime('now')
      WHERE status = 'active' 
        AND updated_at < datetime('now', '-7 days')
    `).run();

    console.log('[Cron] ✅ Abandoned carts updated');

  } catch (error) {
    console.error('[Cron] Abandoned cart check failed:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT TASKS
// ═══════════════════════════════════════════════════════════════

async function sendEveningEngagement(env) {
  console.log('[Cron] 🌆 Sending evening engagement...');

  try {
    // Get customers who haven't engaged in 7 days but are not blocked
    const { results: inactiveCustomers } = await env.DB.prepare(`
      SELECT * FROM customers 
      WHERE last_seen < datetime('now', '-7 days')
        AND last_seen > datetime('now', '-30 days')
        AND is_blocked = 0
        AND opted_in_marketing = 1
        AND (last_campaign_at IS NULL OR last_campaign_at < datetime('now', '-7 days'))
      LIMIT 20
    `).all();

    for (const customer of inactiveCustomers || []) {
      await sendReEngagementMessage(customer, env);
    }

    console.log(`[Cron] Sent ${inactiveCustomers?.length || 0} re-engagement messages`);

  } catch (error) {
    console.error('[Cron] Evening engagement failed:', error.message);
  }
}

async function sendReEngagementMessage(customer, env) {
  const phone = customer.phone;
  const name = customer.name || '';
  
  try {
    const greeting = name ? `Hey ${name.split(' ')[0]}! ` : '';
    
    await sendReplyButtons(
      phone,
      `${greeting}💎 We miss you at KAAPAV!\n\n` +
      `✨ Check out what's new:\n\n` +
      `🆕 Fresh arrivals this week\n` +
      `🎉 Exclusive offers waiting for you\n` +
      `🚚 FREE shipping above ₹498\n\n` +
      `Come back and sparkle! 👑`,
      [
        { id: 'NEW_ARRIVALS', title: '✨ New Arrivals' },
        { id: 'BESTSELLERS', title: '🏆 Bestsellers' },
        { id: 'MAIN_MENU', title: '📱 Explore' }
      ],
      env
    );

    // Update campaign tracking
    await env.DB.prepare(`
      UPDATE customers SET 
        last_campaign_at = datetime('now'),
        campaign_count = campaign_count + 1
      WHERE phone = ?
    `).bind(phone).run();

  } catch (error) {
    console.error(`[Cron] Re-engagement failed for ${phone}:`, error.message);
  }
}

async function sendDeliveryReminders(env) {
  console.log('[Cron] 📦 Sending delivery reminders...');

  try {
    // Get orders that should be delivered today/tomorrow
    const { results: upcomingDeliveries } = await env.DB.prepare(`
      SELECT * FROM orders 
      WHERE status = 'shipped'
        AND estimated_delivery >= date('now')
        AND estimated_delivery <= date('now', '+1 day')
        AND (delivery_reminder_sent IS NULL OR delivery_reminder_sent = 0)
      LIMIT 20
    `).all();

    for (const order of upcomingDeliveries || []) {
      await sendDeliveryUpdateMessage(order, env);
    }

    console.log(`[Cron] Sent ${upcomingDeliveries?.length || 0} delivery reminders`);

  } catch (error) {
    console.error('[Cron] Delivery reminders failed:', error.message);
  }
}

async function sendDeliveryUpdateMessage(order, env) {
  const phone = order.phone;
  
  try {
    const trackingUrl = order.tracking_url || `${LINKS.shiprocket}?tracking_id=${order.tracking_id}`;

    await sendReplyButtons(
      phone,
      `🎉 *Delivery Update!*\n\n` +
      `📦 Order: *${order.order_id}*\n\n` +
      `Your package is on its way and will arrive soon!\n\n` +
      `🚚 Courier: ${order.courier || 'Our delivery partner'}\n` +
      `📋 Tracking: ${order.tracking_id || 'Check link below'}\n\n` +
      `Track your package in real-time 👇`,
      [
        { id: `TRACK_${order.order_id}`, title: '📦 Track Package' },
        { id: 'CHAT_NOW', title: '💬 Need Help?' }
      ],
      env
    );

    // Mark as sent
    await env.DB.prepare(`
      UPDATE orders SET delivery_reminder_sent = 1 WHERE order_id = ?
    `).bind(order.order_id).run();

  } catch (error) {
    console.error(`[Cron] Delivery reminder failed for ${order.order_id}:`, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// BROADCAST TASKS
// ═══════════════════════════════════════════════════════════════

async function processScheduledBroadcasts(env) {
  console.log('[Cron] 📢 Processing scheduled broadcasts...');

  try {
    // Get broadcasts ready to send
    const { results: scheduledBroadcasts } = await env.DB.prepare(`
      SELECT * FROM broadcasts 
      WHERE status = 'scheduled'
        AND scheduled_at <= datetime('now')
      LIMIT 5
    `).all();

    for (const broadcast of scheduledBroadcasts || []) {
      // Update status to sending
      await env.DB.prepare(`
        UPDATE broadcasts SET status = 'sending', started_at = datetime('now')
        WHERE broadcast_id = ?
      `).bind(broadcast.broadcast_id).run();

      // Execute broadcast
      await executeBroadcast(broadcast, env);
    }

    console.log(`[Cron] Processed ${scheduledBroadcasts?.length || 0} broadcasts`);

  } catch (error) {
    console.error('[Cron] Broadcast processing failed:', error.message);
  }
}

async function executeBroadcast(broadcast, env) {
  console.log(`[Cron] 📢 Executing broadcast: ${broadcast.broadcast_id}`);

  try {
    // Get recipients
    let recipients = [];
    
    if (broadcast.target_type === 'all') {
      const { results } = await env.DB.prepare(`
        SELECT phone FROM customers WHERE opted_in_marketing = 1 AND is_blocked = 0
      `).all();
      recipients = results;
    } else if (broadcast.target_type === 'labels' && broadcast.target_labels) {
      const labels = JSON.parse(broadcast.target_labels);
      // Query customers with any of the labels
      const placeholders = labels.map(() => '?').join(', ');
      const { results } = await env.DB.prepare(`
        SELECT phone FROM customers 
        WHERE opted_in_marketing = 1 
          AND is_blocked = 0
          AND EXISTS (
            SELECT 1 FROM json_each(labels) 
            WHERE json_each.value IN (${placeholders})
          )
      `).bind(...labels).all();
      recipients = results;
    } else if (broadcast.target_type === 'custom' && broadcast.target_phones) {
      const phones = JSON.parse(broadcast.target_phones);
      recipients = phones.map(phone => ({ phone }));
    }

    // Update target count
    await env.DB.prepare(`
      UPDATE broadcasts SET target_count = ? WHERE broadcast_id = ?
    `).bind(recipients.length, broadcast.broadcast_id).run();

    let sentCount = 0;
    let failedCount = 0;
    const sendRate = broadcast.send_rate || 20; // messages per minute
    const delayMs = 60000 / sendRate;

    for (const recipient of recipients) {
      try {
        if (broadcast.template_name) {
          // Send template message
          const components = broadcast.template_params ? JSON.parse(broadcast.template_params) : [];
          await sendTemplate(recipient.phone, broadcast.template_name, 'en', components, env);
        } else {
          // Send regular message
          await sendText(recipient.phone, broadcast.message, env);
        }
        
        sentCount++;
        
        // Log recipient
        await env.DB.prepare(`
          INSERT INTO broadcast_recipients (broadcast_id, phone, status, sent_at)
          VALUES (?, ?, 'sent', datetime('now'))
        `).bind(broadcast.broadcast_id, recipient.phone).run();

        // Rate limiting
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (error) {
        failedCount++;
        console.error(`[Broadcast] Failed for ${recipient.phone}:`, error.message);
        
        await env.DB.prepare(`
          INSERT INTO broadcast_recipients (broadcast_id, phone, status, error_message)
          VALUES (?, ?, 'failed', ?)
        `).bind(broadcast.broadcast_id, recipient.phone, error.message).run();
      }
    }

    // Update broadcast status
    await env.DB.prepare(`
      UPDATE broadcasts SET 
        status = 'completed',
        sent_count = ?,
        failed_count = ?,
        completed_at = datetime('now')
      WHERE broadcast_id = ?
    `).bind(sentCount, failedCount, broadcast.broadcast_id).run();

    console.log(`[Broadcast] ✅ Completed: ${sentCount} sent, ${failedCount} failed`);

  } catch (error) {
    console.error(`[Broadcast] ❌ Execution failed:`, error.message);
    
    await env.DB.prepare(`
      UPDATE broadcasts SET status = 'failed' WHERE broadcast_id = ?
    `).bind(broadcast.broadcast_id).run();
  }
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP TASKS
// ═══════════════════════════════════════════════════════════════

async function runDailyCleanup(env) {
  console.log('[Cron] 🧹 Running daily cleanup...');

  try {
    // Expire old conversation states
    await env.DB.prepare(`
      DELETE FROM conversation_state WHERE expires_at < datetime('now', '-1 day')
    `).run();

    // Cancel old unpaid orders (older than 48 hours)
    await env.DB.prepare(`
      UPDATE orders SET 
        status = 'cancelled',
        cancellation_reason = 'Payment timeout - Auto cancelled',
        cancelled_at = datetime('now')
      WHERE status = 'pending' 
        AND payment_status = 'unpaid'
        AND created_at < datetime('now', '-48 hours')
    `).run();

    // Archive old analytics (keep 90 days)
    await env.DB.prepare(`
      DELETE FROM analytics WHERE timestamp < datetime('now', '-90 days')
    `).run();

    // Mark old carts as expired
    await env.DB.prepare(`
      UPDATE carts SET status = 'expired' 
      WHERE status IN ('active', 'abandoned') 
        AND updated_at < datetime('now', '-30 days')
    `).run();

    console.log('[Cron] ✅ Cleanup completed');

  } catch (error) {
    console.error('[Cron] Cleanup failed:', error.message);
  }
}

async function generateDailyReport(env) {
  console.log('[Cron] 📊 Generating daily report...');

  try {
    const yesterday = "date('now', '-1 day')";
    
    // Get stats
    const messageStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
        SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing,
        SUM(CASE WHEN is_auto_reply = 1 THEN 1 ELSE 0 END) as auto_replies
      FROM messages WHERE date(timestamp) = ${yesterday}
    `).first();

    const orderStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' OR status = 'shipped' OR status = 'delivered' THEN 1 ELSE 0 END) as successful,
        SUM(total) as revenue
      FROM orders WHERE date(created_at) = ${yesterday}
    `).first();

    const customerStats = await env.DB.prepare(`
      SELECT COUNT(*) as new_customers
      FROM customers WHERE date(created_at) = ${yesterday}
    `).first();

    const report = {
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      messages: messageStats,
      orders: orderStats,
      customers: customerStats
    };

    // Store report
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, data, timestamp)
      VALUES ('report', 'daily_report', ?, datetime('now'))
    `).bind(JSON.stringify(report)).run();

    console.log('[Cron] ✅ Daily report generated:', report);

    // Send report to admin via n8n if configured
    if (env.N8N_WEBHOOK_URL) {
      await fetch(env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'daily_report', report })
      }).catch(() => {});
    }

  } catch (error) {
    console.error('[Cron] Report generation failed:', error.message);
  }
}

async function updateCustomerSegments(env) {
  console.log('[Cron] 👥 Updating customer segments...');

  try {
    // VIP: High spenders (>₹5000 total)
    await env.DB.prepare(`
      UPDATE customers SET segment = 'vip'
      WHERE total_spent >= 5000
    `).run();

    // Regular: Multiple orders
    await env.DB.prepare(`
      UPDATE customers SET segment = 'regular'
      WHERE order_count >= 2 AND segment != 'vip'
    `).run();

    // Inactive: No activity in 30 days
    await env.DB.prepare(`
      UPDATE customers SET segment = 'inactive'
      WHERE last_seen < datetime('now', '-30 days')
        AND segment NOT IN ('vip')
    `).run();

    // New: Created in last 7 days
    await env.DB.prepare(`
      UPDATE customers SET segment = 'new'
      WHERE created_at > datetime('now', '-7 days')
        AND order_count = 0
    `).run();

    // Update engagement scores
    await env.DB.prepare(`
      UPDATE customers SET engagement_score = 
        CASE 
          WHEN last_seen > datetime('now', '-1 day') THEN 100
          WHEN last_seen > datetime('now', '-7 days') THEN 80
          WHEN last_seen > datetime('now', '-30 days') THEN 50
          ELSE 20
        END + 
        CASE 
          WHEN order_count >= 5 THEN 30
          WHEN order_count >= 2 THEN 20
          WHEN order_count >= 1 THEN 10
          ELSE 0
        END
    `).run();

    console.log('[Cron] ✅ Customer segments updated');

  } catch (error) {
    console.error('[Cron] Segment update failed:', error.message);
  }
}

// Export for external use
export { executeBroadcast };
/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP ULTIMATE - MAIN ENTRY POINT
 * ═══════════════════════════════════════════════════════════════
 * Complete WhatsApp Business Solution
 * Version: 2.0.0
 * ═══════════════════════════════════════════════════════════════
 */

import { handleWebhookVerification, handleWebhookMessage } from './handlers/webhook.js';
import { handleScheduledTasks } from './cron/scheduled.js';

export default {
  /**
   * Main fetch handler for all HTTP requests
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Log request
    console.log(`[${method}] ${path}`);

    try {
      // ═══════════════════════════════════════════════════════════
      // WEBHOOK ROUTES
      // ═══════════════════════════════════════════════════════════

      // Webhook verification (GET /webhook)
      if (path === '/webhook' && method === 'GET') {
        return handleWebhookVerification(request, env);
      }

      // Webhook messages (POST /webhook)
      if (path === '/webhook' && method === 'POST') {
        const body = await request.json();
        ctx.waitUntil(handleWebhookMessage(body, env));
        return new Response('OK', { status: 200 });
      }

      // ═══════════════════════════════════════════════════════════
      // CHAT API ROUTES
      // ═══════════════════════════════════════════════════════════

      // Get all chats
      if (path === '/api/chats' && method === 'GET') {
        return await getChats(env, url, corsHeaders);
      }

      // Get single chat
      if (path.match(/^\/api\/chats\/\d+$/) && method === 'GET') {
        const phone = path.split('/').pop();
        return await getChat(phone, env, corsHeaders);
      }

      // Update chat (labels, notes, etc.)
      if (path.match(/^\/api\/chats\/\d+$/) && method === 'PUT') {
        const phone = path.split('/').pop();
        const data = await request.json();
        return await updateChat(phone, data, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // MESSAGE API ROUTES
      // ═══════════════════════════════════════════════════════════

      // Get messages for a phone
      if (path.match(/^\/api\/messages\/\d+$/) && method === 'GET') {
        const phone = path.split('/').pop();
        return await getMessages(phone, env, url, corsHeaders);
      }

      // Send message
      if (path === '/api/messages/send' && method === 'POST') {
        const data = await request.json();
        return await sendMessageAPI(data, env, corsHeaders);
      }

      // Send template message
      if (path === '/api/messages/template' && method === 'POST') {
        const data = await request.json();
        return await sendTemplateAPI(data, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // CUSTOMER API ROUTES
      // ═══════════════════════════════════════════════════════════

      // Get all customers
      if (path === '/api/customers' && method === 'GET') {
        return await getCustomers(env, url, corsHeaders);
      }

      // Get single customer
      if (path.match(/^\/api\/customers\/\d+$/) && method === 'GET') {
        const phone = path.split('/').pop();
        return await getCustomer(phone, env, corsHeaders);
      }

      // Update customer
      if (path.match(/^\/api\/customers\/\d+$/) && method === 'PUT') {
        const phone = path.split('/').pop();
        const data = await request.json();
        return await updateCustomer(phone, data, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // ORDER API ROUTES
      // ═══════════════════════════════════════════════════════════

      // Get all orders
      if (path === '/api/orders' && method === 'GET') {
        return await getOrders(env, url, corsHeaders);
      }

      // Get single order
      if (path.match(/^\/api\/orders\/[A-Z0-9-]+$/i) && method === 'GET') {
        const orderId = path.split('/').pop();
        return await getOrder(orderId, env, corsHeaders);
      }

      // Create order
      if (path === '/api/orders' && method === 'POST') {
        const data = await request.json();
        return await createOrder(data, env, corsHeaders);
      }

      // Update order
      if (path.match(/^\/api\/orders\/[A-Z0-9-]+$/i) && method === 'PUT') {
        const orderId = path.split('/').pop();
        const data = await request.json();
        return await updateOrder(orderId, data, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // QUICK REPLIES API ROUTES
      // ═══════════════════════════════════════════════════════════

      // Get quick replies
      if (path === '/api/quick-replies' && method === 'GET') {
        return await getQuickReplies(env, corsHeaders);
      }

      // Add/Update quick reply
      if (path === '/api/quick-replies' && method === 'POST') {
        const data = await request.json();
        return await saveQuickReply(data, env, corsHeaders);
      }

      // Delete quick reply
      if (path.match(/^\/api\/quick-replies\/\d+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        return await deleteQuickReply(id, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // BROADCAST API ROUTES
      // ═══════════════════════════════════════════════════════════

      // Get broadcasts
      if (path === '/api/broadcasts' && method === 'GET') {
        return await getBroadcasts(env, corsHeaders);
      }

      // Create broadcast
      if (path === '/api/broadcasts' && method === 'POST') {
        const data = await request.json();
        return await createBroadcast(data, env, corsHeaders);
      }

      // Send broadcast
      if (path.match(/^\/api\/broadcasts\/[A-Z0-9-]+\/send$/i) && method === 'POST') {
        const broadcastId = path.split('/')[3];
        return await sendBroadcast(broadcastId, env, ctx, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // ANALYTICS API ROUTES
      // ═══════════════════════════════════════════════════════════

      // Get dashboard stats
      if (path === '/api/stats' && method === 'GET') {
        return await getStats(env, url, corsHeaders);
      }

      // Get analytics
      if (path === '/api/analytics' && method === 'GET') {
        return await getAnalytics(env, url, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // PRODUCT/CATALOG API ROUTES
      // ═══════════════════════════════════════════════════════════

      // Get products
      if (path === '/api/products' && method === 'GET') {
        return await getProducts(env, url, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // HEALTH & INFO ROUTES
      // ═══════════════════════════════════════════════════════════

      if (path === '/' || path === '/health') {
        return Response.json({
          status: 'ok',
          service: 'KAAPAV WhatsApp Ultimate',
          version: '2.0.0',
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // 404 Not Found
      return Response.json(
        { error: 'Not Found', path },
        { status: 404, headers: corsHeaders }
      );

    } catch (error) {
      console.error('[API Error]', error);
      return Response.json(
        { error: error.message, stack: error.stack },
        { status: 500, headers: corsHeaders }
      );
    }
  },

  /**
   * Scheduled tasks handler (Cron)
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduledTasks(event, env));
  }
};

// ═══════════════════════════════════════════════════════════════
// API HANDLER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// CHATS
// ─────────────────────────────────────────────────────────────────

async function getChats(env, url, headers) {
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  let query = `
    SELECT c.*, 
           (SELECT COUNT(*) FROM messages m WHERE m.phone = c.phone) as message_count
    FROM chats c
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  }

  if (search) {
    query += ` AND (c.phone LIKE ? OR c.customer_name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY c.last_timestamp DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  // Get total count
  const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM chats`).first();

  return Response.json({
    chats: results,
    total: countResult?.total || 0,
    limit,
    offset
  }, { headers });
}

async function getChat(phone, env, headers) {
  const chat = await env.DB.prepare(`
    SELECT * FROM chats WHERE phone = ?
  `).bind(phone).first();

  if (!chat) {
    return Response.json({ error: 'Chat not found' }, { status: 404, headers });
  }

  return Response.json(chat, { headers });
}

async function updateChat(phone, data, env, headers) {
  const allowedFields = ['customer_name', 'labels', 'notes', 'status', 'priority', 'assigned_to', 'is_starred'];
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
  }

  if (updates.length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400, headers });
  }

  updates.push('updated_at = datetime("now")');
  values.push(phone);

  await env.DB.prepare(`
    UPDATE chats SET ${updates.join(', ')} WHERE phone = ?
  `).bind(...values).run();

  return Response.json({ success: true }, { headers });
}

// ─────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────

async function getMessages(phone, env, url, headers) {
  const limit = parseInt(url.searchParams.get('limit')) || 100;
  const before = url.searchParams.get('before');

  let query = `SELECT * FROM messages WHERE phone = ?`;
  const params = [phone];

  if (before) {
    query += ` AND timestamp < ?`;
    params.push(before);
  }

  query += ` ORDER BY timestamp DESC LIMIT ?`;
  params.push(limit);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  // Mark chat as read
  await env.DB.prepare(`
    UPDATE chats SET unread_count = 0 WHERE phone = ?
  `).bind(phone).run();

  // Return in ascending order for display
  return Response.json(results.reverse(), { headers });
}

async function sendMessageAPI(data, env, headers) {
  const { to, text, type = 'text' } = data;

  if (!to || !text) {
    return Response.json({ error: 'Missing to or text' }, { status: 400, headers });
  }

  const { sendText, normalizeIN } = await import('./utils/sendMessage.js');
  const phone = normalizeIN(to);

  try {
    const result = await sendText(phone, text, env);

    // Save outgoing message
    await env.DB.prepare(`
      INSERT INTO messages (phone, text, direction, timestamp, message_type, is_auto_reply)
      VALUES (?, ?, 'outgoing', datetime('now'), ?, 0)
    `).bind(phone, text, type).run();

    // Update chat
    await env.DB.prepare(`
      UPDATE chats SET 
        last_message = ?, 
        last_timestamp = datetime('now'),
        last_direction = 'outgoing'
      WHERE phone = ?
    `).bind(text, phone).run();

    // Log analytics
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data)
      VALUES ('message_out', 'manual_message', ?, ?)
    `).bind(phone, JSON.stringify({ text_length: text.length })).run();

    return Response.json({ success: true, result }, { headers });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
}

async function sendTemplateAPI(data, env, headers) {
  const { to, template_name, language = 'en', components = [] } = data;

  if (!to || !template_name) {
    return Response.json({ error: 'Missing to or template_name' }, { status: 400, headers });
  }

  const { sendTemplate, normalizeIN } = await import('./utils/sendMessage.js');
  const phone = normalizeIN(to);

  try {
    const result = await sendTemplate(phone, template_name, language, components, env);

    // Save outgoing message
    await env.DB.prepare(`
      INSERT INTO messages (phone, text, direction, timestamp, message_type, is_template, template_name)
      VALUES (?, ?, 'outgoing', datetime('now'), 'template', 1, ?)
    `).bind(phone, `[Template: ${template_name}]`, template_name).run();

    return Response.json({ success: true, result }, { headers });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
}

// ─────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────

async function getCustomers(env, url, headers) {
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  const segment = url.searchParams.get('segment');
  const search = url.searchParams.get('search');

  let query = `SELECT * FROM customers WHERE 1=1`;
  const params = [];

  if (segment) {
    query += ` AND segment = ?`;
    params.push(segment);
  }

  if (search) {
    query += ` AND (phone LIKE ? OR name LIKE ? OR email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY last_seen DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return Response.json(results, { headers });
}

async function getCustomer(phone, env, headers) {
  const customer = await env.DB.prepare(`
    SELECT * FROM customers WHERE phone = ?
  `).bind(phone).first();

  const orders = await env.DB.prepare(`
    SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC LIMIT 10
  `).bind(phone).all();

  return Response.json({
    customer: customer || { phone, isNew: true },
    orders: orders.results || []
  }, { headers });
}

async function updateCustomer(phone, data, env, headers) {
  const allowedFields = [
    'name', 'email', 'gender', 'birthday',
    'address_line1', 'address_line2', 'city', 'state', 'pincode',
    'alternate_phone', 'language', 'labels', 'notes', 'segment'
  ];
  
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
  }

  if (updates.length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400, headers });
  }

  updates.push('updated_at = datetime("now")');
  values.push(phone);

  await env.DB.prepare(`
    UPDATE customers SET ${updates.join(', ')} WHERE phone = ?
  `).bind(...values).run();

  return Response.json({ success: true }, { headers });
}

// ─────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────

async function getOrders(env, url, headers) {
  const limit = parseInt(url.searchParams.get('limit')) || 50;
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  const status = url.searchParams.get('status');
  const payment_status = url.searchParams.get('payment_status');

  let query = `SELECT * FROM orders WHERE 1=1`;
  const params = [];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (payment_status) {
    query += ` AND payment_status = ?`;
    params.push(payment_status);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return Response.json(results, { headers });
}

async function getOrder(orderId, env, headers) {
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();

  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404, headers });
  }

  const items = await env.DB.prepare(`
    SELECT * FROM order_items WHERE order_id = ?
  `).bind(orderId).all();

  return Response.json({
    ...order,
    items: items.results || []
  }, { headers });
}

async function createOrder(data, env, headers) {
  const { generateOrderId } = await import('./utils/helpers.js');
  const orderId = generateOrderId();

  const {
    phone, customer_name, items, address, city, state, pincode,
    subtotal = 0, discount = 0, shipping_cost = 0, total = 0
  } = data;

  await env.DB.prepare(`
    INSERT INTO orders (
      order_id, phone, customer_name, items, item_count,
      shipping_address, shipping_city, shipping_state, shipping_pincode,
      subtotal, discount, shipping_cost, total,
      status, payment_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')
  `).bind(
    orderId, phone, customer_name, JSON.stringify(items), items.length,
    address, city, state, pincode,
    subtotal, discount, shipping_cost, total
  ).run();

  return Response.json({ success: true, order_id: orderId }, { headers });
}

async function updateOrder(orderId, data, env, headers) {
  const allowedFields = [
    'status', 'payment_status', 'payment_id', 'tracking_id', 'tracking_url',
    'courier', 'internal_notes', 'cancellation_reason'
  ];
  
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }

  // Auto-set timestamps based on status
  if (data.status === 'confirmed') updates.push('confirmed_at = datetime("now")');
  if (data.status === 'shipped') updates.push('shipped_at = datetime("now")');
  if (data.status === 'delivered') updates.push('delivered_at = datetime("now")');
  if (data.status === 'cancelled') updates.push('cancelled_at = datetime("now")');
  if (data.payment_status === 'paid') updates.push('paid_at = datetime("now")');

  updates.push('updated_at = datetime("now")');
  values.push(orderId);

  await env.DB.prepare(`
    UPDATE orders SET ${updates.join(', ')} WHERE order_id = ?
  `).bind(...values).run();

  return Response.json({ success: true }, { headers });
}

// ─────────────────────────────────────────────────────────────────
// QUICK REPLIES
// ─────────────────────────────────────────────────────────────────

async function getQuickReplies(env, headers) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM quick_replies ORDER BY priority DESC, use_count DESC
  `).all();

  return Response.json(results, { headers });
}

async function saveQuickReply(data, env, headers) {
  const { id, keyword, response, match_type = 'contains', priority = 0, language = 'en' } = data;

  if (!keyword || !response) {
    return Response.json({ error: 'Missing keyword or response' }, { status: 400, headers });
  }

  if (id) {
    // Update existing
    await env.DB.prepare(`
      UPDATE quick_replies SET 
        keyword = ?, response = ?, match_type = ?, priority = ?, language = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(keyword.toLowerCase(), response, match_type, priority, language, id).run();
  } else {
    // Create new
    await env.DB.prepare(`
      INSERT INTO quick_replies (keyword, response, match_type, priority, language)
      VALUES (?, ?, ?, ?, ?)
    `).bind(keyword.toLowerCase(), response, match_type, priority, language).run();
  }

  return Response.json({ success: true }, { headers });
}

async function deleteQuickReply(id, env, headers) {
  await env.DB.prepare(`DELETE FROM quick_replies WHERE id = ?`).bind(id).run();
  return Response.json({ success: true }, { headers });
}

// ─────────────────────────────────────────────────────────────────
// BROADCASTS
// ─────────────────────────────────────────────────────────────────

async function getBroadcasts(env, headers) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 50
  `).all();

  return Response.json(results, { headers });
}

async function createBroadcast(data, env, headers) {
  const { generateBroadcastId } = await import('./utils/helpers.js');
  const broadcastId = generateBroadcastId();

  const {
    name, message, template_name, target_type = 'all',
    target_labels, scheduled_at
  } = data;

  await env.DB.prepare(`
    INSERT INTO broadcasts (
      broadcast_id, name, message, template_name,
      target_type, target_labels, scheduled_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
  `).bind(
    broadcastId, name, message, template_name,
    target_type, JSON.stringify(target_labels || []), scheduled_at
  ).run();

  return Response.json({ success: true, broadcast_id: broadcastId }, { headers });
}

async function sendBroadcast(broadcastId, env, ctx, headers) {
  const { executeBroadcast } = await import('./handlers/campaignHandler.js');
  
  ctx.waitUntil(executeBroadcast(broadcastId, env));

  return Response.json({ success: true, message: 'Broadcast started' }, { headers });
}

// ─────────────────────────────────────────────────────────────────
// ANALYTICS & STATS
// ─────────────────────────────────────────────────────────────────

async function getStats(env, url, headers) {
  const period = url.searchParams.get('period') || 'today';
  
  let dateFilter = '';
  switch (period) {
    case 'today':
      dateFilter = `timestamp >= date('now')`;
      break;
    case 'week':
      dateFilter = `timestamp >= date('now', '-7 days')`;
      break;
    case 'month':
      dateFilter = `timestamp >= date('now', '-30 days')`;
      break;
    default:
      dateFilter = `1=1`;
  }

  const messageStats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
      SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing,
      SUM(CASE WHEN is_auto_reply = 1 THEN 1 ELSE 0 END) as auto_replies
    FROM messages WHERE ${dateFilter}
  `).first();

  const chatStats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN unread_count > 0 THEN 1 ELSE 0 END) as unread,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open
    FROM chats
  `).first();

  const orderStats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(total) as revenue
    FROM orders WHERE ${dateFilter.replace('timestamp', 'created_at')}
  `).first();

  const customerStats = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM customers
  `).first();

  return Response.json({
    messages: messageStats,
    chats: chatStats,
    orders: orderStats,
    customers: customerStats,
    period,
    timestamp: new Date().toISOString()
  }, { headers });
}

async function getAnalytics(env, url, headers) {
  const type = url.searchParams.get('type') || 'overview';
  const days = parseInt(url.searchParams.get('days')) || 7;

  let data = {};

  if (type === 'overview' || type === 'messages') {
    // Messages per day
    const { results: messagesByDay } = await env.DB.prepare(`
      SELECT 
        date(timestamp) as date,
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
        SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing
      FROM messages 
      WHERE timestamp >= date('now', '-${days} days')
      GROUP BY date(timestamp)
      ORDER BY date
    `).all();
    data.messagesByDay = messagesByDay;
  }

  if (type === 'overview' || type === 'orders') {
    // Orders per day
    const { results: ordersByDay } = await env.DB.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as total,
        SUM(total) as revenue
      FROM orders 
      WHERE created_at >= date('now', '-${days} days')
      GROUP BY date(created_at)
      ORDER BY date
    `).all();
    data.ordersByDay = ordersByDay;
  }

  if (type === 'overview' || type === 'hourly') {
    // Messages by hour
    const { results: messagesByHour } = await env.DB.prepare(`
      SELECT 
        strftime('%H', timestamp) as hour,
        COUNT(*) as count
      FROM messages 
      WHERE timestamp >= date('now', '-${days} days')
      GROUP BY hour
      ORDER BY hour
    `).all();
    data.messagesByHour = messagesByHour;
  }

  return Response.json(data, { headers });
}

// ─────────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────────

async function getProducts(env, url, headers) {
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const limit = parseInt(url.searchParams.get('limit')) || 50;

  let query = `SELECT * FROM products WHERE is_active = 1`;
  const params = [];

  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  if (search) {
    query += ` AND (name LIKE ? OR description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY order_count DESC LIMIT ?`;
  params.push(limit);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return Response.json(results, { headers });
}
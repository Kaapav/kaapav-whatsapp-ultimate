/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - ORDER SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Order management service layer
 * ═══════════════════════════════════════════════════════════════
 */

import { generateOrderId, calculateShipping, estimateDelivery } from '../utils/helpers.js';
import { createPaymentLink } from './payment.js';
import { createShipment } from './shipping.js';

// ═══════════════════════════════════════════════════════════════
// CREATE ORDER
// ═══════════════════════════════════════════════════════════════

export async function createOrder(orderData, env) {
  const orderId = generateOrderId();
  
  const {
    phone,
    customer_name,
    email,
    items,
    address,
    city,
    state,
    pincode,
    discount_code,
    notes
  } = orderData;

  // Calculate totals
  const itemsArray = typeof items === 'string' ? JSON.parse(items) : items;
  const subtotal = itemsArray.reduce((sum, item) => 
    sum + (item.price * (item.quantity || 1)), 0
  );
  
  let discount = 0;
  if (discount_code) {
    const discountResult = applyDiscountCode(discount_code, subtotal);
    if (discountResult.valid) {
      discount = discountResult.amount;
    }
  }
  
  const shipping = calculateShipping(subtotal - discount, pincode);
  const total = subtotal - discount + shipping;

  try {
    await env.DB.prepare(`
      INSERT INTO orders (
        order_id, phone, customer_name, email, items, item_count,
        subtotal, discount, discount_code, shipping_cost, total,
        shipping_address, shipping_city, shipping_state, shipping_pincode,
        customer_notes, status, payment_status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', 'whatsapp')
    `).bind(
      orderId, phone, customer_name || '', email || '',
      JSON.stringify(itemsArray), itemsArray.length,
      subtotal, discount, discount_code || '', shipping, total,
      address, city || '', state || '', pincode,
      notes || ''
    ).run();

    // Create order items
    for (const item of itemsArray) {
      await env.DB.prepare(`
        INSERT INTO order_items (
          order_id, product_id, product_name, product_sku,
          quantity, unit_price, total_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        orderId,
        item.product_id || '',
        item.name,
        item.sku || '',
        item.quantity || 1,
        item.price,
        item.price * (item.quantity || 1)
      ).run();
    }

    // Generate payment link
    const paymentLink = await createPaymentLink({ order_id: orderId, total, phone }, env);

    // Update order with payment link
    await env.DB.prepare(`
      UPDATE orders SET payment_link = ? WHERE order_id = ?
    `).bind(paymentLink, orderId).run();

    return {
      success: true,
      order_id: orderId,
      total,
      payment_link: paymentLink
    };

  } catch (error) {
    console.error('[Order] Create error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// GET ORDER
// ═══════════════════════════════════════════════════════════════

export async function getOrder(orderId, env) {
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();

  if (!order) return null;

  const { results: items } = await env.DB.prepare(`
    SELECT * FROM order_items WHERE order_id = ?
  `).bind(orderId).all();

  return {
    ...order,
    items: items || []
  };
}

// ═══════════════════════════════════════════════════════════════
// GET ORDERS LIST
// ═══════════════════════════════════════════════════════════════

export async function getOrders(filters, env) {
  const {
    phone,
    status,
    payment_status,
    from_date,
    to_date,
    limit = 50,
    offset = 0
  } = filters || {};

  let query = `SELECT * FROM orders WHERE 1=1`;
  const params = [];

  if (phone) {
    query += ` AND phone = ?`;
    params.push(phone);
  }

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (payment_status) {
    query += ` AND payment_status = ?`;
    params.push(payment_status);
  }

  if (from_date) {
    query += ` AND created_at >= ?`;
    params.push(from_date);
  }

  if (to_date) {
    query += ` AND created_at <= ?`;
    params.push(to_date);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results || [];
}

// ═══════════════════════════════════════════════════════════════
// UPDATE ORDER
// ═══════════════════════════════════════════════════════════════

export async function updateOrder(orderId, updates, env) {
  const allowedFields = [
    'status', 'payment_status', 'payment_id', 'payment_method',
    'tracking_id', 'tracking_url', 'courier',
    'internal_notes', 'cancellation_reason'
  ];

  const updateClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      updateClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  // Auto-set timestamps
  if (updates.status === 'confirmed') {
    updateClauses.push('confirmed_at = datetime("now")');
  }
  if (updates.status === 'shipped') {
    updateClauses.push('shipped_at = datetime("now")');
  }
  if (updates.status === 'delivered') {
    updateClauses.push('delivered_at = datetime("now")');
  }
  if (updates.status === 'cancelled') {
    updateClauses.push('cancelled_at = datetime("now")');
  }
  if (updates.payment_status === 'paid') {
    updateClauses.push('paid_at = datetime("now")');
  }

  updateClauses.push('updated_at = datetime("now")');
  values.push(orderId);

  await env.DB.prepare(`
    UPDATE orders SET ${updateClauses.join(', ')} WHERE order_id = ?
  `).bind(...values).run();

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// PROCESS ORDER (Confirm + Create Shipment)
// ═══════════════════════════════════════════════════════════════

export async function processOrder(orderId, env) {
  const order = await getOrder(orderId, env);
  
  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  if (order.payment_status !== 'paid') {
    return { success: false, error: 'Order not paid' };
  }

  // Update status to processing
  await updateOrder(orderId, { status: 'processing' }, env);

  // Create shipment in Shiprocket
  const shipmentResult = await createShipment(order, env);

  if (shipmentResult.success) {
    await env.DB.prepare(`
      UPDATE orders SET 
        shiprocket_order_id = ?,
        status = 'processing'
      WHERE order_id = ?
    `).bind(shipmentResult.shiprocket_order_id, orderId).run();
  }

  return {
    success: true,
    shipment: shipmentResult
  };
}

// ═══════════════════════════════════════════════════════════════
// CANCEL ORDER
// ═══════════════════════════════════════════════════════════════

export async function cancelOrder(orderId, reason, env) {
  const order = await getOrder(orderId, env);
  
  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  // Can only cancel pending/confirmed orders
  if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
    return { success: false, error: `Cannot cancel order in ${order.status} status` };
  }

  await updateOrder(orderId, {
    status: 'cancelled',
    cancellation_reason: reason || 'Cancelled by admin'
  }, env);

  // If paid, initiate refund
  if (order.payment_status === 'paid' && order.payment_id) {
    const { createRefund } = await import('./payment.js');
    await createRefund(orderId, order.total, reason, env);
  }

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// GET ORDER STATS
// ═══════════════════════════════════════════════════════════════

export async function getOrderStats(period, env) {
  let dateFilter = '';
  
  switch (period) {
    case 'today':
      dateFilter = "created_at >= date('now')";
      break;
    case 'week':
      dateFilter = "created_at >= date('now', '-7 days')";
      break;
    case 'month':
      dateFilter = "created_at >= date('now', '-30 days')";
      break;
    default:
      dateFilter = '1=1';
  }

  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_orders,
      SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as revenue,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      AVG(total) as avg_order_value
    FROM orders WHERE ${dateFilter}
  `).first();

  return stats;
}

// ═══════════════════════════════════════════════════════════════
// APPLY DISCOUNT CODE
// ═══════════════════════════════════════════════════════════════

function applyDiscountCode(code, subtotal) {
  const codes = {
    'WELCOME10': { type: 'percent', value: 10, min: 299 },
    'FLAT50': { type: 'flat', value: 50, min: 499 },
    'KAAPAV20': { type: 'percent', value: 20, min: 999 },
    'VIP15': { type: 'percent', value: 15, min: 500 }
  };

  const discount = codes[code?.toUpperCase()];
  
  if (!discount) {
    return { valid: false, error: 'Invalid code' };
  }

  if (subtotal < discount.min) {
    return { valid: false, error: `Minimum order ₹${discount.min} required` };
  }

  const amount = discount.type === 'percent' 
    ? Math.round(subtotal * discount.value / 100)
    : discount.value;

  return { valid: true, amount, type: discount.type, value: discount.value };
}
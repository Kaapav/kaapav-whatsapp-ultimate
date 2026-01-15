/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - CUSTOMER SERVICE
 * ═══════════════════════════════════════════════════════════════
 * CRM and customer management
 * ═══════════════════════════════════════════════════════════════
 */

import { normalizeIN } from '../utils/sendMessage.js';

// ═══════════════════════════════════════════════════════════════
// GET CUSTOMER PROFILE
// ═══════════════════════════════════════════════════════════════

export async function getCustomerProfile(phone, env) {
  const normalizedPhone = normalizeIN(phone);

  try {
    // Get customer data
    const customer = await env.DB.prepare(`
      SELECT * FROM customers WHERE phone = ?
    `).bind(normalizedPhone).first();

    if (!customer) {
      return null;
    }

    // Get order history
    const { results: orders } = await env.DB.prepare(`
      SELECT order_id, status, payment_status, total, item_count, created_at
      FROM orders 
      WHERE phone = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).bind(normalizedPhone).all();

    // Get message stats
    const messageStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_messages,
        MAX(timestamp) as last_message_at
      FROM messages 
      WHERE phone = ?
    `).bind(normalizedPhone).first();

    // Get chat info
    const chat = await env.DB.prepare(`
      SELECT labels, notes, status, assigned_to, is_starred
      FROM chats 
      WHERE phone = ?
    `).bind(normalizedPhone).first();

    // Parse JSON fields
    const labels = chat?.labels ? JSON.parse(chat.labels) : [];
    const customerLabels = customer.labels ? JSON.parse(customer.labels) : [];

    return {
      ...customer,
      labels: [...new Set([...labels, ...customerLabels])],
      orders: orders || [],
      order_summary: {
        total_orders: customer.order_count || 0,
        total_spent: customer.total_spent || 0,
        average_order_value: customer.order_count > 0 
          ? Math.round(customer.total_spent / customer.order_count) 
          : 0,
        last_order_amount: customer.last_order_amount || 0
      },
      message_stats: {
        total: messageStats?.total_messages || 0,
        last_at: messageStats?.last_message_at
      },
      chat: {
        status: chat?.status || 'open',
        assigned_to: chat?.assigned_to,
        is_starred: chat?.is_starred || false,
        notes: chat?.notes
      }
    };

  } catch (error) {
    console.error('[Customer] Get profile error:', error.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE CUSTOMER
// ═══════════════════════════════════════════════════════════════

export async function updateCustomer(phone, data, env) {
  const normalizedPhone = normalizeIN(phone);

  const allowedFields = [
    'name', 'email', 'gender', 'birthday',
    'address_line1', 'address_line2', 'city', 'state', 'pincode',
    'alternate_phone', 'language', 'labels', 'notes', 'segment',
    'opted_in_marketing', 'is_blocked'
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
    return { success: false, error: 'No valid fields to update' };
  }

  updates.push('updated_at = datetime("now")');
  values.push(normalizedPhone);

  try {
    await env.DB.prepare(`
      UPDATE customers SET ${updates.join(', ')} WHERE phone = ?
    `).bind(...values).run();

    return { success: true };
  } catch (error) {
    console.error('[Customer] Update error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// ADD LABEL TO CUSTOMER
// ═══════════════════════════════════════════════════════════════

export async function addCustomerLabel(phone, label, env) {
  const normalizedPhone = normalizeIN(phone);

  try {
    // Add to customer
    await env.DB.prepare(`
      UPDATE customers SET 
        labels = json_insert(COALESCE(labels, '[]'), '$[#]', ?),
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(label, normalizedPhone).run();

    // Add to chat
    await env.DB.prepare(`
      UPDATE chats SET 
        labels = json_insert(COALESCE(labels, '[]'), '$[#]', ?),
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(label, normalizedPhone).run();

    return { success: true };
  } catch (error) {
    console.error('[Customer] Add label error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// REMOVE LABEL FROM CUSTOMER
// ═══════════════════════════════════════════════════════════════

export async function removeCustomerLabel(phone, label, env) {
  const normalizedPhone = normalizeIN(phone);

  try {
    // Get current labels
    const customer = await env.DB.prepare(`
      SELECT labels FROM customers WHERE phone = ?
    `).bind(normalizedPhone).first();

    if (customer?.labels) {
      const labels = JSON.parse(customer.labels);
      const filtered = labels.filter(l => l !== label);
      
      await env.DB.prepare(`
        UPDATE customers SET 
          labels = ?,
          updated_at = datetime('now')
        WHERE phone = ?
      `).bind(JSON.stringify(filtered), normalizedPhone).run();
    }

    // Same for chat
    const chat = await env.DB.prepare(`
      SELECT labels FROM chats WHERE phone = ?
    `).bind(normalizedPhone).first();

    if (chat?.labels) {
      const labels = JSON.parse(chat.labels);
      const filtered = labels.filter(l => l !== label);
      
      await env.DB.prepare(`
        UPDATE chats SET 
          labels = ?,
          updated_at = datetime('now')
        WHERE phone = ?
      `).bind(JSON.stringify(filtered), normalizedPhone).run();
    }

    return { success: true };
  } catch (error) {
    console.error('[Customer] Remove label error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// SEARCH CUSTOMERS
// ═══════════════════════════════════════════════════════════════

export async function searchCustomers(query, filters, env) {
  const {
    segment,
    label,
    min_orders,
    min_spent,
    last_seen_days,
    limit = 50,
    offset = 0
  } = filters || {};

  let sql = `
    SELECT c.*, 
      (SELECT COUNT(*) FROM orders WHERE phone = c.phone) as order_count_live,
      (SELECT MAX(created_at) FROM orders WHERE phone = c.phone) as last_order_at
    FROM customers c
    WHERE 1=1
  `;
  const params = [];

  // Text search
  if (query) {
    sql += ` AND (c.phone LIKE ? OR c.name LIKE ? OR c.email LIKE ?)`;
    const searchTerm = `%${query}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Segment filter
  if (segment) {
    sql += ` AND c.segment = ?`;
    params.push(segment);
  }

  // Label filter
  if (label) {
    sql += ` AND c.labels LIKE ?`;
    params.push(`%"${label}"%`);
  }

  // Order count filter
  if (min_orders) {
    sql += ` AND c.order_count >= ?`;
    params.push(min_orders);
  }

  // Spend filter
  if (min_spent) {
    sql += ` AND c.total_spent >= ?`;
    params.push(min_spent);
  }

  // Activity filter
  if (last_seen_days) {
    sql += ` AND c.last_seen >= datetime('now', '-${last_seen_days} days')`;
  }

  sql += ` ORDER BY c.last_seen DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    
    // Get total count
    let countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as count FROM')
                      .replace(/ORDER BY.*$/, '');
    const countParams = params.slice(0, -2); // Remove limit/offset
    const countResult = await env.DB.prepare(countSql).bind(...countParams).first();

    return {
      customers: results || [],
      total: countResult?.count || 0,
      limit,
      offset
    };
  } catch (error) {
    console.error('[Customer] Search error:', error.message);
    return { customers: [], total: 0, limit, offset };
  }
}

// ═══════════════════════════════════════════════════════════════
// GET CUSTOMER SEGMENTS
// ═══════════════════════════════════════════════════════════════

export async function getCustomerSegments(env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        segment,
        COUNT(*) as count,
        SUM(total_spent) as total_revenue,
        AVG(order_count) as avg_orders
      FROM customers
      WHERE segment IS NOT NULL
      GROUP BY segment
      ORDER BY count DESC
    `).all();

    return results || [];
  } catch (error) {
    console.error('[Customer] Segments error:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// GET ALL LABELS
// ═══════════════════════════════════════════════════════════════

export async function getAllLabels(env) {
  try {
    // Get labels from customers
    const { results: customerLabels } = await env.DB.prepare(`
      SELECT DISTINCT json_each.value as label
      FROM customers, json_each(customers.labels)
      WHERE customers.labels IS NOT NULL
    `).all();

    // Get labels from chats
    const { results: chatLabels } = await env.DB.prepare(`
      SELECT DISTINCT json_each.value as label
      FROM chats, json_each(chats.labels)
      WHERE chats.labels IS NOT NULL
    `).all();

    // Combine and deduplicate
    const allLabels = new Set([
      ...(customerLabels || []).map(r => r.label),
      ...(chatLabels || []).map(r => r.label)
    ]);

    return Array.from(allLabels).sort();
  } catch (error) {
    console.error('[Customer] Get labels error:', error.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// CALCULATE CUSTOMER LIFETIME VALUE
// ═══════════════════════════════════════════════════════════════

export async function calculateLifetimeValue(phone, env) {
  const normalizedPhone = normalizeIN(phone);

  try {
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as order_count,
        SUM(total) as total_spent,
        AVG(total) as avg_order_value,
        MIN(created_at) as first_order,
        MAX(created_at) as last_order,
        julianday('now') - julianday(MIN(created_at)) as customer_age_days
      FROM orders
      WHERE phone = ? AND payment_status = 'paid'
    `).bind(normalizedPhone).first();

    if (!stats || stats.order_count === 0) {
      return {
        lifetime_value: 0,
        predicted_annual_value: 0,
        order_frequency: 0
      };
    }

    // Calculate metrics
    const customerAgeDays = stats.customer_age_days || 1;
    const ordersPerDay = stats.order_count / customerAgeDays;
    const ordersPerYear = ordersPerDay * 365;
    const predictedAnnualValue = ordersPerYear * stats.avg_order_value;

    // Update customer record
    await env.DB.prepare(`
      UPDATE customers SET 
        lifetime_value = ?,
        average_order_value = ?,
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(stats.total_spent, stats.avg_order_value, normalizedPhone).run();

    return {
      lifetime_value: Math.round(stats.total_spent),
      predicted_annual_value: Math.round(predictedAnnualValue),
      order_frequency: Math.round(ordersPerYear * 10) / 10,
      avg_order_value: Math.round(stats.avg_order_value),
      customer_age_days: Math.round(customerAgeDays)
    };
  } catch (error) {
    console.error('[Customer] LTV error:', error.message);
    return { lifetime_value: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// MERGE CUSTOMERS (Duplicate handling)
// ═══════════════════════════════════════════════════════════════

export async function mergeCustomers(primaryPhone, secondaryPhone, env) {
  const primary = normalizeIN(primaryPhone);
  const secondary = normalizeIN(secondaryPhone);

  try {
    // Get both customer records
    const primaryCustomer = await env.DB.prepare(`
      SELECT * FROM customers WHERE phone = ?
    `).bind(primary).first();

    const secondaryCustomer = await env.DB.prepare(`
      SELECT * FROM customers WHERE phone = ?
    `).bind(secondary).first();

    if (!primaryCustomer || !secondaryCustomer) {
      return { success: false, error: 'One or both customers not found' };
    }

    // Merge stats
    const mergedStats = {
      message_count: (primaryCustomer.message_count || 0) + (secondaryCustomer.message_count || 0),
      order_count: (primaryCustomer.order_count || 0) + (secondaryCustomer.order_count || 0),
      total_spent: (primaryCustomer.total_spent || 0) + (secondaryCustomer.total_spent || 0)
    };

    // Update primary customer
    await env.DB.prepare(`
      UPDATE customers SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        alternate_phone = ?,
        message_count = ?,
        order_count = ?,
        total_spent = ?,
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(
      secondaryCustomer.name,
      secondaryCustomer.email,
      secondary,
      mergedStats.message_count,
      mergedStats.order_count,
      mergedStats.total_spent,
      primary
    ).run();

    // Update orders to point to primary
    await env.DB.prepare(`
      UPDATE orders SET phone = ? WHERE phone = ?
    `).bind(primary, secondary).run();

    // Update messages to point to primary
    await env.DB.prepare(`
      UPDATE messages SET phone = ? WHERE phone = ?
    `).bind(primary, secondary).run();

    // Delete secondary customer
    await env.DB.prepare(`
      DELETE FROM customers WHERE phone = ?
    `).bind(secondary).run();

    // Delete secondary chat
    await env.DB.prepare(`
      DELETE FROM chats WHERE phone = ?
    `).bind(secondary).run();

    return { success: true, merged_into: primary };
  } catch (error) {
    console.error('[Customer] Merge error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT CUSTOMERS
// ═══════════════════════════════════════════════════════════════

export async function exportCustomers(filters, env) {
  const searchResult = await searchCustomers(null, { ...filters, limit: 10000 }, env);
  
  // Format for CSV
  const headers = [
    'Phone', 'Name', 'Email', 'Segment', 'Labels',
    'Order Count', 'Total Spent', 'Avg Order Value',
    'First Seen', 'Last Seen', 'City', 'State', 'Pincode'
  ];

  const rows = searchResult.customers.map(c => [
    c.phone,
    c.name || '',
    c.email || '',
    c.segment || '',
    c.labels || '',
    c.order_count || 0,
    c.total_spent 
/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - BROADCAST SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Service layer for broadcast/campaign management
 * ═══════════════════════════════════════════════════════════════
 */

import { generateBroadcastId } from '../utils/helpers.js';
import { executeBroadcast, getBroadcastStats } from '../handlers/campaignHandler.js';

// ═══════════════════════════════════════════════════════════════
// CREATE BROADCAST
// ═══════════════════════════════════════════════════════════════

export async function createBroadcast(data, env) {
  const broadcastId = generateBroadcastId();

  const {
    name,
    description = '',
    message,
    message_type = 'text',
    template_name,
    template_params,
    media_url,
    buttons,
    target_type = 'all',
    target_labels,
    target_segment,
    target_phones,
    scheduled_at,
    send_rate = 20
  } = data;

  // Validate
  if (!name) {
    return { success: false, error: 'Name is required' };
  }

  if (message_type === 'text' && !message) {
    return { success: false, error: 'Message is required for text broadcasts' };
  }

  if (message_type === 'template' && !template_name) {
    return { success: false, error: 'Template name is required for template broadcasts' };
  }

  try {
    await env.DB.prepare(`
      INSERT INTO broadcasts (
        broadcast_id, name, description, message, message_type,
        template_name, template_params, media_url, buttons,
        target_type, target_labels, target_segment, target_phones,
        scheduled_at, send_rate, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      broadcastId,
      name,
      description,
      message || null,
      message_type,
      template_name || null,
      template_params ? JSON.stringify(template_params) : null,
      media_url || null,
      buttons ? JSON.stringify(buttons) : null,
      target_type,
      target_labels ? JSON.stringify(target_labels) : null,
      target_segment || null,
      target_phones ? JSON.stringify(target_phones) : null,
      scheduled_at || null,
      send_rate,
      scheduled_at ? 'scheduled' : 'draft'
    ).run();

    // Get estimated recipient count
    const estimatedCount = await getEstimatedRecipientCount(target_type, {
      target_labels,
      target_segment,
      target_phones
    }, env);

    return {
      success: true,
      broadcast_id: broadcastId,
      status: scheduled_at ? 'scheduled' : 'draft',
      estimated_recipients: estimatedCount
    };

  } catch (error) {
    console.error('[Broadcast] Create failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// GET BROADCASTS LIST
// ═══════════════════════════════════════════════════════════════

export async function getBroadcasts(filters, env) {
  const { status, limit = 50, offset = 0 } = filters || {};

  let query = `SELECT * FROM broadcasts WHERE 1=1`;
  const params = [];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  // Add stats to each broadcast
  const broadcastsWithStats = await Promise.all(
    (results || []).map(async (broadcast) => {
      const stats = await getQuickStats(broadcast.broadcast_id, env);
      return { ...broadcast, stats };
    })
  );

  return broadcastsWithStats;
}

// ═══════════════════════════════════════════════════════════════
// GET SINGLE BROADCAST WITH DETAILS
// ═══════════════════════════════════════════════════════════════

export async function getBroadcast(broadcastId, env) {
  return getBroadcastStats(broadcastId, env);
}

// ═══════════════════════════════════════════════════════════════
// UPDATE BROADCAST
// ═══════════════════════════════════════════════════════════════

export async function updateBroadcast(broadcastId, data, env) {
  const broadcast = await env.DB.prepare(`
    SELECT status FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();

  if (!broadcast) {
    return { success: false, error: 'Broadcast not found' };
  }

  if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
    return { success: false, error: 'Cannot update broadcast in current status' };
  }

  const allowedFields = [
    'name', 'description', 'message', 'message_type',
    'template_name', 'template_params', 'media_url', 'buttons',
    'target_type', 'target_labels', 'target_segment', 'target_phones',
    'scheduled_at', 'send_rate'
  ];

  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      
      // Stringify objects
      if (typeof value === 'object' && value !== null) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }
  }

  if (updates.length === 0) {
    return { success: false, error: 'No valid fields to update' };
  }

  // Update status based on scheduled_at
  if (data.scheduled_at) {
    updates.push('status = ?');
    values.push('scheduled');
  }

  updates.push('updated_at = datetime("now")');
  values.push(broadcastId);

  await env.DB.prepare(`
    UPDATE broadcasts SET ${updates.join(', ')} WHERE broadcast_id = ?
  `).bind(...values).run();

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// DELETE BROADCAST
// ═══════════════════════════════════════════════════════════════

export async function deleteBroadcast(broadcastId, env) {
  const broadcast = await env.DB.prepare(`
    SELECT status FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();

  if (!broadcast) {
    return { success: false, error: 'Broadcast not found' };
  }

  if (broadcast.status === 'sending') {
    return { success: false, error: 'Cannot delete broadcast while sending' };
  }

  // Delete recipients first
  await env.DB.prepare(`
    DELETE FROM broadcast_recipients WHERE broadcast_id = ?
  `).bind(broadcastId).run();

  // Delete broadcast
  await env.DB.prepare(`
    DELETE FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).run();

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// SEND BROADCAST NOW
// ═══════════════════════════════════════════════════════════════

export async function sendBroadcastNow(broadcastId, env, ctx) {
  const broadcast = await env.DB.prepare(`
    SELECT status FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();

  if (!broadcast) {
    return { success: false, error: 'Broadcast not found' };
  }

  if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
    return { success: false, error: `Cannot send broadcast in status: ${broadcast.status}` };
  }

  // Update to scheduled for immediate execution
  await env.DB.prepare(`
    UPDATE broadcasts SET status = 'scheduled', scheduled_at = datetime('now')
    WHERE broadcast_id = ?
  `).bind(broadcastId).run();

  // Execute in background
  if (ctx) {
    ctx.waitUntil(executeBroadcast(broadcastId, env));
  } else {
    executeBroadcast(broadcastId, env);
  }

  return { success: true, message: 'Broadcast started' };
}

// ═══════════════════════════════════════════════════════════════
// CANCEL BROADCAST
// ═══════════════════════════════════════════════════════════════

export async function cancelBroadcast(broadcastId, env) {
  const result = await env.DB.prepare(`
    UPDATE broadcasts SET 
      status = 'cancelled',
      updated_at = datetime('now')
    WHERE broadcast_id = ? AND status IN ('scheduled', 'sending')
  `).bind(broadcastId).run();

  if (result.meta.changes === 0) {
    return { success: false, error: 'Broadcast not found or cannot be cancelled' };
  }

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// GET RECIPIENT PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getRecipientPreview(targetType, targetData, env) {
  const count = await getEstimatedRecipientCount(targetType, targetData, env);
  
  // Get sample recipients
  let sampleQuery = '';
  const params = [];

  switch (targetType) {
    case 'all':
      sampleQuery = `
        SELECT phone, name FROM customers 
        WHERE opted_in_marketing = 1 AND is_blocked = 0
        LIMIT 10
      `;
      break;

    case 'segment':
      sampleQuery = `
        SELECT phone, name FROM customers 
        WHERE segment = ? AND opted_in_marketing = 1 AND is_blocked = 0
        LIMIT 10
      `;
      params.push(targetData.target_segment);
      break;

    case 'labels':
      const labels = targetData.target_labels || [];
      if (labels.length > 0) {
        const placeholders = labels.map(() => '?').join(',');
        sampleQuery = `
          SELECT DISTINCT c.phone, c.name FROM customers c
          JOIN chats ch ON c.phone = ch.phone
          WHERE c.opted_in_marketing = 1 AND c.is_blocked = 0
          AND EXISTS (
            SELECT 1 FROM json_each(ch.labels) 
            WHERE json_each.value IN (${placeholders})
          )
          LIMIT 10
        `;
        params.push(...labels);
      }
      break;

    default:
      sampleQuery = `SELECT phone, name FROM customers LIMIT 0`;
  }

  const { results: samples } = await env.DB.prepare(sampleQuery).bind(...params).all();

  return {
    estimated_count: count,
    samples: samples || []
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getEstimatedRecipientCount(targetType, targetData, env) {
  let query = '';
  const params = [];

  switch (targetType) {
    case 'all':
      query = `SELECT COUNT(*) as count FROM customers WHERE opted_in_marketing = 1 AND is_blocked = 0`;
      break;

    case 'segment':
      query = `SELECT COUNT(*) as count FROM customers WHERE segment = ? AND opted_in_marketing = 1 AND is_blocked = 0`;
      params.push(targetData.target_segment);
      break;

    case 'labels':
      const labels = targetData.target_labels || [];
      if (labels.length === 0) return 0;
      
      const placeholders = labels.map(() => '?').join(',');
      query = `
        SELECT COUNT(DISTINCT c.phone) as count FROM customers c
        JOIN chats ch ON c.phone = ch.phone
        WHERE c.opted_in_marketing = 1 AND c.is_blocked = 0
        AND EXISTS (
          SELECT 1 FROM json_each(ch.labels) 
          WHERE json_each.value IN (${placeholders})
        )
      `;
      params.push(...labels);
      break;

    case 'custom':
      const phones = targetData.target_phones || [];
      return phones.length;

    default:
      return 0;
  }

  const result = await env.DB.prepare(query).bind(...params).first();
  return result?.count || 0;
}

async function getQuickStats(broadcastId, env) {
  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM broadcast_recipients
    WHERE broadcast_id = ?
  `).bind(broadcastId).first();

  return {
    total: stats?.total || 0,
    sent: stats?.sent || 0,
    delivered: stats?.delivered || 0,
    failed: stats?.failed || 0
  };
}

// ═══════════════════════════════════════════════════════════════
// BROADCAST TEMPLATES (PRE-BUILT CAMPAIGNS)
// ═══════════════════════════════════════════════════════════════

export const BROADCAST_TEMPLATES = {
  welcome_back: {
    name: 'Welcome Back',
    message: `👋 We miss you at KAAPAV!\n\n✨ Come back and check out our new arrivals!\n🎉 Use code COMEBACK10 for 10% OFF\n\n💎 Shop now: kaapav.com`,
    target_type: 'inactive',
    message_type: 'text'
  },
  
  flash_sale: {
    name: 'Flash Sale',
    message: `⚡ FLASH SALE ⚡\n\n🔥 Flat 50% OFF for next 24 hours!\n🛍️ Limited stock available\n\n👉 Shop now: kaapav.com\n\n💎 KAAPAV - Crafted Elegance`,
    target_type: 'all',
    message_type: 'text'
  },
  
  new_arrivals: {
    name: 'New Arrivals',
    message: `✨ NEW ARRIVALS ✨\n\nFresh designs just dropped!\n\n🆕 Earrings, Necklaces, Bangles & more\n📱 Check them out in our catalog\n\nBe the first to own these beauties! 💎`,
    target_type: 'all',
    message_type: 'text'
  },
  
  vip_exclusive: {
    name: 'VIP Exclusive',
    message: `👑 EXCLUSIVE FOR YOU 👑\n\nAs our valued VIP customer, enjoy:\n\n🎁 Extra 15% OFF\n🚚 FREE Express Shipping\n💎 Early access to new designs\n\nUse code: VIP15\n\nThank you for being part of the KAAPAV family! ✨`,
    target_type: 'segment',
    target_segment: 'vip',
    message_type: 'text'
  },
  
  cart_reminder: {
    name: 'Cart Reminder',
    message: `🛒 Your cart misses you!\n\nYou left some beautiful pieces behind.\n\n💰 Complete your order now\n🚚 FREE shipping above ₹498\n\n👉 Reply 'cart' to continue`,
    target_type: 'labels',
    target_labels: ['abandoned_cart'],
    message_type: 'text'
  }
};

export function getBroadcastTemplates() {
  return Object.entries(BROADCAST_TEMPLATES).map(([key, template]) => ({
    id: key,
    ...template
  }));
}
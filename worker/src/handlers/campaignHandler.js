/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - CAMPAIGN/BROADCAST HANDLER
 * ═══════════════════════════════════════════════════════════════
 * Broadcast message campaigns
 * ═══════════════════════════════════════════════════════════════
 */

import { sendText, sendTemplate, sendImage, normalizeIN } from '../utils/sendMessage.js';
import { delay, chunk } from '../utils/helpers.js';

// ═══════════════════════════════════════════════════════════════
// EXECUTE BROADCAST
// ═══════════════════════════════════════════════════════════════

export async function executeBroadcast(broadcastId, env) {
  console.log(`[Broadcast] 📢 Starting: ${broadcastId}`);

  try {
    // Get broadcast details
    const broadcast = await env.DB.prepare(`
      SELECT * FROM broadcasts WHERE broadcast_id = ?
    `).bind(broadcastId).first();

    if (!broadcast) {
      console.error('[Broadcast] Not found:', broadcastId);
      return { success: false, error: 'Broadcast not found' };
    }

    if (broadcast.status !== 'scheduled' && broadcast.status !== 'draft') {
      console.log('[Broadcast] Invalid status:', broadcast.status);
      return { success: false, error: `Invalid status: ${broadcast.status}` };
    }

    // Update status to sending
    await env.DB.prepare(`
      UPDATE broadcasts SET status = 'sending', started_at = datetime('now')
      WHERE broadcast_id = ?
    `).bind(broadcastId).run();

    // Get target recipients
    const recipients = await getRecipients(broadcast, env);
    
    if (recipients.length === 0) {
      await env.DB.prepare(`
        UPDATE broadcasts SET status = 'completed', completed_at = datetime('now')
        WHERE broadcast_id = ?
      `).bind(broadcastId).run();
      
      return { success: true, sent: 0, message: 'No recipients' };
    }

    console.log(`[Broadcast] 📢 Sending to ${recipients.length} recipients`);

    // Update target count
    await env.DB.prepare(`
      UPDATE broadcasts SET target_count = ? WHERE broadcast_id = ?
    `).bind(recipients.length, broadcastId).run();

    // Process in batches
    const batchSize = 20;
    const sendRate = broadcast.send_rate || 20; // messages per minute
    const delayBetween = Math.floor(60000 / sendRate);
    
    let sentCount = 0;
    let failedCount = 0;

    const batches = chunk(recipients, batchSize);

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(async (phone) => {
          try {
            await sendBroadcastMessage(phone, broadcast, env);
            
            // Record success
            await env.DB.prepare(`
              INSERT INTO broadcast_recipients (broadcast_id, phone, status, sent_at)
              VALUES (?, ?, 'sent', datetime('now'))
            `).bind(broadcastId, phone).run();
            
            return { phone, success: true };
          } catch (error) {
            // Record failure
            await env.DB.prepare(`
              INSERT INTO broadcast_recipients (broadcast_id, phone, status, error_message)
              VALUES (?, ?, 'failed', ?)
            `).bind(broadcastId, phone, error.message).run();
            
            return { phone, success: false, error: error.message };
          }
        })
      );

      // Count results
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      });

      // Update progress
      await env.DB.prepare(`
        UPDATE broadcasts SET sent_count = ?, failed_count = ?
        WHERE broadcast_id = ?
      `).bind(sentCount, failedCount, broadcastId).run();

      // Rate limiting delay
      await delay(delayBetween);
    }

    // Mark as completed
    await env.DB.prepare(`
      UPDATE broadcasts SET 
        status = 'completed',
        completed_at = datetime('now'),
        sent_count = ?,
        failed_count = ?
      WHERE broadcast_id = ?
    `).bind(sentCount, failedCount, broadcastId).run();

    console.log(`[Broadcast] ✅ Completed: ${sentCount} sent, ${failedCount} failed`);

    return {
      success: true,
      broadcastId,
      sent: sentCount,
      failed: failedCount,
      total: recipients.length
    };

  } catch (error) {
    console.error('[Broadcast] ❌ Error:', error.message);

    // Mark as failed
    await env.DB.prepare(`
      UPDATE broadcasts SET status = 'failed' WHERE broadcast_id = ?
    `).bind(broadcastId).run();

    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// GET RECIPIENTS BASED ON TARGETING
// ═══════════════════════════════════════════════════════════════

async function getRecipients(broadcast, env) {
  let query = '';
  const params = [];

  switch (broadcast.target_type) {
    case 'all':
      query = `
        SELECT DISTINCT phone FROM customers 
        WHERE opted_in_marketing = 1 AND is_blocked = 0
      `;
      break;

    case 'labels':
      const labels = JSON.parse(broadcast.target_labels || '[]');
      if (labels.length === 0) return [];
      
      const labelPlaceholders = labels.map(() => '?').join(',');
      query = `
        SELECT DISTINCT c.phone FROM customers c
        JOIN chats ch ON c.phone = ch.phone
        WHERE c.opted_in_marketing = 1 AND c.is_blocked = 0
        AND EXISTS (
          SELECT 1 FROM json_each(ch.labels) 
          WHERE json_each.value IN (${labelPlaceholders})
        )
      `;
      params.push(...labels);
      break;

    case 'segment':
      query = `
        SELECT DISTINCT phone FROM customers 
        WHERE segment = ? AND opted_in_marketing = 1 AND is_blocked = 0
      `;
      params.push(broadcast.target_segment);
      break;

    case 'custom':
      const phones = JSON.parse(broadcast.target_phones || '[]');
      return phones.map(p => normalizeIN(p));

    case 'recent_customers':
      query = `
        SELECT DISTINCT phone FROM customers 
        WHERE last_purchase >= datetime('now', '-30 days')
        AND opted_in_marketing = 1 AND is_blocked = 0
      `;
      break;

    case 'inactive':
      query = `
        SELECT DISTINCT phone FROM customers 
        WHERE last_seen < datetime('now', '-30 days')
        AND opted_in_marketing = 1 AND is_blocked = 0
      `;
      break;

    case 'high_value':
      query = `
        SELECT DISTINCT phone FROM customers 
        WHERE total_spent >= 1000
        AND opted_in_marketing = 1 AND is_blocked = 0
      `;
      break;

    default:
      return [];
  }

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results?.map(r => r.phone) || [];
}

// ═══════════════════════════════════════════════════════════════
// SEND BROADCAST MESSAGE
// ═══════════════════════════════════════════════════════════════

async function sendBroadcastMessage(phone, broadcast, env) {
  const normalizedPhone = normalizeIN(phone);

  switch (broadcast.message_type) {
    case 'template':
      const components = broadcast.template_params 
        ? JSON.parse(broadcast.template_params) 
        : [];
      return sendTemplate(normalizedPhone, broadcast.template_name, 'en', components, env);

    case 'image':
      return sendImage(normalizedPhone, broadcast.media_url, broadcast.message, env);

    case 'text':
    default:
      return sendText(normalizedPhone, broadcast.message, env);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULE BROADCAST
// ═══════════════════════════════════════════════════════════════

export async function scheduleBroadcast(broadcastData, env) {
  const { generateBroadcastId } = await import('../utils/helpers.js');
  const broadcastId = generateBroadcastId();

  const {
    name,
    message,
    message_type = 'text',
    template_name,
    template_params,
    media_url,
    target_type = 'all',
    target_labels,
    target_segment,
    target_phones,
    scheduled_at,
    send_rate = 20
  } = broadcastData;

  await env.DB.prepare(`
    INSERT INTO broadcasts (
      broadcast_id, name, message, message_type,
      template_name, template_params, media_url,
      target_type, target_labels, target_segment, target_phones,
      scheduled_at, send_rate, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    broadcastId,
    name,
    message,
    message_type,
    template_name || null,
    template_params ? JSON.stringify(template_params) : null,
    media_url || null,
    target_type,
    target_labels ? JSON.stringify(target_labels) : null,
    target_segment || null,
    target_phones ? JSON.stringify(target_phones) : null,
    scheduled_at || null,
    send_rate,
    scheduled_at ? 'scheduled' : 'draft'
  ).run();

  return { success: true, broadcast_id: broadcastId };
}

// ═══════════════════════════════════════════════════════════════
// GET BROADCAST STATS
// ═══════════════════════════════════════════════════════════════

export async function getBroadcastStats(broadcastId, env) {
  const broadcast = await env.DB.prepare(`
    SELECT * FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();

  if (!broadcast) {
    return null;
  }

  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM broadcast_recipients
    WHERE broadcast_id = ?
  `).bind(broadcastId).first();

  return {
    ...broadcast,
    stats: {
      total: stats?.total || 0,
      sent: stats?.sent || 0,
      delivered: stats?.delivered || 0,
      read: stats?.read || 0,
      failed: stats?.failed || 0,
      deliveryRate: stats?.total > 0 ? ((stats?.delivered || 0) / stats.total * 100).toFixed(1) : 0,
      readRate: stats?.delivered > 0 ? ((stats?.read || 0) / stats.delivered * 100).toFixed(1) : 0
    }
  };
}
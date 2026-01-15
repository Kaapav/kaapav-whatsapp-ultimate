/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - CAMPAIGN SCHEDULER
 * ═══════════════════════════════════════════════════════════════
 * Scheduled campaign execution
 * ═══════════════════════════════════════════════════════════════
 */

import { executeBroadcast } from '../handlers/campaignHandler.js';

// ═══════════════════════════════════════════════════════════════
// CHECK & EXECUTE SCHEDULED CAMPAIGNS
// ═══════════════════════════════════════════════════════════════

export async function checkScheduledCampaigns(env) {
  console.log('[Campaigns] 📢 Checking scheduled campaigns...');

  try {
    // Get campaigns due for execution
    const { results: dueCampaigns } = await env.DB.prepare(`
      SELECT broadcast_id, name
      FROM broadcasts 
      WHERE status = 'scheduled' 
        AND scheduled_at <= datetime('now')
      ORDER BY scheduled_at ASC
      LIMIT 5
    `).all();

    if (!dueCampaigns || dueCampaigns.length === 0) {
      console.log('[Campaigns] No campaigns due');
      return { executed: 0 };
    }

    console.log(`[Campaigns] Found ${dueCampaigns.length} campaigns to execute`);

    let executed = 0;
    const results = [];

    for (const campaign of dueCampaigns) {
      console.log(`[Campaigns] Executing: ${campaign.name} (${campaign.broadcast_id})`);
      
      const result = await executeBroadcast(campaign.broadcast_id, env);
      results.push({
        broadcast_id: campaign.broadcast_id,
        name: campaign.name,
        ...result
      });

      if (result.success) {
        executed++;
      }
    }

    return { executed, results };

  } catch (error) {
    console.error('[Campaigns] Scheduler error:', error.message);
    return { error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTO-GENERATE CAMPAIGNS
// ═══════════════════════════════════════════════════════════════

export async function generateAutoCampaigns(env) {
  console.log('[Campaigns] 🤖 Checking auto-campaigns...');

  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayOfMonth = today.getDate();

    // Weekly Flash Sale (Every Saturday)
    if (dayOfWeek === 6) {
      await createAutoCampaign('weekly_flash_sale', {
        name: `Flash Sale - ${today.toLocaleDateString()}`,
        message: `⚡ *WEEKEND FLASH SALE* ⚡\n\n` +
          `🔥 Flat 40% OFF on select items!\n` +
          `⏰ This weekend only\n\n` +
          `🛍️ Shop now: kaapav.com\n\n` +
          `Use code: FLASH40`,
        target_type: 'all',
        scheduled_at: getScheduledTime(10, 0) // 10 AM
      }, env);
    }

    // Monthly VIP Campaign (1st of month)
    if (dayOfMonth === 1) {
      await createAutoCampaign('monthly_vip', {
        name: `VIP Exclusive - ${today.toLocaleDateString('en', { month: 'long' })}`,
        message: `👑 *VIP EXCLUSIVE* 👑\n\n` +
          `As our valued VIP customer:\n\n` +
          `🎁 Extra 20% OFF this month\n` +
          `🚚 FREE Express Shipping\n` +
          `💎 Early access to new designs\n\n` +
          `Use code: VIP20`,
        target_type: 'segment',
        target_segment: 'vip',
        scheduled_at: getScheduledTime(11, 0) // 11 AM
      }, env);
    }

    // Re-engagement (Every 15th)
    if (dayOfMonth === 15) {
      await createAutoCampaign('monthly_reengagement', {
        name: `We Miss You - ${today.toLocaleDateString('en', { month: 'long' })}`,
        message: `👋 *We Miss You!*\n\n` +
          `It's been a while since your last visit.\n\n` +
          `Come back and enjoy:\n` +
          `🎉 15% OFF your next order\n` +
          `✨ Lots of new arrivals!\n\n` +
          `Use code: COMEBACK15`,
        target_type: 'inactive',
        scheduled_at: getScheduledTime(14, 0) // 2 PM
      }, env);
    }

    return { success: true };

  } catch (error) {
    console.error('[Campaigns] Auto-generate error:', error.message);
    return { error: error.message };
  }
}

async function createAutoCampaign(campaignKey, data, env) {
  // Check if already created today
  const existing = await env.DB.prepare(`
    SELECT broadcast_id FROM broadcasts 
    WHERE name LIKE ? AND created_at >= date('now')
  `).bind(`%${campaignKey}%`).first();

  if (existing) {
    console.log(`[Campaigns] ${campaignKey} already exists today`);
    return;
  }

  const { scheduleBroadcast } = await import('../handlers/campaignHandler.js');
  const result = await scheduleBroadcast(data, env);
  
  console.log(`[Campaigns] Created auto-campaign: ${campaignKey}`, result);
}

function getScheduledTime(hours, minutes) {
  const date = new Date();
  // Convert to IST (UTC+5:30)
  date.setUTCHours(hours - 5, minutes - 30, 0, 0);
  return date.toISOString();
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN ANALYTICS
// ═══════════════════════════════════════════════════════════════

export async function updateCampaignStats(env) {
  console.log('[Campaigns] 📊 Updating campaign stats...');

  try {
    // Get recent completed broadcasts
    const { results: recentBroadcasts } = await env.DB.prepare(`
      SELECT broadcast_id FROM broadcasts 
      WHERE status = 'completed' 
        AND completed_at >= datetime('now', '-24 hours')
    `).all();

    for (const broadcast of recentBroadcasts || []) {
      // Update delivery stats from recipient table
      const stats = await env.DB.prepare(`
        SELECT 
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count
        FROM broadcast_recipients
        WHERE broadcast_id = ?
      `).bind(broadcast.broadcast_id).first();

      await env.DB.prepare(`
        UPDATE broadcasts SET 
          delivered_count = ?,
          read_count = ?
        WHERE broadcast_id = ?
      `).bind(
        stats?.delivered || 0,
        stats?.read_count || 0,
        broadcast.broadcast_id
      ).run();
    }

    return { updated: recentBroadcasts?.length || 0 };

  } catch (error) {
    console.error('[Campaigns] Stats update error:', error.message);
    return { error: error.message };
  }
}
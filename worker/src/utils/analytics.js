/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - ANALYTICS TRACKING
 * ═══════════════════════════════════════════════════════════════
 */

export async function trackEvent(eventType, phone, data = {}, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, timestamp)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(eventType, data.event_name || eventType, phone, JSON.stringify(data)).run();
  } catch (error) {
    console.warn('[Analytics] Track failed:', error.message);
  }
}

export async function trackMessage(direction, phone, messageType, env) {
  return trackEvent(`message_${direction}`, phone, { type: messageType }, env);
}

export async function trackOrder(event, orderId, phone, data, env) {
  return trackEvent('order', phone, { event_name: event, order_id: orderId, ...data }, env);
}

export async function trackButtonClick(buttonId, phone, env) {
  return trackEvent('button_click', phone, { button_id: buttonId }, env);
}

export async function getDailyMetrics(env, date = 'today') {
  const dateFilter = date === 'today' ? "date(timestamp) = date('now')" : `date(timestamp) = '${date}'`;

  try {
    const { results } = await env.DB.prepare(`
      SELECT event_type, COUNT(*) as count, COUNT(DISTINCT phone) as unique_users
      FROM analytics WHERE ${dateFilter} GROUP BY event_type
    `).all();
    return results;
  } catch (error) {
    console.error('[Analytics] getDailyMetrics failed:', error.message);
    return [];
  }
}

export async function getPopularButtons(env, days = 7) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT json_extract(data, '$.button_id') as button_id, COUNT(*) as click_count
      FROM analytics WHERE event_type = 'button_click' AND timestamp >= datetime('now', '-${days} days')
      GROUP BY json_extract(data, '$.button_id') ORDER BY click_count DESC LIMIT 10
    `).all();
    return results;
  } catch (error) {
    console.error('[Analytics] getPopularButtons failed:', error.message);
    return [];
  }
}

export async function getEngagementScore(phone, env) {
  try {
    const stats = await env.DB.prepare(`
      SELECT COUNT(*) as total_events, COUNT(DISTINCT date(timestamp)) as active_days,
        SUM(CASE WHEN event_type = 'order' THEN 1 ELSE 0 END) as orders,
        SUM(CASE WHEN event_type = 'button_click' THEN 1 ELSE 0 END) as interactions
      FROM analytics WHERE phone = ? AND timestamp >= datetime('now', '-30 days')
    `).bind(phone).first();

    let score = 0;
    score += Math.min(stats.total_events / 50, 30);
    score += Math.min(stats.active_days * 2, 20);
    score += Math.min(stats.orders * 10, 30);
    score += Math.min(stats.interactions / 10, 20);
    return Math.round(score);
  } catch (error) {
    console.error('[Analytics] getEngagementScore failed:', error.message);
    return 0;
  }
}
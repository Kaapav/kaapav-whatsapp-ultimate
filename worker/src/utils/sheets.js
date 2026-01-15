/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - GOOGLE SHEETS INTEGRATION
 * ═══════════════════════════════════════════════════════════════
 */

export async function logToSheets(type, phone, category, content, env) {
  if (!env.GOOGLE_SHEETS_API_KEY || !env.GOOGLE_SHEET_ID) return;

  try {
    const timestamp = new Date().toISOString();
    const values = [[timestamp, type, phone, category, content]];
    const sheetTab = env.GOOGLE_SHEET_TAB || 'WhatsAppLogs';

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${sheetTab}!A:E:append?valueInputOption=RAW&key=${env.GOOGLE_SHEETS_API_KEY}`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });

    console.log('[Sheets] ✅ Logged:', type, phone);
  } catch (error) {
    console.warn('[Sheets] ❌ Log failed:', error.message);
  }
}

export async function logOrderToSheets(order, env) {
  if (!env.GOOGLE_SHEETS_API_KEY || !env.GOOGLE_SHEET_ID) return;

  try {
    const values = [[
      new Date().toISOString(),
      order.order_id,
      order.phone,
      order.customer_name,
      order.items,
      order.total,
      order.status,
      order.shipping_address,
      order.shipping_pincode
    ]];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/Orders!A:I:append?valueInputOption=RAW&key=${env.GOOGLE_SHEETS_API_KEY}`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });

    console.log('[Sheets] ✅ Order logged:', order.order_id);
  } catch (error) {
    console.warn('[Sheets] ❌ Order log failed:', error.message);
  }
}

export async function getFromSheets(range, env) {
  if (!env.GOOGLE_SHEETS_API_KEY || !env.GOOGLE_SHEET_ID) return null;

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/${range}?key=${env.GOOGLE_SHEETS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.warn('[Sheets] ❌ Get failed:', error.message);
    return null;
  }
}
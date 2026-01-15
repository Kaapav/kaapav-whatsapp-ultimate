/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP ULTIMATE - MAIN ENTRY POINT
 * ═══════════════════════════════════════════════════════════════
 * Complete WhatsApp Business Solution
 * Version: 2.1.0 (Enhanced)
 * 
 * ENHANCEMENTS:
 * ✅ Authentication middleware
 * ✅ Webhook signature verification
 * ✅ Rate limiting
 * ✅ Input validation & sanitization
 * ✅ Better error handling
 * ✅ Request logging
 * ✅ Missing CRUD endpoints
 * 
 * UNCHANGED:
 * ✅ All original routes
 * ✅ All original logic
 * ✅ All original structure
 * ═══════════════════════════════════════════════════════════════
 */

import { handleWebhookVerification, handleWebhookMessage } from './handlers/webhook.js';
import { handleScheduledTasks } from './cron/scheduled.js';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const VERSION = '2.1.0';
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB
const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 100; // requests per window

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize Indian phone number
 */
function normalizeIN(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  cleaned = cleaned.replace(/^0+/, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Sanitize string input
 */
function sanitize(input, maxLength = 1000) {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return String(input);
  return input.trim().slice(0, maxLength);
}

/**
 * Validate phone number
 */
function validatePhone(phone) {
  if (!phone) return false;
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Validate email
 */
function validateEmail(email) {
  if (!email) return true; // Optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Safe JSON parse
 */
function safeParseJSON(str, fallback = null) {
  if (!str) return fallback;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Generate Order ID
 */
function generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `KAA-${timestamp}-${random}`;
}

/**
 * Generate Broadcast ID
 */
function generateBroadcastId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BC-${timestamp}-${random}`;
}

// ═══════════════════════════════════════════════════════════════
// SECURITY FUNCTIONS (ENHANCED)
// ═══════════════════════════════════════════════════════════════

/**
 * Verify webhook signature from WhatsApp
 */
async function verifyWebhookSignature(body, signature, secret) {
  if (!signature || !signature.startsWith('sha256=')) return false;
  if (!secret) return true; // Skip if no secret configured
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSig = 'sha256=' + Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Timing-safe comparison
    if (signature.length !== expectedSig.length) return false;
    let match = true;
    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== expectedSig[i]) match = false;
    }
    return match;
  } catch (error) {
    console.error('[Security] Signature verification error:', error.message);
    return false;
  }
}

/**
 * Verify API authentication token
 */
async function verifyAuthToken(token, env) {
  if (!token) return { valid: false };
  
  try {
    // Option 1: Simple API key check
    if (env.API_SECRET_KEY && token === env.API_SECRET_KEY) {
      return { valid: true, type: 'api_key', role: 'admin' };
    }
    
    // Option 2: Database session check
    const session = await env.DB.prepare(`
      SELECT s.*, u.role, u.name as user_name 
      FROM sessions s
      LEFT JOIN users u ON s.user_id = u.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now') AND s.is_active = 1
    `).bind(token).first();
    
    if (session) {
      // Update last used
      await env.DB.prepare(`
        UPDATE sessions SET last_used_at = datetime('now') WHERE token = ?
      `).bind(token).run().catch(() => {});
      
      return { 
        valid: true, 
        type: 'session', 
        userId: session.user_id,
        role: session.role || 'agent',
        userName: session.user_name
      };
    }
    
    return { valid: false };
  } catch (error) {
    console.error('[Auth] Token verification error:', error.message);
    return { valid: false };
  }
}

/**
 * Check rate limit
 */
async function checkRateLimit(identifier, env, limit = RATE_LIMIT_MAX, windowSeconds = RATE_LIMIT_WINDOW) {
  if (!env.KV) return { allowed: true, remaining: limit };
  
  try {
    const key = `ratelimit:${identifier}`;
    const current = await env.KV.get(key);
    const count = current ? parseInt(current) : 0;
    
    if (count >= limit) {
      return { allowed: false, remaining: 0, resetIn: windowSeconds };
    }
    
    await env.KV.put(key, String(count + 1), { expirationTtl: windowSeconds });
    return { allowed: true, remaining: limit - count - 1, resetIn: windowSeconds };
  } catch (error) {
    console.warn('[RateLimit] Error:', error.message);
    return { allowed: true, remaining: limit }; // Allow on error
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════

export default {
  /**
   * Main fetch handler for all HTTP requests
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const startTime = Date.now();

    // ─────────────────────────────────────────────────────────────
    // CORS Headers (YOUR ORIGINAL + ENHANCED)
    // ─────────────────────────────────────────────────────────────
    const allowedOrigins = env.ALLOWED_ORIGINS 
      ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : ['*'];
    
    const origin = request.headers.get('Origin') || '';
    const isAllowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin);

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin ? (origin || '*') : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight (YOUR ORIGINAL)
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Log request (YOUR ORIGINAL + ENHANCED)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    console.log(`[${method}] ${path} - IP: ${clientIP}`);

    try {
      // ═══════════════════════════════════════════════════════════
      // WEBHOOK ROUTES (YOUR ORIGINAL)
      // ═══════════════════════════════════════════════════════════

      // Webhook verification (GET /webhook)
      if (path === '/webhook' && method === 'GET') {
        return handleWebhookVerification(request, env);
      }

      // Webhook messages (POST /webhook) - ENHANCED with signature verification
      if (path === '/webhook' && method === 'POST') {
        const bodyText = await request.text();
        
        // Verify signature (ENHANCED)
        if (env.WHATSAPP_APP_SECRET) {
          const signature = request.headers.get('x-hub-signature-256');
          const isValid = await verifyWebhookSignature(bodyText, signature, env.WHATSAPP_APP_SECRET);
          
          if (!isValid) {
            console.error('[Webhook] ❌ Invalid signature from:', clientIP);
            return new Response('Invalid signature', { status: 403 });
          }
        }
        
        try {
          const body = JSON.parse(bodyText);
          ctx.waitUntil(handleWebhookMessage(body, env));
        } catch (parseError) {
          console.error('[Webhook] JSON parse error:', parseError.message);
          return new Response('Invalid JSON', { status: 400 });
        }
        
        return new Response('OK', { status: 200 });
      }

      // ═══════════════════════════════════════════════════════════
      // HEALTH & INFO ROUTES (YOUR ORIGINAL + ENHANCED)
      // ═══════════════════════════════════════════════════════════

      if (path === '/' || path === '/health') {
        return Response.json({
          status: 'ok',
          service: 'KAAPAV WhatsApp Ultimate',
          version: VERSION,
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      }

      // ═══════════════════════════════════════════════════════════
      // RATE LIMITING FOR API ROUTES (ENHANCED)
      // ═══════════════════════════════════════════════════════════

      if (path.startsWith('/api/')) {
        const rateLimit = await checkRateLimit(clientIP, env);
        
        if (!rateLimit.allowed) {
          return Response.json(
            { 
              error: 'Too Many Requests', 
              message: 'Rate limit exceeded. Please try again later.',
              retryAfter: rateLimit.resetIn
            },
            { 
              status: 429, 
              headers: { 
                ...corsHeaders, 
                'Retry-After': String(rateLimit.resetIn),
                'X-RateLimit-Remaining': '0'
              } 
            }
          );
        }
      }

      // ═══════════════════════════════════════════════════════════
      // AUTHENTICATION FOR API ROUTES (ENHANCED)
      // ═══════════════════════════════════════════════════════════

      let authContext = null;

      if (path.startsWith('/api/')) {
        const authHeader = request.headers.get('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return Response.json(
            { error: 'Unauthorized', message: 'Missing authorization token' },
            { status: 401, headers: corsHeaders }
          );
        }
        
        const token = authHeader.replace('Bearer ', '');
        authContext = await verifyAuthToken(token, env);
        
        if (!authContext.valid) {
          return Response.json(
            { error: 'Unauthorized', message: 'Invalid or expired token' },
            { status: 401, headers: corsHeaders }
          );
        }
      }

      // ═══════════════════════════════════════════════════════════
      // CHAT API ROUTES (YOUR ORIGINAL)
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

      // Delete/Archive chat (ENHANCED)
      if (path.match(/^\/api\/chats\/\d+$/) && method === 'DELETE') {
        const phone = path.split('/').pop();
        return await archiveChat(phone, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // MESSAGE API ROUTES (YOUR ORIGINAL)
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

      // Send media message (ENHANCED)
      if (path === '/api/messages/media' && method === 'POST') {
        const data = await request.json();
        return await sendMediaAPI(data, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // CUSTOMER API ROUTES (YOUR ORIGINAL)
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

      // Create customer (ENHANCED)
      if (path === '/api/customers' && method === 'POST') {
        const data = await request.json();
        return await createCustomer(data, env, corsHeaders);
      }

      // Update customer
      if (path.match(/^\/api\/customers\/\d+$/) && method === 'PUT') {
        const phone = path.split('/').pop();
        const data = await request.json();
        return await updateCustomer(phone, data, env, corsHeaders);
      }

      // Delete customer (ENHANCED)
      if (path.match(/^\/api\/customers\/\d+$/) && method === 'DELETE') {
        const phone = path.split('/').pop();
        return await deleteCustomer(phone, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // ORDER API ROUTES (YOUR ORIGINAL)
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

      // Cancel order (ENHANCED)
      if (path.match(/^\/api\/orders\/[A-Z0-9-]+$/i) && method === 'DELETE') {
        const orderId = path.split('/').pop();
        return await cancelOrder(orderId, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // PRODUCT/CATALOG API ROUTES (YOUR ORIGINAL + ENHANCED)
      // ═══════════════════════════════════════════════════════════

      // Get products
      if (path === '/api/products' && method === 'GET') {
        return await getProducts(env, url, corsHeaders);
      }

      // Get single product (ENHANCED)
      if (path.match(/^\/api\/products\/\d+$/) && method === 'GET') {
        const id = path.split('/').pop();
        return await getProduct(id, env, corsHeaders);
      }

      // Create product (ENHANCED)
      if (path === '/api/products' && method === 'POST') {
        const data = await request.json();
        return await createProduct(data, env, corsHeaders);
      }

      // Update product (ENHANCED)
      if (path.match(/^\/api\/products\/\d+$/) && method === 'PUT') {
        const id = path.split('/').pop();
        const data = await request.json();
        return await updateProduct(id, data, env, corsHeaders);
      }

      // Delete product (ENHANCED)
      if (path.match(/^\/api\/products\/\d+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        return await deleteProduct(id, env, corsHeaders);
      }

      // Get categories (ENHANCED)
      if (path === '/api/products/categories' && method === 'GET') {
        return await getCategories(env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // QUICK REPLIES API ROUTES (YOUR ORIGINAL)
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
      // BROADCAST API ROUTES (YOUR ORIGINAL)
      // ═══════════════════════════════════════════════════════════

      // Get broadcasts
      if (path === '/api/broadcasts' && method === 'GET') {
        return await getBroadcasts(env, corsHeaders);
      }

      // Get single broadcast (ENHANCED)
      if (path.match(/^\/api\/broadcasts\/[A-Z0-9-]+$/i) && !path.includes('/send') && method === 'GET') {
        const broadcastId = path.split('/').pop();
        return await getBroadcast(broadcastId, env, corsHeaders);
      }

      // Create broadcast
      if (path === '/api/broadcasts' && method === 'POST') {
        const data = await request.json();
        return await createBroadcast(data, env, corsHeaders);
      }

      // Update broadcast (ENHANCED)
      if (path.match(/^\/api\/broadcasts\/[A-Z0-9-]+$/i) && !path.includes('/send') && method === 'PUT') {
        const broadcastId = path.split('/').pop();
        const data = await request.json();
        return await updateBroadcast(broadcastId, data, env, corsHeaders);
      }

      // Send broadcast
      if (path.match(/^\/api\/broadcasts\/[A-Z0-9-]+\/send$/i) && method === 'POST') {
        const broadcastId = path.split('/')[3];
        return await sendBroadcast(broadcastId, env, ctx, corsHeaders);
      }

      // Delete broadcast (ENHANCED)
      if (path.match(/^\/api\/broadcasts\/[A-Z0-9-]+$/i) && method === 'DELETE') {
        const broadcastId = path.split('/').pop();
        return await deleteBroadcast(broadcastId, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // ANALYTICS API ROUTES (YOUR ORIGINAL)
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
      // SETTINGS API ROUTES (ENHANCED)
      // ═══════════════════════════════════════════════════════════

      // Get settings
      if (path === '/api/settings' && method === 'GET') {
        return await getSettings(env, corsHeaders);
      }

      // Update settings
      if (path === '/api/settings' && method === 'PUT') {
        const data = await request.json();
        return await updateSettings(data, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // LABELS API ROUTES (ENHANCED)
      // ═══════════════════════════════════════════════════════════

      // Get labels
      if (path === '/api/labels' && method === 'GET') {
        return await getLabels(env, corsHeaders);
      }

      // Create label
      if (path === '/api/labels' && method === 'POST') {
        const data = await request.json();
        return await createLabel(data, env, corsHeaders);
      }

      // Update label (ENHANCED)
      if (path.match(/^\/api\/labels\/\d+$/) && method === 'PUT') {
        const id = path.split('/').pop();
        const data = await request.json();
        return await updateLabel(id, data, env, corsHeaders);
      }

      // Delete label
      if (path.match(/^\/api\/labels\/\d+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        return await deleteLabel(id, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // TEMPLATES API ROUTES (ENHANCED)
      // ═══════════════════════════════════════════════════════════

      // Get templates
      if (path === '/api/templates' && method === 'GET') {
        return await getTemplates(env, corsHeaders);
      }

      // Create template
      if (path === '/api/templates' && method === 'POST') {
        const data = await request.json();
        return await createTemplate(data, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // AGENTS API ROUTES (ENHANCED)
      // ═══════════════════════════════════════════════════════════

      // Get agents
      if (path === '/api/agents' && method === 'GET') {
        return await getAgents(env, corsHeaders);
      }

      // Update agent status
      if (path.match(/^\/api\/agents\/[a-z0-9-]+$/i) && method === 'PUT') {
        const agentId = path.split('/').pop();
        const data = await request.json();
        return await updateAgent(agentId, data, env, corsHeaders);
      }

      // ═══════════════════════════════════════════════════════════
      // 404 Not Found (YOUR ORIGINAL)
      // ═══════════════════════════════════════════════════════════

      return Response.json(
        { error: 'Not Found', path, method },
        { status: 404, headers: corsHeaders }
      );

    } catch (error) {
      // Error handling (YOUR ORIGINAL + ENHANCED)
      console.error('[API Error]', error.message, error.stack);
      
      const isDev = env.ENVIRONMENT === 'development';
      
      // Log error to database (ENHANCED)
      await logError(error, path, method, env).catch(() => {});
      
      return Response.json({
        error: 'Internal Server Error',
        message: error.message,
        ...(isDev && { stack: error.stack })
      }, { 
        status: 500, 
        headers: corsHeaders 
      });
    } finally {
      // Request duration logging (ENHANCED)
      const duration = Date.now() - startTime;
      console.log(`[${method}] ${path} - ${duration}ms`);
    }
  },

  /**
   * Scheduled tasks handler (Cron) - YOUR ORIGINAL
   */
  async scheduled(event, env, ctx) {
    console.log('[Cron] Running scheduled tasks:', event.cron);
    ctx.waitUntil(handleScheduledTasks(event, env));
  }
};


// ═══════════════════════════════════════════════════════════════
// ERROR LOGGING (ENHANCED)
// ═══════════════════════════════════════════════════════════════

async function logError(error, path, method, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO error_logs (error_type, error_message, error_stack, endpoint, method, created_at)
      VALUES ('api', ?, ?, ?, ?, datetime('now'))
    `).bind(
      error.message,
      error.stack?.slice(0, 2000),
      path,
      method
    ).run();
  } catch {
    // Ignore logging errors
  }
}


// ═══════════════════════════════════════════════════════════════
// API HANDLER FUNCTIONS
// ═══════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────
// CHATS (YOUR ORIGINAL + ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getChats(env, url, headers) {
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const label = url.searchParams.get('label');
  const starred = url.searchParams.get('starred');
  const assigned = url.searchParams.get('assigned_to');

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

  if (label) {
    query += ` AND c.labels LIKE ?`;
    params.push(`%"${label}"%`);
  }

  if (starred === 'true') {
    query += ` AND c.is_starred = 1`;
  }

  if (assigned) {
    query += ` AND c.assigned_to = ?`;
    params.push(assigned);
  }

  query += ` ORDER BY c.is_starred DESC, c.last_timestamp DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  // Get total count
  let countQuery = `SELECT COUNT(*) as total FROM chats WHERE 1=1`;
  const countParams = [];
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

  // Parse JSON fields
  const chats = results.map(chat => ({
    ...chat,
    labels: safeParseJSON(chat.labels, [])
  }));

  return Response.json({
    chats,
    total: countResult?.total || 0,
    limit,
    offset,
    hasMore: offset + results.length < (countResult?.total || 0)
  }, { headers });
}

async function getChat(phone, env, headers) {
  const chat = await env.DB.prepare(`
    SELECT * FROM chats WHERE phone = ?
  `).bind(phone).first();

  if (!chat) {
    return Response.json({ error: 'Chat not found' }, { status: 404, headers });
  }

  // Get customer info (ENHANCED)
  const customer = await env.DB.prepare(`
    SELECT * FROM customers WHERE phone = ?
  `).bind(phone).first();

  return Response.json({
    ...chat,
    labels: safeParseJSON(chat.labels, []),
    customer: customer ? {
      ...customer,
      labels: safeParseJSON(customer.labels, [])
    } : null
  }, { headers });
}

async function updateChat(phone, data, env, headers) {
  const allowedFields = ['customer_name', 'labels', 'notes', 'status', 'priority', 'assigned_to', 'is_starred', 'is_blocked', 'language'];
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

  return Response.json({ success: true, message: 'Chat updated' }, { headers });
}

async function archiveChat(phone, env, headers) {
  await env.DB.prepare(`
    UPDATE chats SET status = 'archived', updated_at = datetime('now') WHERE phone = ?
  `).bind(phone).run();

  return Response.json({ success: true, message: 'Chat archived' }, { headers });
}


// ─────────────────────────────────────────────────────────────────
// MESSAGES (YOUR ORIGINAL + ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getMessages(phone, env, url, headers) {
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 500);
  const before = url.searchParams.get('before');
  const after = url.searchParams.get('after');

  let query = `SELECT * FROM messages WHERE phone = ?`;
  const params = [phone];

  if (before) {
    query += ` AND timestamp < ?`;
    params.push(before);
  }

  if (after) {
    query += ` AND timestamp > ?`;
    params.push(after);
  }

  query += ` ORDER BY timestamp DESC LIMIT ?`;
  params.push(limit);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  // Mark chat as read
  await env.DB.prepare(`
    UPDATE chats SET unread_count = 0, updated_at = datetime('now') WHERE phone = ?
  `).bind(phone).run();

  // Return in ascending order for display
  return Response.json({
    messages: results.reverse(),
    count: results.length,
    hasMore: results.length === limit
  }, { headers });
}

async function sendMessageAPI(data, env, headers) {
  const { to, text, type = 'text' } = data;

  if (!to || !text) {
    return Response.json(
      { error: 'Missing required fields', required: ['to', 'text'] },
      { status: 400, headers }
    );
  }

  if (!validatePhone(to)) {
    return Response.json({ error: 'Invalid phone number' }, { status: 400, headers });
  }

  const phone = normalizeIN(to);
  const sanitizedText = sanitize(text, 4096);

  try {
    // Import sendText function
    const { sendText } = await import('./utils/sendMessage.js');
    const result = await sendText(phone, sanitizedText, env);

    // Save outgoing message
    await env.DB.prepare(`
      INSERT INTO messages (phone, text, direction, timestamp, message_type, is_auto_reply)
      VALUES (?, ?, 'outgoing', datetime('now'), ?, 0)
    `).bind(phone, sanitizedText, type).run();

    // Update chat
    await env.DB.prepare(`
      UPDATE chats SET 
        last_message = ?, 
        last_timestamp = datetime('now'),
        last_direction = 'outgoing',
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(sanitizedText.slice(0, 500), phone).run();

    // Log analytics
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, timestamp)
      VALUES ('message_out', 'manual_message', ?, ?, datetime('now'))
    `).bind(phone, JSON.stringify({ text_length: sanitizedText.length })).run();

    return Response.json({ success: true, result }, { headers });
  } catch (error) {
    console.error('[SendMessage] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
}

async function sendTemplateAPI(data, env, headers) {
  const { to, template_name, language = 'en', components = [] } = data;

  if (!to || !template_name) {
    return Response.json(
      { error: 'Missing required fields', required: ['to', 'template_name'] },
      { status: 400, headers }
    );
  }

  const phone = normalizeIN(to);

  try {
    const { sendTemplate } = await import('./utils/sendMessage.js');
    const result = await sendTemplate(phone, template_name, language, components, env);

    // Save outgoing message
    await env.DB.prepare(`
      INSERT INTO messages (phone, text, direction, timestamp, message_type, is_template, template_name)
      VALUES (?, ?, 'outgoing', datetime('now'), 'template', 1, ?)
    `).bind(phone, `[Template: ${template_name}]`, template_name).run();

    // Update template usage
    await env.DB.prepare(`
      UPDATE templates SET use_count = use_count + 1 WHERE template_name = ?
    `).bind(template_name).run().catch(() => {});

    return Response.json({ success: true, result }, { headers });
  } catch (error) {
    console.error('[SendTemplate] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
}

async function sendMediaAPI(data, env, headers) {
  const { to, type, media_url, caption = '' } = data;

  if (!to || !type || !media_url) {
    return Response.json(
      { error: 'Missing required fields', required: ['to', 'type', 'media_url'] },
      { status: 400, headers }
    );
  }

  const validTypes = ['image', 'video', 'audio', 'document'];
  if (!validTypes.includes(type)) {
    return Response.json({ error: 'Invalid media type' }, { status: 400, headers });
  }

  const phone = normalizeIN(to);

  try {
    const { sendImage, sendVideo, sendDocument, sendAudio } = await import('./utils/sendMessage.js');
    
    let result;
    switch (type) {
      case 'image':
        result = await sendImage(phone, media_url, caption, env);
        break;
      case 'video':
        result = await sendVideo(phone, media_url, caption, env);
        break;
      case 'document':
        result = await sendDocument(phone, media_url, caption, env);
        break;
      case 'audio':
        result = await sendAudio(phone, media_url, env);
        break;
    }

    // Save outgoing message
    await env.DB.prepare(`
      INSERT INTO messages (phone, text, direction, timestamp, message_type, media_url)
      VALUES (?, ?, 'outgoing', datetime('now'), ?, ?)
    `).bind(phone, caption || `[${type}]`, type, media_url).run();

    return Response.json({ success: true, result }, { headers });
  } catch (error) {
    console.error('[SendMedia] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
}


// ─────────────────────────────────────────────────────────────────
// CUSTOMERS (YOUR ORIGINAL + ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getCustomers(env, url, headers) {
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  const segment = url.searchParams.get('segment');
  const search = url.searchParams.get('search');
  const label = url.searchParams.get('label');

  let query = `SELECT * FROM customers WHERE is_deleted = 0 OR is_deleted IS NULL`;
  const params = [];

  if (segment) {
    query += ` AND segment = ?`;
    params.push(segment);
  }

  if (search) {
    query += ` AND (phone LIKE ? OR name LIKE ? OR email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (label) {
    query += ` AND labels LIKE ?`;
    params.push(`%"${label}"%`);
  }

  query += ` ORDER BY last_seen DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  
  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM customers WHERE is_deleted = 0 OR is_deleted IS NULL
  `).first();

  const customers = results.map(c => ({
    ...c,
    labels: safeParseJSON(c.labels, [])
  }));

  return Response.json({
    customers,
    total: countResult?.total || 0,
    limit,
    offset
  }, { headers });
}

async function getCustomer(phone, env, headers) {
  const customer = await env.DB.prepare(`
    SELECT * FROM customers WHERE phone = ?
  `).bind(phone).first();

  const { results: orders } = await env.DB.prepare(`
    SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC LIMIT 10
  `).bind(phone).all();

  // Get message stats (ENHANCED)
  const messageStats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
      SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing
    FROM messages WHERE phone = ?
  `).bind(phone).first();

  return Response.json({
    customer: customer ? {
      ...customer,
      labels: safeParseJSON(customer.labels, [])
    } : { phone, isNew: true },
    orders: orders || [],
    messageStats: messageStats || { total: 0, incoming: 0, outgoing: 0 }
  }, { headers });
}

async function createCustomer(data, env, headers) {
  const { phone, name, email } = data;

  if (!phone || !validatePhone(phone)) {
    return Response.json({ error: 'Valid phone number is required' }, { status: 400, headers });
  }

  if (email && !validateEmail(email)) {
    return Response.json({ error: 'Invalid email format' }, { status: 400, headers });
  }

  const normalizedPhone = normalizeIN(phone);

  // Check if exists
  const existing = await env.DB.prepare(`
    SELECT * FROM customers WHERE phone = ?
  `).bind(normalizedPhone).first();

  if (existing) {
    return Response.json({ error: 'Customer already exists' }, { status: 409, headers });
  }

  await env.DB.prepare(`
    INSERT INTO customers (phone, name, email, segment, first_seen, last_seen, created_at)
    VALUES (?, ?, ?, 'new', datetime('now'), datetime('now'), datetime('now'))
  `).bind(normalizedPhone, sanitize(name) || '', email || '').run();

  return Response.json({ success: true, phone: normalizedPhone }, { headers });
}

async function updateCustomer(phone, data, env, headers) {
  const allowedFields = [
    'name', 'email', 'gender', 'birthday',
    'address_line1', 'address_line2', 'city', 'state', 'pincode',
    'alternate_phone', 'language', 'labels', 'notes', 'segment',
    'opted_in_marketing'
  ];
  
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : sanitize(String(value)));
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

async function deleteCustomer(phone, env, headers) {
  // Soft delete
  await env.DB.prepare(`
    UPDATE customers SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now') WHERE phone = ?
  `).bind(phone).run();

  return Response.json({ success: true }, { headers });
}


// ─────────────────────────────────────────────────────────────────
// ORDERS (YOUR ORIGINAL + ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getOrders(env, url, headers) {
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  const status = url.searchParams.get('status');
  const payment_status = url.searchParams.get('payment_status');
  const search = url.searchParams.get('search');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

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

  if (search) {
    query += ` AND (order_id LIKE ? OR phone LIKE ? OR customer_name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (from) {
    query += ` AND created_at >= ?`;
    params.push(from);
  }

  if (to) {
    query += ` AND created_at <= ?`;
    params.push(to);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM orders`).first();

  const orders = results.map(order => ({
    ...order,
    items: safeParseJSON(order.items, [])
  }));

  return Response.json({
    orders,
    total: countResult?.total || 0,
    limit,
    offset
  }, { headers });
}

async function getOrder(orderId, env, headers) {
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();

  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404, headers });
  }

  const { results: items } = await env.DB.prepare(`
    SELECT * FROM order_items WHERE order_id = ?
  `).bind(orderId).all();

  // Get customer (ENHANCED)
  const customer = await env.DB.prepare(`
    SELECT * FROM customers WHERE phone = ?
  `).bind(order.phone).first();

  return Response.json({
    ...order,
    items: items?.length ? items : safeParseJSON(order.items, []),
    customer
  }, { headers });
}

async function createOrder(data, env, headers) {
  const orderId = generateOrderId();

  const {
    phone, customer_name, items, address, city, state, pincode,
    subtotal = 0, discount = 0, shipping_cost = 0, total = 0,
    notes = '', payment_method = ''
  } = data;

  // Validation (ENHANCED)
  if (!phone || !validatePhone(phone)) {
    return Response.json({ error: 'Valid phone number is required' }, { status: 400, headers });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'At least one item is required' }, { status: 400, headers });
  }

  const normalizedPhone = normalizeIN(phone);

  await env.DB.prepare(`
    INSERT INTO orders (
      order_id, phone, customer_name, items, item_count,
      shipping_address, shipping_city, shipping_state, shipping_pincode,
      subtotal, discount, shipping_cost, total,
      status, payment_status, payment_method, customer_notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?, datetime('now'), datetime('now'))
  `).bind(
    orderId, normalizedPhone, sanitize(customer_name), JSON.stringify(items), items.length,
    sanitize(address), sanitize(city), sanitize(state), sanitize(pincode),
    subtotal, discount, shipping_cost, total,
    payment_method, sanitize(notes)
  ).run();

  // Update customer stats (ENHANCED)
  await env.DB.prepare(`
    UPDATE customers SET 
      order_count = order_count + 1,
      last_order_at = datetime('now'),
      updated_at = datetime('now')
    WHERE phone = ?
  `).bind(normalizedPhone).run().catch(() => {});

  // Log analytics
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, order_id, data, timestamp)
    VALUES ('order', 'order_created', ?, ?, ?, datetime('now'))
  `).bind(normalizedPhone, orderId, JSON.stringify({ total, item_count: items.length })).run();

  return Response.json({ success: true, order_id: orderId }, { headers });
}

async function updateOrder(orderId, data, env, headers) {
  const allowedFields = [
    'status', 'payment_status', 'payment_id', 'payment_method',
    'tracking_id', 'tracking_url', 'courier',
    'internal_notes', 'cancellation_reason',
    'shipping_address', 'shipping_city', 'shipping_state', 'shipping_pincode'
  ];
  
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(sanitize(String(value)));
    }
  }

  // Auto-set timestamps based on status (YOUR ORIGINAL)
  if (data.status === 'confirmed') updates.push('confirmed_at = datetime("now")');
  if (data.status === 'shipped') updates.push('shipped_at = datetime("now")');
  if (data.status === 'delivered') updates.push('delivered_at = datetime("now")');
  if (data.status === 'cancelled') updates.push('cancelled_at = datetime("now")');
  if (data.payment_status === 'paid') updates.push('paid_at = datetime("now")');

  if (updates.length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400, headers });
  }

  updates.push('updated_at = datetime("now")');
  values.push(orderId);

  await env.DB.prepare(`
    UPDATE orders SET ${updates.join(', ')} WHERE order_id = ?
  `).bind(...values).run();

  // Log status change (ENHANCED)
  if (data.status) {
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, order_id, data, timestamp)
      VALUES ('order', 'status_changed', ?, ?, datetime('now'))
    `).bind(orderId, JSON.stringify({ new_status: data.status })).run().catch(() => {});
  }

  return Response.json({ success: true }, { headers });
}

async function cancelOrder(orderId, env, headers) {
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();

  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404, headers });
  }

  if (['delivered', 'cancelled'].includes(order.status)) {
    return Response.json({ error: 'Cannot cancel this order' }, { status: 400, headers });
  }

  await env.DB.prepare(`
    UPDATE orders SET 
      status = 'cancelled', 
      cancelled_at = datetime('now'),
      updated_at = datetime('now')
    WHERE order_id = ?
  `).bind(orderId).run();

  return Response.json({ success: true }, { headers });
}


// ─────────────────────────────────────────────────────────────────
// PRODUCTS (YOUR ORIGINAL + ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getProducts(env, url, headers) {
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);
  const offset = parseInt(url.searchParams.get('offset')) || 0;
  const inStock = url.searchParams.get('in_stock');
  const featured = url.searchParams.get('featured');

  let query = `SELECT * FROM products WHERE is_active = 1`;
  const params = [];

  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  if (search) {
    query += ` AND (name LIKE ? OR description LIKE ? OR product_id LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (inStock === 'true') {
    query += ` AND stock > 0`;
  }

  if (featured === 'true') {
    query += ` AND is_featured = 1`;
  }

  query += ` ORDER BY order_count DESC, created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();

  const countResult = await env.DB.prepare(`
    SELECT COUNT(*) as total FROM products WHERE is_active = 1
  `).first();

  const products = results.map(p => ({
    ...p,
    images: safeParseJSON(p.images, []),
    variants: safeParseJSON(p.variants, []),
    tags: safeParseJSON(p.tags, [])
  }));

  return Response.json({
    products,
    total: countResult?.total || 0,
    limit,
    offset
  }, { headers });
}

async function getProduct(id, env, headers) {
  const product = await env.DB.prepare(`
    SELECT * FROM products WHERE id = ? OR product_id = ?
  `).bind(id, id).first();

  if (!product) {
    return Response.json({ error: 'Product not found' }, { status: 404, headers });
  }

  // Increment view count (ENHANCED)
  await env.DB.prepare(`
    UPDATE products SET view_count = view_count + 1 WHERE id = ?
  `).bind(product.id).run().catch(() => {});

  return Response.json({
    ...product,
    images: safeParseJSON(product.images, []),
    variants: safeParseJSON(product.variants, []),
    tags: safeParseJSON(product.tags, [])
  }, { headers });
}

async function createProduct(data, env, headers) {
  const {
    product_id, name, description = '', price, compare_price,
    category = 'General', stock = 0, image_url, images = [],
    variants = [], tags = []
  } = data;

  if (!name || price === undefined) {
    return Response.json({ error: 'Name and price are required' }, { status: 400, headers });
  }

  const sku = product_id || `SKU-${Date.now()}`;

  // Check if exists
  const existing = await env.DB.prepare(`
    SELECT * FROM products WHERE product_id = ?
  `).bind(sku).first();

  if (existing) {
    return Response.json({ error: 'Product with this ID already exists' }, { status: 409, headers });
  }

  const result = await env.DB.prepare(`
    INSERT INTO products (
      product_id, name, description, price, compare_price, category,
      stock, in_stock, image_url, images, variants, tags,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `).bind(
    sku,
    sanitize(name),
    sanitize(description, 2000),
    price,
    compare_price || null,
    sanitize(category),
    stock,
    stock > 0 ? 1 : 0,
    image_url || null,
    JSON.stringify(images),
    JSON.stringify(variants),
    JSON.stringify(tags)
  ).run();

  return Response.json({
    success: true,
    product_id: sku,
    id: result.meta.last_row_id
  }, { headers });
}

async function updateProduct(id, data, env, headers) {
  const allowedFields = [
    'name', 'description', 'price', 'compare_price', 'category', 'subcategory',
    'stock', 'in_stock', 'image_url', 'images', 'variants', 'tags',
    'material', 'weight', 'dimensions', 'is_active', 'is_featured'
  ];
  
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      if (['images', 'variants', 'tags'].includes(key)) {
        values.push(JSON.stringify(value));
      } else if (typeof value === 'string') {
        values.push(sanitize(value));
      } else {
        values.push(value);
      }
    }
  }

  if (updates.length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400, headers });
  }

  updates.push('updated_at = datetime("now")');
  values.push(id);

  await env.DB.prepare(`
    UPDATE products SET ${updates.join(', ')} WHERE id = ? OR product_id = ?
  `).bind(...values, id).run();

  return Response.json({ success: true }, { headers });
}

async function deleteProduct(id, env, headers) {
  // Soft delete
  await env.DB.prepare(`
    UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ? OR product_id = ?
  `).bind(id, id).run();

  return Response.json({ success: true }, { headers });
}

async function getCategories(env, headers) {
  const { results } = await env.DB.prepare(`
    SELECT category, COUNT(*) as product_count 
    FROM products 
    WHERE is_active = 1 
    GROUP BY category 
    ORDER BY product_count DESC
  `).all();

  return Response.json(results, { headers });
}


// ─────────────────────────────────────────────────────────────────
// QUICK REPLIES (YOUR ORIGINAL)
// ─────────────────────────────────────────────────────────────────

async function getQuickReplies(env, headers) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM quick_replies 
    WHERE is_active = 1
    ORDER BY priority DESC, use_count DESC
  `).all();

  const replies = results.map(r => ({
    ...r,
    buttons: safeParseJSON(r.buttons, [])
  }));

  return Response.json(replies, { headers });
}

async function saveQuickReply(data, env, headers) {
  const { id, keyword, response, response_type = 'text', match_type = 'contains', priority = 0, language = 'en', buttons } = data;

  if (!keyword || !response) {
    return Response.json({ error: 'Missing keyword or response' }, { status: 400, headers });
  }

  if (id) {
    // Update existing
    await env.DB.prepare(`
      UPDATE quick_replies SET 
        keyword = ?, response = ?, response_type = ?, match_type = ?, 
        priority = ?, language = ?, buttons = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      keyword.toLowerCase().trim(), 
      response, 
      response_type,
      match_type, 
      priority, 
      language, 
      buttons ? JSON.stringify(buttons) : null,
      id
    ).run();
  } else {
    // Create new
    await env.DB.prepare(`
      INSERT INTO quick_replies (keyword, response, response_type, match_type, priority, language, buttons, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).bind(
      keyword.toLowerCase().trim(), 
      response, 
      response_type,
      match_type, 
      priority, 
      language,
      buttons ? JSON.stringify(buttons) : null
    ).run();
  }

  return Response.json({ success: true }, { headers });
}

async function deleteQuickReply(id, env, headers) {
  await env.DB.prepare(`
    UPDATE quick_replies SET is_active = 0 WHERE id = ?
  `).bind(id).run();

  return Response.json({ success: true }, { headers });
}


// ─────────────────────────────────────────────────────────────────
// BROADCASTS (YOUR ORIGINAL + ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getBroadcasts(env, headers) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 50
  `).all();

  const broadcasts = results.map(b => ({
    ...b,
    target_labels: safeParseJSON(b.target_labels, [])
  }));

  return Response.json(broadcasts, { headers });
}

async function getBroadcast(broadcastId, env, headers) {
  const broadcast = await env.DB.prepare(`
    SELECT * FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();

  if (!broadcast) {
    return Response.json({ error: 'Broadcast not found' }, { status: 404, headers });
  }

  // Get recipients stats (ENHANCED)
  const stats = await env.DB.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM broadcast_recipients WHERE broadcast_id = ?
  `).bind(broadcastId).first();

  return Response.json({
    ...broadcast,
    target_labels: safeParseJSON(broadcast.target_labels, []),
    recipient_stats: stats
  }, { headers });
}

async function createBroadcast(data, env, headers) {
  const broadcastId = generateBroadcastId();

  const {
    name, message, template_name, target_type = 'all',
    target_labels, scheduled_at
  } = data;

  if (!name || (!message && !template_name)) {
    return Response.json({ error: 'Name and message/template are required' }, { status: 400, headers });
  }

  await env.DB.prepare(`
    INSERT INTO broadcasts (
      broadcast_id, name, message, template_name,
      target_type, target_labels, scheduled_at, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', datetime('now'))
  `).bind(
    broadcastId, sanitize(name), sanitize(message, 4096), template_name,
    target_type, JSON.stringify(target_labels || []), scheduled_at
  ).run();

  return Response.json({ success: true, broadcast_id: broadcastId }, { headers });
}

async function updateBroadcast(broadcastId, data, env, headers) {
  const allowedFields = ['name', 'message', 'template_name', 'target_type', 'target_labels', 'scheduled_at'];
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
  values.push(broadcastId);

  await env.DB.prepare(`
    UPDATE broadcasts SET ${updates.join(', ')} WHERE broadcast_id = ? AND status = 'draft'
  `).bind(...values).run();

  return Response.json({ success: true }, { headers });
}

async function sendBroadcast(broadcastId, env, ctx, headers) {
  const { executeBroadcast } = await import('./handlers/campaignHandler.js');
  
  const broadcast = await env.DB.prepare(`
    SELECT * FROM broadcasts WHERE broadcast_id = ?
  `).bind(broadcastId).first();

  if (!broadcast) {
    return Response.json({ error: 'Broadcast not found' }, { status: 404, headers });
  }

  if (broadcast.status === 'completed' || broadcast.status === 'sending') {
    return Response.json({ error: `Broadcast already ${broadcast.status}` }, { status: 400, headers });
  }

  // Update status
  await env.DB.prepare(`
    UPDATE broadcasts SET status = 'sending', started_at = datetime('now') WHERE broadcast_id = ?
  `).bind(broadcastId).run();

  ctx.waitUntil(executeBroadcast(broadcastId, env));

  return Response.json({ success: true, message: 'Broadcast started' }, { headers });
}

async function deleteBroadcast(broadcastId, env, headers) {
  const result = await env.DB.prepare(`
    DELETE FROM broadcasts WHERE broadcast_id = ? AND status = 'draft'
  `).bind(broadcastId).run();

  if (result.meta.changes === 0) {
    return Response.json({ error: 'Cannot delete non-draft broadcast' }, { status: 400, headers });
  }

  return Response.json({ success: true }, { headers });
}


// ─────────────────────────────────────────────────────────────────
// ANALYTICS & STATS (YOUR ORIGINAL)
// ─────────────────────────────────────────────────────────────────

async function getStats(env, url, headers) {
  const period = url.searchParams.get('period') || 'today';
  
  let dateFilter = '';
  switch (period) {
    case 'today':
      dateFilter = `timestamp >= date('now')`;
      break;
    case 'yesterday':
      dateFilter = `timestamp >= date('now', '-1 day') AND timestamp < date('now')`;
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

  const [messageStats, chatStats, orderStats, customerStats] = await Promise.all([
    env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'incoming' THEN 1 ELSE 0 END) as incoming,
        SUM(CASE WHEN direction = 'outgoing' THEN 1 ELSE 0 END) as outgoing,
        SUM(CASE WHEN is_auto_reply = 1 THEN 1 ELSE 0 END) as auto_replies
      FROM messages WHERE ${dateFilter}
    `).first(),
    
    env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN unread_count > 0 THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM chats
    `).first(),
    
    env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        COALESCE(SUM(total), 0) as revenue
      FROM orders WHERE ${dateFilter.replace('timestamp', 'created_at')}
    `).first(),
    
    env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN date(first_seen) = date('now') THEN 1 ELSE 0 END) as new_today
      FROM customers WHERE is_deleted = 0 OR is_deleted IS NULL
    `).first()
  ]);

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
  const days = Math.min(parseInt(url.searchParams.get('days')) || 7, 90);

  let data = {};

  if (type === 'overview' || type === 'messages') {
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
    const { results: ordersByDay } = await env.DB.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as total,
        COALESCE(SUM(total), 0) as revenue
      FROM orders 
      WHERE created_at >= date('now', '-${days} days')
      GROUP BY date(created_at)
      ORDER BY date
    `).all();
    data.ordersByDay = ordersByDay;
  }

  if (type === 'overview' || type === 'hourly') {
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
// SETTINGS (ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getSettings(env, headers) {
  const { results } = await env.DB.prepare(`
    SELECT key, value, category FROM settings WHERE is_sensitive = 0 OR is_sensitive IS NULL
  `).all();

  const settings = {};
  results.forEach(row => {
    if (!settings[row.category]) settings[row.category] = {};
    settings[row.category][row.key] = safeParseJSON(row.value, row.value);
  });

  return Response.json(settings, { headers });
}

async function updateSettings(data, env, headers) {
  for (const [key, value] of Object.entries(data)) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    await env.DB.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).bind(key, stringValue, stringValue).run();
  }

  return Response.json({ success: true }, { headers });
}


// ─────────────────────────────────────────────────────────────────
// LABELS (ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getLabels(env, headers) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM labels WHERE is_active = 1 ORDER BY name
  `).all();

  return Response.json(results, { headers });
}

async function createLabel(data, env, headers) {
  const { name, color = '#6B7280', description = '' } = data;

  if (!name) {
    return Response.json({ error: 'Label name is required' }, { status: 400, headers });
  }

  const result = await env.DB.prepare(`
    INSERT INTO labels (name, color, description, is_active, created_at) VALUES (?, ?, ?, 1, datetime('now'))
  `).bind(sanitize(name), color, sanitize(description)).run();

  return Response.json({ success: true, id: result.meta.last_row_id }, { headers });
}

async function updateLabel(id, data, env, headers) {
  const { name, color, description } = data;
  
  const updates = [];
  const values = [];

  if (name) { updates.push('name = ?'); values.push(sanitize(name)); }
  if (color) { updates.push('color = ?'); values.push(color); }
  if (description !== undefined) { updates.push('description = ?'); values.push(sanitize(description)); }

  if (updates.length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400, headers });
  }

  values.push(id);

  await env.DB.prepare(`
    UPDATE labels SET ${updates.join(', ')} WHERE id = ? AND is_system = 0
  `).bind(...values).run();

  return Response.json({ success: true }, { headers });
}

async function deleteLabel(id, env, headers) {
  // Don't delete system labels
  await env.DB.prepare(`
    UPDATE labels SET is_active = 0 WHERE id = ? AND is_system = 0
  `).bind(id).run();

  return Response.json({ success: true }, { headers });
}


// ─────────────────────────────────────────────────────────────────
// TEMPLATES (ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getTemplates(env, headers) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM templates ORDER BY use_count DESC
  `).all();

  const templates = results.map(t => ({
    ...t,
    buttons: safeParseJSON(t.buttons, [])
  }));

  return Response.json(templates, { headers });
}

async function createTemplate(data, env, headers) {
  const { template_name, category, language = 'en', header_type, header_text, body_text, footer_text, buttons } = data;

  if (!template_name || !body_text) {
    return Response.json({ error: 'Template name and body are required' }, { status: 400, headers });
  }

  await env.DB.prepare(`
    INSERT INTO templates (template_name, category, language, header_type, header_text, body_text, footer_text, buttons, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).bind(
    template_name,
    category,
    language,
    header_type,
    header_text,
    body_text,
    footer_text,
    buttons ? JSON.stringify(buttons) : null
  ).run();

  return Response.json({ success: true }, { headers });
}


// ─────────────────────────────────────────────────────────────────
// AGENTS (ENHANCED)
// ─────────────────────────────────────────────────────────────────

async function getAgents(env, headers) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM agents WHERE is_active = 1 ORDER BY name
  `).all();

  return Response.json(results, { headers });
}

async function updateAgent(agentId, data, env, headers) {
  const allowedFields = ['name', 'email', 'phone', 'role', 'is_online', 'status'];
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (data.is_online !== undefined) {
    updates.push('last_online = datetime("now")');
  }

  if (updates.length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400, headers });
  }

  values.push(agentId);

  await env.DB.prepare(`
    UPDATE agents SET ${updates.join(', ')} WHERE agent_id = ?
  `).bind(...values).run();

  return Response.json({ success: true }, { headers });
}

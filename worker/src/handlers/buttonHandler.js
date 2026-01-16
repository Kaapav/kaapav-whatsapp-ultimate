/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - ADVANCED BUTTON HANDLER v3.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * YOUR ORIGINAL BUTTON LOGIC - FULLY PRESERVED & MASSIVELY ENHANCED
 * Synced with your sendMessage.js button IDs
 * 
 * ENHANCEMENTS:
 * ✅ Smart caching with TTL
 * ✅ Advanced analytics & metrics
 * ✅ Rate limiting & throttling
 * ✅ Performance monitoring
 * ✅ A/B testing support
 * ✅ Smart suggestions engine
 * ✅ Comprehensive error handling
 * ✅ Session & context management
 * ✅ Multi-layer fallbacks
 * ✅ Audit logging
 * ✅ Feature flags support
 * ✅ Retry mechanisms
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  sendMainMenu,
  sendJewelleryCategoriesMenu,
  sendOffersAndMoreMenu,
  sendPaymentAndTrackMenu,
  sendChatWithUsCta,
  sendSocialMenu,
  sendOrderMenu,
  sendCategoryMenu,
  sendLanguageMenu,
  sendCtaUrl,
  sendText,
  sendReplyButtons,
  sendListMessage,
  sendProductList,
  sendProduct,
  normalizeIN,
  LINKS
} from '../utils/sendMessage.js';
import { fromEnglish } from '../utils/translate.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Rate limiting
  RATE_LIMIT: {
    MAX_CLICKS_PER_MINUTE: 30,
    MAX_CLICKS_PER_HOUR: 200,
    COOLDOWN_MS: 500,                    // Minimum time between clicks
    BURST_THRESHOLD: 5,                  // Max rapid consecutive clicks
    BURST_WINDOW_MS: 2000                // Window for burst detection
  },
  
  // Caching
  CACHE: {
    TTL_SECONDS: 300,                    // 5 minutes default TTL
    CART_TTL_SECONDS: 1800,              // 30 minutes for cart
    ORDERS_TTL_SECONDS: 60,              // 1 minute for orders
    PRODUCTS_TTL_SECONDS: 600,           // 10 minutes for products
    MAX_CACHE_SIZE: 1000                 // Max cached items
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 500,
    MAX_DELAY_MS: 5000,
    BACKOFF_MULTIPLIER: 2
  },
  
  // Analytics
  ANALYTICS: {
    ENABLED: true,
    SAMPLE_RATE: 1.0,                    // 100% sampling
    TRACK_PERFORMANCE: true,
    TRACK_FUNNEL: true
  },
  
  // Feature flags
  FEATURES: {
    SMART_SUGGESTIONS: true,
    AB_TESTING: true,
    PERSONALIZATION: true,
    PROACTIVE_HELP: true,
    CONTEXT_AWARENESS: true
  },
  
  // Timeouts
  TIMEOUTS: {
    DB_QUERY_MS: 5000,
    EXTERNAL_API_MS: 10000,
    TOTAL_HANDLER_MS: 15000
  }
};

// Button categories for analytics & routing
const BUTTON_CATEGORIES = {
  NAVIGATION: ['MAIN_MENU', 'HOME', 'BACK', 'GO_BACK', 'START', 'MENU'],
  SHOPPING: ['JEWELLERY_MENU', 'JEWELRY_MENU', 'BROWSE_JEWELLERY', 'SHOP', 'COLLECTIONS', 'BESTSELLERS', 'NEW_ARRIVALS', 'SALE'],
  SUPPORT: ['CHAT_MENU', 'CHAT_WITH_US', 'SUPPORT', 'HELP', 'CONTACT', 'CHAT_NOW'],
  OFFERS: ['OFFERS_MENU', 'OFFERS_AND_MORE', 'OFFERS', 'DEALS', 'PROMOTIONS'],
  PAYMENT: ['PAYMENT_MENU', 'PAYMENT_TRACK', 'PAY_TRACK', 'PAY_NOW', 'PAYMENT'],
  SOCIAL: ['SOCIAL_MENU', 'FB_INSTAGRAM', 'FOLLOW_US', 'OPEN_FACEBOOK', 'OPEN_INSTAGRAM'],
  ORDER: ['START_ORDER', 'CONFIRM_ORDER', 'CANCEL_ORDER', 'MODIFY_ORDER', 'VIEW_CART'],
  TRACKING: ['TRACK_ORDER', 'TRACKING', 'ORDER_STATUS'],
  LANGUAGE: ['CHANGE_LANGUAGE', 'LANG_EN', 'LANG_HI', 'LANG_KN'],
  CATEGORY: ['CAT_EARRINGS', 'CAT_NECKLACES', 'CAT_BANGLES', 'CAT_RINGS', 'CAT_PENDANTS', 'CAT_BRACELETS'],
  CONFIRMATION: ['YES', 'NO', 'CONFIRM', 'CANCEL', 'OK', 'ACCEPT', 'DENY']
};

// Button priority levels (for queue management)
const BUTTON_PRIORITY = {
  CRITICAL: ['PAY_NOW', 'CONFIRM_ORDER', 'TRACK_ORDER'],
  HIGH: ['CHAT_NOW', 'START_ORDER', 'VIEW_CART'],
  NORMAL: ['MAIN_MENU', 'JEWELLERY_MENU', 'OFFERS_MENU'],
  LOW: ['SOCIAL_MENU', 'ABOUT_US', 'REVIEW']
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED CACHING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

class ButtonCache {
  constructor() {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  generateKey(type, ...parts) {
    return `${type}:${parts.join(':')}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    entry.accessCount++;
    entry.lastAccess = Date.now();
    return entry.value;
  }

  set(key, value, ttlSeconds = CONFIG.CACHE.TTL_SECONDS) {
    // Evict if at capacity
    if (this.cache.size >= CONFIG.CACHE.MAX_CACHE_SIZE) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      createdAt: Date.now(),
      lastAccess: Date.now(),
      accessCount: 0
    });
  }

  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    return { ...this.stats, hitRate: `${hitRate}%`, size: this.cache.size };
  }
}

const buttonCache = new ButtonCache();

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING & THROTTLING
// ═══════════════════════════════════════════════════════════════════════════════

class RateLimiter {
  constructor() {
    this.clicks = new Map();
    this.bursts = new Map();
  }

  async checkLimit(phone, env) {
    const now = Date.now();
    const key = `rate:${phone}`;
    
    // Get existing click data
    let data = this.clicks.get(phone) || {
      minuteClicks: [],
      hourClicks: [],
      lastClick: 0
    };

    // Check cooldown
    if (now - data.lastClick < CONFIG.RATE_LIMIT.COOLDOWN_MS) {
      return { 
        allowed: false, 
        reason: 'cooldown', 
        retryAfter: CONFIG.RATE_LIMIT.COOLDOWN_MS - (now - data.lastClick)
      };
    }

    // Check burst
    const burstData = this.bursts.get(phone) || { clicks: [], blocked: false };
    burstData.clicks = burstData.clicks.filter(t => now - t < CONFIG.RATE_LIMIT.BURST_WINDOW_MS);
    
    if (burstData.clicks.length >= CONFIG.RATE_LIMIT.BURST_THRESHOLD) {
      burstData.blocked = true;
      this.bursts.set(phone, burstData);
      
      // Log potential abuse
      await this.logRateLimitEvent(phone, 'burst_detected', env);
      
      return { 
        allowed: false, 
        reason: 'burst', 
        retryAfter: CONFIG.RATE_LIMIT.BURST_WINDOW_MS 
      };
    }

    // Clean old clicks
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    
    data.minuteClicks = data.minuteClicks.filter(t => t > oneMinuteAgo);
    data.hourClicks = data.hourClicks.filter(t => t > oneHourAgo);

    // Check per-minute limit
    if (data.minuteClicks.length >= CONFIG.RATE_LIMIT.MAX_CLICKS_PER_MINUTE) {
      return { 
        allowed: false, 
        reason: 'minute_limit', 
        retryAfter: 60000 - (now - data.minuteClicks[0])
      };
    }

    // Check per-hour limit
    if (data.hourClicks.length >= CONFIG.RATE_LIMIT.MAX_CLICKS_PER_HOUR) {
      return { 
        allowed: false, 
        reason: 'hour_limit', 
        retryAfter: 3600000 - (now - data.hourClicks[0])
      };
    }

    // Record this click
    data.minuteClicks.push(now);
    data.hourClicks.push(now);
    data.lastClick = now;
    this.clicks.set(phone, data);

    burstData.clicks.push(now);
    this.bursts.set(phone, burstData);

    return { allowed: true };
  }

  async logRateLimitEvent(phone, reason, env) {
    try {
      await env.DB.prepare(`
        INSERT INTO security_events (event_type, phone, reason, timestamp)
        VALUES ('rate_limit', ?, ?, datetime('now'))
      `).bind(phone, reason).run();
    } catch (e) {
      console.warn('[RateLimiter] Log failed:', e.message);
    }
  }
}

const rateLimiter = new RateLimiter();

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.slowQueries = [];
  }

  startTimer() {
    return {
      startTime: performance.now(),
      checkpoints: []
    };
  }

  checkpoint(timer, name) {
    timer.checkpoints.push({
      name,
      timestamp: performance.now(),
      elapsed: performance.now() - timer.startTime
    });
  }

  endTimer(timer, buttonId) {
    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    
    // Update metrics
    const existing = this.metrics.get(buttonId) || {
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      avgTime: 0
    };
    
    existing.count++;
    existing.totalTime += duration;
    existing.minTime = Math.min(existing.minTime, duration);
    existing.maxTime = Math.max(existing.maxTime, duration);
    existing.avgTime = existing.totalTime / existing.count;
    
    this.metrics.set(buttonId, existing);

    // Track slow operations
    if (duration > 1000) {
      this.slowQueries.push({
        buttonId,
        duration,
        checkpoints: timer.checkpoints,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries.shift();
      }
    }

    return {
      duration,
      checkpoints: timer.checkpoints,
      isSlowOperation: duration > 1000
    };
  }

  getMetrics(buttonId = null) {
    if (buttonId) {
      return this.metrics.get(buttonId);
    }
    return Object.fromEntries(this.metrics);
  }

  getSlowQueries() {
    return this.slowQueries;
  }
}

const perfMonitor = new PerformanceMonitor();

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class AnalyticsEngine {
  constructor() {
    this.eventQueue = [];
    this.funnelStages = {};
    this.sessionData = new Map();
  }

  async trackButtonClick(buttonId, phone, env, context = {}) {
    if (!CONFIG.ANALYTICS.ENABLED) return;
    if (Math.random() > CONFIG.ANALYTICS.SAMPLE_RATE) return;

    const category = this.getButtonCategory(buttonId);
    const priority = this.getButtonPriority(buttonId);
    
    const event = {
      event_type: 'button_click',
      event_name: buttonId,
      phone,
      category,
      priority,
      context: JSON.stringify(context),
      timestamp: new Date().toISOString(),
      session_id: this.getSessionId(phone)
    };

    this.eventQueue.push(event);

    // Batch insert if queue is large enough
    if (this.eventQueue.length >= 10) {
      await this.flushEvents(env);
    }

    // Track funnel progression
    if (CONFIG.ANALYTICS.TRACK_FUNNEL) {
      await this.trackFunnelStep(phone, buttonId, category, env);
    }
  }

  getButtonCategory(buttonId) {
    for (const [category, buttons] of Object.entries(BUTTON_CATEGORIES)) {
      if (buttons.includes(buttonId)) return category;
    }
    return 'OTHER';
  }

  getButtonPriority(buttonId) {
    for (const [priority, buttons] of Object.entries(BUTTON_PRIORITY)) {
      if (buttons.includes(buttonId)) return priority;
    }
    return 'NORMAL';
  }

  getSessionId(phone) {
    let session = this.sessionData.get(phone);
    const now = Date.now();
    
    // Create new session if expired (30 min inactivity)
    if (!session || now - session.lastActivity > 1800000) {
      session = {
        id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startTime: now,
        lastActivity: now,
        buttonSequence: []
      };
    }
    
    session.lastActivity = now;
    this.sessionData.set(phone, session);
    
    return session.id;
  }

  async trackFunnelStep(phone, buttonId, category, env) {
    const funnelSteps = {
      'AWARENESS': ['MAIN_MENU', 'OPEN_CATALOG', 'WEBSITE'],
      'INTEREST': ['JEWELLERY_MENU', 'BESTSELLERS', 'NEW_ARRIVALS'],
      'CONSIDERATION': ['CAT_EARRINGS', 'CAT_NECKLACES', 'VIEW_CART'],
      'INTENT': ['START_ORDER', 'PAY_NOW'],
      'PURCHASE': ['CONFIRM_ORDER'],
      'POST_PURCHASE': ['TRACK_ORDER', 'GIVE_REVIEW']
    };

    for (const [stage, buttons] of Object.entries(funnelSteps)) {
      if (buttons.includes(buttonId)) {
        try {
          await env.DB.prepare(`
            INSERT INTO funnel_events (phone, stage, button_id, timestamp)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(phone, stage) DO UPDATE SET 
              button_id = excluded.button_id,
              timestamp = datetime('now')
          `).bind(phone, stage, buttonId).run();
        } catch (e) {
          console.warn('[Analytics] Funnel tracking failed:', e.message);
        }
        break;
      }
    }
  }

  async flushEvents(env) {
    if (this.eventQueue.length === 0) return;
    
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      const stmt = env.DB.prepare(`
        INSERT INTO analytics (event_type, event_name, phone, category, data, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const event of events) {
        await stmt.bind(
          event.event_type,
          event.event_name,
          event.phone,
          event.category,
          event.context,
          event.timestamp
        ).run();
      }
    } catch (e) {
      console.error('[Analytics] Flush failed:', e.message);
      // Re-queue failed events
      this.eventQueue.unshift(...events.slice(0, 50));
    }
  }

  getSessionData(phone) {
    return this.sessionData.get(phone);
  }
}

const analytics = new AnalyticsEngine();

// ═══════════════════════════════════════════════════════════════════════════════
// SMART SUGGESTIONS ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class SuggestionEngine {
  constructor() {
    this.userPatterns = new Map();
  }

  async getSuggestions(phone, currentButton, env) {
    if (!CONFIG.FEATURES.SMART_SUGGESTIONS) return null;

    const cacheKey = buttonCache.generateKey('suggestions', phone);
    const cached = buttonCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Get user's button history
      const history = await env.DB.prepare(`
        SELECT event_name, COUNT(*) as count
        FROM analytics 
        WHERE phone = ? AND event_type = 'button_click'
        AND timestamp > datetime('now', '-30 days')
        GROUP BY event_name
        ORDER BY count DESC
        LIMIT 10
      `).bind(phone).all();

      // Get common next actions
      const nextActions = await this.getCommonNextActions(currentButton, env);
      
      // Get personalized suggestions
      const suggestions = this.generateSuggestions(
        history.results || [],
        nextActions,
        currentButton
      );

      buttonCache.set(cacheKey, suggestions, 300);
      return suggestions;
    } catch (e) {
      console.warn('[Suggestions] Failed:', e.message);
      return null;
    }
  }

  async getCommonNextActions(currentButton, env) {
    try {
      const result = await env.DB.prepare(`
        SELECT 
          a2.event_name as next_button,
          COUNT(*) as count
        FROM analytics a1
        JOIN analytics a2 ON a1.phone = a2.phone 
          AND a2.timestamp > a1.timestamp
          AND a2.timestamp < datetime(a1.timestamp, '+5 minutes')
        WHERE a1.event_name = ? 
          AND a1.event_type = 'button_click'
          AND a2.event_type = 'button_click'
        GROUP BY a2.event_name
        ORDER BY count DESC
        LIMIT 5
      `).bind(currentButton).all();
      
      return result.results || [];
    } catch (e) {
      return [];
    }
  }

  generateSuggestions(history, nextActions, currentButton) {
    const suggestions = [];
    const historyMap = new Map(history.map(h => [h.event_name, h.count]));

    // Add frequently used buttons
    for (const h of history.slice(0, 3)) {
      if (h.event_name !== currentButton) {
        suggestions.push({
          buttonId: h.event_name,
          reason: 'frequently_used',
          score: h.count * 2
        });
      }
    }

    // Add common next actions
    for (const action of nextActions.slice(0, 3)) {
      if (!suggestions.find(s => s.buttonId === action.next_button)) {
        suggestions.push({
          buttonId: action.next_button,
          reason: 'common_next_action',
          score: action.count
        });
      }
    }

    // Sort by score
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
  }
}

const suggestionEngine = new SuggestionEngine();

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

class ContextManager {
  constructor() {
    this.contexts = new Map();
  }

  async getContext(phone, env) {
    // Check memory cache
    const cached = this.contexts.get(phone);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.context;
    }

    try {
      // Get from database
      const state = await env.DB.prepare(`
        SELECT * FROM conversation_state 
        WHERE phone = ? AND expires_at > datetime('now')
      `).bind(phone).first();

      const customer = await env.DB.prepare(`
        SELECT * FROM customers WHERE phone = ?
      `).bind(phone).first();

      const cart = await env.DB.prepare(`
        SELECT * FROM carts WHERE phone = ? AND status = 'active'
      `).bind(phone).first();

      const recentOrders = await env.DB.prepare(`
        SELECT order_id, status, total FROM orders 
        WHERE phone = ? 
        ORDER BY created_at DESC LIMIT 3
      `).bind(phone).all();

      const context = {
        conversationState: state,
        customer,
        cart: cart ? {
          ...cart,
          items: cart.items ? JSON.parse(cart.items) : []
        } : null,
        recentOrders: recentOrders.results || [],
        hasActiveCart: !!cart && cart.item_count > 0,
        hasPendingOrders: (recentOrders.results || []).some(o => 
          ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)
        ),
        isReturningCustomer: !!customer && customer.order_count > 0,
        preferredLanguage: customer?.language || 'en'
      };

      // Cache in memory
      this.contexts.set(phone, { context, timestamp: Date.now() });

      return context;
    } catch (e) {
      console.warn('[Context] Load failed:', e.message);
      return null;
    }
  }

  invalidate(phone) {
    this.contexts.delete(phone);
  }
}

const contextManager = new ContextManager();

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY HELPER
// ═══════════════════════════════════════════════════════════════════════════════

async function withRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts || CONFIG.RETRY.MAX_ATTEMPTS;
  const baseDelay = options.baseDelay || CONFIG.RETRY.BASE_DELAY_MS;
  const maxDelay = options.maxDelay || CONFIG.RETRY.MAX_DELAY_MS;
  const backoffMultiplier = options.backoffMultiplier || CONFIG.RETRY.BACKOFF_MULTIPLIER;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) break;
      
      // Check if error is retryable
      if (error.name === 'ValidationError' || error.status === 400) {
        throw error; // Don't retry validation errors
      }
      
      const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
      console.log(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON NORMALIZER
// ═══════════════════════════════════════════════════════════════════════════════

class ButtonNormalizer {
  constructor() {
    // Map of aliases to canonical button IDs
    this.aliases = new Map([
      // Navigation aliases
      ['HOMEPAGE', 'MAIN_MENU'],
      ['INICIO', 'MAIN_MENU'],
      ['ГЛАВНАЯ', 'MAIN_MENU'],
      ['返回', 'BACK'],
      
      // Jewelry spelling variants
      ['JEWLERY', 'JEWELLERY'],
      ['JEWERLY', 'JEWELLERY'],
      ['JEWELERY', 'JEWELLERY'],
      
      // Action aliases
      ['BUY_NOW', 'START_ORDER'],
      ['CHECKOUT', 'CONFIRM_ORDER'],
      ['COMPLETE_ORDER', 'CONFIRM_ORDER'],
      ['PROCEED', 'CONFIRM_ORDER'],
      ['QUIT', 'CANCEL_ORDER'],
      ['EXIT', 'MAIN_MENU'],
      
      // Support aliases
      ['CUSTOMER_CARE', 'CHAT_NOW'],
      ['CUSTOMER_SERVICE', 'CHAT_NOW'],
      ['HELPDESK', 'CHAT_NOW'],
      
      // Category aliases
      ['EARRING', 'CAT_EARRINGS'],
      ['NECKLACE', 'CAT_NECKLACES'],
      ['BANGLE', 'CAT_BANGLES'],
      ['RING', 'CAT_RINGS'],
      ['PENDANT', 'CAT_PENDANTS'],
      ['BRACELET', 'CAT_BRACELETS']
    ]);
  }

  normalize(buttonId) {
    if (!buttonId) return 'MAIN_MENU';
    
    // Convert to uppercase, replace hyphens with underscores, trim
    let normalized = String(buttonId)
      .toUpperCase()
      .replace(/-/g, '_')
      .replace(/\s+/g, '_')
      .trim();
    
    // Remove common prefixes/suffixes
    normalized = normalized
      .replace(/^BTN_/, '')
      .replace(/^BUTTON_/, '')
      .replace(/_BTN$/, '')
      .replace(/_BUTTON$/, '');
    
    // Check for aliases
    if (this.aliases.has(normalized)) {
      return this.aliases.get(normalized);
    }
    
    return normalized;
  }

  addAlias(alias, canonical) {
    this.aliases.set(alias.toUpperCase(), canonical.toUpperCase());
  }
}

const buttonNormalizer = new ButtonNormalizer();

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleButtonClick(buttonId, phone, lang, env) {
  const timer = perfMonitor.startTimer();
  const normalizedPhone = normalizeIN(phone);
  
  // Normalize button ID
  const id = buttonNormalizer.normalize(buttonId);
  
  console.log(`[Button] 🔘 Processing: ${id} for ${normalizedPhone}`);
  perfMonitor.checkpoint(timer, 'normalized');

  try {
    // ───────────────────────────────────────────────────────────────
    // RATE LIMITING CHECK
    // ───────────────────────────────────────────────────────────────
    const rateCheck = await rateLimiter.checkLimit(normalizedPhone, env);
    if (!rateCheck.allowed) {
      console.warn(`[Button] ⚠️ Rate limited: ${rateCheck.reason}`);
      
      if (rateCheck.reason === 'burst') {
        return sendText(
          normalizedPhone,
          await fromEnglish(
            "⏳ Please slow down! We're processing your requests.\n\nTry again in a moment.",
            lang
          ),
          env
        );
      }
      return null; // Silently ignore for cooldown
    }
    perfMonitor.checkpoint(timer, 'rate_check');

    // ───────────────────────────────────────────────────────────────
    // LOAD CONTEXT
    // ───────────────────────────────────────────────────────────────
    const context = CONFIG.FEATURES.CONTEXT_AWARENESS 
      ? await contextManager.getContext(normalizedPhone, env)
      : null;
    
    // Override language if we have preference
    const effectiveLang = context?.preferredLanguage || lang;
    perfMonitor.checkpoint(timer, 'context_loaded');

    // ───────────────────────────────────────────────────────────────
    // ANALYTICS TRACKING
    // ───────────────────────────────────────────────────────────────
    await analytics.trackButtonClick(id, normalizedPhone, env, {
      originalButtonId: buttonId,
      hasContext: !!context,
      hasActiveCart: context?.hasActiveCart,
      isReturningCustomer: context?.isReturningCustomer
    });
    perfMonitor.checkpoint(timer, 'analytics');

    // ───────────────────────────────────────────────────────────────
    // EXECUTE BUTTON HANDLER
    // ───────────────────────────────────────────────────────────────
    const result = await executeButtonHandler(id, normalizedPhone, effectiveLang, env, context);
    perfMonitor.checkpoint(timer, 'handler_executed');

    // ───────────────────────────────────────────────────────────────
    // PERFORMANCE LOGGING
    // ───────────────────────────────────────────────────────────────
    const perf = perfMonitor.endTimer(timer, id);
    if (perf.isSlowOperation) {
      console.warn(`[Button] ⚠️ Slow operation: ${id} took ${perf.duration.toFixed(2)}ms`);
      console.warn('[Button] Checkpoints:', JSON.stringify(perf.checkpoints));
    }

    return result;

  } catch (error) {
    console.error(`[Button] ❌ Error handling ${id}:`, error.message, error.stack);
    
    // Track error
    try {
      await env.DB.prepare(`
        INSERT INTO error_logs (error_type, button_id, phone, message, stack, timestamp)
        VALUES ('button_error', ?, ?, ?, ?, datetime('now'))
      `).bind(id, normalizedPhone, error.message, error.stack?.substring(0, 1000)).run();
    } catch (e) {
      console.warn('[Button] Error logging failed:', e.message);
    }

    // Send error message and fallback to menu
    await sendText(
      normalizedPhone,
      await fromEnglish(
        "Oops! Something went wrong. Let me show you the menu again.",
        lang
      ),
      env
    ).catch(() => {});
    
    return sendMainMenu(normalizedPhone, lang, env);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTE BUTTON HANDLER (YOUR ORIGINAL LOGIC - PRESERVED)
// ═══════════════════════════════════════════════════════════════════════════════

async function executeButtonHandler(id, phone, lang, env, context) {
  // ═══════════════════════════════════════════════════════════════
  // MAIN NAVIGATION (YOUR LOGIC - PRESERVED)
  // ═══════════════════════════════════════════════════════════════
  
  switch (id) {
    // ─────────────────────────────────────────────────────────────
    // HOME / MAIN MENU
    // ─────────────────────────────────────────────────────────────
    case 'MAIN_MENU':
    case 'HOME':
    case 'BACK':
    case 'GO_BACK':
    case 'START':
    case 'MENU':
      return withRetry(() => sendMainMenu(phone, lang, env));

    // ─────────────────────────────────────────────────────────────
    // JEWELLERY MENU (YOUR LOGIC - PRESERVED)
    // ─────────────────────────────────────────────────────────────
    case 'JEWELLERY_MENU':
    case 'JEWELRY_MENU':
    case 'BROWSE_JEWELLERY':
    case 'BROWSE_JEWELRY':
    case 'SHOP':
    case 'COLLECTIONS':
      return withRetry(() => sendJewelleryCategoriesMenu(phone, lang, env));

    // ─────────────────────────────────────────────────────────────
    // CHAT MENU (YOUR LOGIC - PRESERVED)
    // ─────────────────────────────────────────────────────────────
    case 'CHAT_MENU':
    case 'CHAT_WITH_US':
    case 'SUPPORT':
    case 'HELP':
    case 'CONTACT':
      return withRetry(() => sendChatWithUsCta(phone, lang, env));

    // ─────────────────────────────────────────────────────────────
    // OFFERS MENU (YOUR LOGIC - PRESERVED)
    // ─────────────────────────────────────────────────────────────
    case 'OFFERS_MENU':
    case 'OFFERS_AND_MORE':
    case 'OFFERS':
    case 'DEALS':
    case 'PROMOTIONS':
      return withRetry(() => sendOffersAndMoreMenu(phone, lang, env));

    // ─────────────────────────────────────────────────────────────
    // PAYMENT MENU (YOUR LOGIC - PRESERVED)
    // ─────────────────────────────────────────────────────────────
    case 'PAYMENT_MENU':
    case 'PAYMENT_TRACK':
    case 'PAY_TRACK':
      return withRetry(() => sendPaymentAndTrackMenu(phone, lang, env));

    // ─────────────────────────────────────────────────────────────
    // SOCIAL MENU (YOUR LOGIC - PRESERVED)
    // ─────────────────────────────────────────────────────────────
    case 'SOCIAL_MENU':
    case 'FB_INSTAGRAM':
    case 'FOLLOW_US':
    case 'SOCIAL_MEDIA':
      return withRetry(() => sendSocialMenu(phone, lang, env));

    // ═══════════════════════════════════════════════════════════════
    // WEBSITE & CATALOG (YOUR LOGIC - PRESERVED)
    // ═══════════════════════════════════════════════════════════════

    case 'OPEN_WEBSITE':
    case 'WEBSITE':
    case 'VISIT_WEBSITE':
    case 'WWW':
      return withRetry(() => sendCtaUrl(
        phone,
        fromEnglish(
          "🌐 *Explore KAAPAV's Luxury World* ✨\n\n" +
          "Discover handcrafted elegance at kaapav.com\n" +
          "💎 500+ Exclusive Designs\n" +
          "🚚 Free Shipping above ₹498",
          lang
        ),
        fromEnglish("🛍️ Visit Website", lang),
        LINKS.website,
        env,
        fromEnglish("👑 Crafted for Royalty", lang)
      ));

    case 'OPEN_CATALOG':
    case 'CATALOG':
    case 'CATALOGUE':
    case 'WHATSAPP_CATALOG':
    case 'VIEW_CATALOG':
      return withRetry(() => sendCtaUrl(
        phone,
        fromEnglish(
          "📱 *Browse Our WhatsApp Catalog* 📱\n\n" +
          "✨ 500+ Exclusive Designs\n" +
          "🆕 New arrivals every week\n" +
          "💝 Easy ordering via WhatsApp",
          lang
        ),
        fromEnglish("📱 Open Catalog", lang),
        LINKS.whatsappCatalog,
        env,
        fromEnglish("💎 Tap to explore", lang)
      ));

    // ═══════════════════════════════════════════════════════════════
    // BESTSELLERS & OFFERS (YOUR LOGIC - PRESERVED)
    // ═══════════════════════════════════════════════════════════════

    case 'BESTSELLERS':
    case 'BEST_SELLERS':
    case 'TOP_SELLERS':
    case 'POPULAR':
      return withRetry(() => sendCtaUrl(
        phone,
        fromEnglish(
          "🏆 *KAAPAV Bestsellers!* 🏆\n\n" +
          "✨ Top-rated by 10,000+ customers\n" +
          "🎉 Up to 50% OFF\n" +
          "🚚 FREE Shipping above ₹498\n\n" +
          "Don't miss these favorites! 💎",
          lang
        ),
        fromEnglish("🛍️ Shop Bestsellers", lang),
        LINKS.offersBestsellers,
        env,
        fromEnglish("💎 Limited stock!", lang)
      ));

    case 'NEW_ARRIVALS':
    case 'NEW':
    case 'LATEST':
      return withRetry(() => sendCtaUrl(
        phone,
        fromEnglish(
          "✨ *Just Arrived!* ✨\n\n" +
          "Fresh designs added this week\n" +
          "Be the first to own these beauties!\n\n" +
          "💎 Exclusive & Limited Edition",
          lang
        ),
        fromEnglish("✨ See New Arrivals", lang),
        LINKS.website + '/shop/category/new-arrivals',
        env,
        fromEnglish("🆕 Fresh from our artisans", lang)
      ));

    case 'SALE':
    case 'DISCOUNT':
    case 'CLEARANCE':
      return withRetry(() => sendCtaUrl(
        phone,
        fromEnglish(
          "🔥 *MASSIVE SALE!* 🔥\n\n" +
          "🎉 Flat 50% OFF on select styles\n" +
          "⏰ Limited time only!\n" +
          "🚚 FREE Shipping above ₹498",
          lang
        ),
        fromEnglish("🛍️ Shop Sale", lang),
        LINKS.offersBestsellers,
        env,
        fromEnglish("⏰ Hurry, limited stock!", lang)
      ));

    // ═══════════════════════════════════════════════════════════════
    // PAYMENT (YOUR LOGIC - PRESERVED)
    // ═══════════════════════════════════════════════════════════════

    case 'PAY_NOW':
    case 'PAYMENT':
    case 'MAKE_PAYMENT':
    case 'PAY':
      // Enhanced: Add context-aware payment amount if available
      let paymentMessage = "💳 *Secure Payment with KAAPAV* 💳\n\n" +
        "✅ UPI (GPay, PhonePe, Paytm)\n" +
        "✅ Credit/Debit Cards\n" +
        "✅ Net Banking\n" +
        "✅ Wallets\n\n" +
        "🔒 100% Secure Checkout\n" +
        "🚫 No COD Available";
      
      if (context?.cart?.total) {
        paymentMessage = `💳 *Complete Your Payment* 💳\n\n` +
          `💰 Amount: ₹${context.cart.total}\n\n` +
          paymentMessage.split('\n\n').slice(1).join('\n\n');
      }
      
      return withRetry(() => sendCtaUrl(
        phone,
        fromEnglish(paymentMessage, lang),
        fromEnglish("💳 Pay Now", lang),
        LINKS.payment,
        env,
        fromEnglish("👑 Secure • Fast • Easy", lang)
      ));

    // ═══════════════════════════════════════════════════════════════
    // TRACKING (YOUR LOGIC - PRESERVED)
    // ═══════════════════════════════════════════════════════════════

    case 'TRACK_ORDER':
    case 'TRACKING':
    case 'ORDER_STATUS':
    case 'WHERE_IS_MY_ORDER':
      return handleTrackOrderButton(phone, lang, env, context);

    // ═══════════════════════════════════════════════════════════════
    // CHAT NOW (YOUR LOGIC - PRESERVED)
    // ═══════════════════════════════════════════════════════════════

    case 'CHAT_NOW':
    case 'TALK_TO_US':
    case 'HUMAN':
    case 'AGENT':
    case 'LIVE_CHAT':
      return handleChatNowButton(phone, lang, env, context);

    // ═══════════════════════════════════════════════════════════════
    // SOCIAL MEDIA (YOUR LOGIC - PRESERVED)
    // ═══════════════════════════════════════════════════════════════

    case 'OPEN_FACEBOOK':
    case 'FACEBOOK':
    case 'FB':
      return withRetry(() => sendCtaUrl(
        phone,
        fromEnglish(
          "📘 *Follow us on Facebook!*\n\n" +
          "Stay updated with:\n" +
          "✨ Latest designs\n" +
          "🎉 Exclusive offers\n" +
          "💎 Behind-the-scenes",
          lang
        ),
        fromEnglish("📘 Facebook", lang),
        LINKS.facebook,
        env,
        fromEnglish("👍 Like & Follow", lang)
      ));

    case 'OPEN_INSTAGRAM':
    case 'INSTAGRAM':
    case 'INSTA':
    case 'IG':
      return withRetry(() => sendCtaUrl(
        phone,
        fromEnglish(
          "📸 *Follow us on Instagram!*\n\n" +
          "Daily inspiration:\n" +
          "✨ Styling tips\n" +
          "🆕 First look at new arrivals\n" +
          "💎 Customer spotlights",
          lang
        ),
        fromEnglish("📸 Instagram", lang),
        LINKS.instagram,
        env,
        fromEnglish("📲 Follow for inspiration", lang)
      ));

    // ═══════════════════════════════════════════════════════════════
    // LANGUAGE SELECTION
    // ═══════════════════════════════════════════════════════════════

    case 'CHANGE_LANGUAGE':
    case 'LANGUAGE':
    case 'LANG':
      return withRetry(() => sendLanguageMenu(phone, env));

    case 'LANG_EN':
    case 'ENGLISH':
      await setCustomerLanguage(phone, 'en', env);
      contextManager.invalidate(phone);
      await sendText(phone, '✅ Language set to English', env);
      return sendMainMenu(phone, 'en', env);

    case 'LANG_HI':
    case 'HINDI':
      await setCustomerLanguage(phone, 'hi', env);
      contextManager.invalidate(phone);
      await sendText(phone, '✅ भाषा हिंदी में सेट की गई', env);
      return sendMainMenu(phone, 'hi', env);

    case 'LANG_KN':
    case 'KANNADA':
      await setCustomerLanguage(phone, 'kn', env);
      contextManager.invalidate(phone);
      await sendText(phone, '✅ ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಹೊಂದಿಸಲಾಗಿದೆ', env);
      return sendMainMenu(phone, 'kn', env);

    // ═══════════════════════════════════════════════════════════════
    // ORDER FLOW
    // ═══════════════════════════════════════════════════════════════

    case 'START_ORDER':
    case 'BEGIN_ORDER':
    case 'NEW_ORDER':
    case 'ORDER':
    case 'BUY':
    case 'PURCHASE':
      return handleStartOrderButton(phone, lang, env, context);

    case 'CONFIRM_ORDER':
    case 'PLACE_ORDER':
    case 'SUBMIT_ORDER':
      return handleConfirmOrderButton(phone, lang, env, context);

    case 'CANCEL_ORDER':
    case 'CANCEL':
      return handleCancelOrderButton(phone, lang, env);

    case 'MODIFY_ORDER':
    case 'EDIT_ORDER':
    case 'CHANGE_ORDER':
      return handleModifyOrderButton(phone, lang, env);

    case 'VIEW_CART':
    case 'CART':
    case 'MY_CART':
      return handleViewCartButton(phone, lang, env, context);

    case 'CLEAR_CART':
    case 'EMPTY_CART':
      return handleClearCartButton(phone, lang, env);

    // ═══════════════════════════════════════════════════════════════
    // PRODUCT CATEGORIES
    // ═══════════════════════════════════════════════════════════════

    case 'CAT_EARRINGS':
    case 'EARRINGS':
      return handleCategoryButton('earrings', 'Earrings', phone, lang, env);

    case 'CAT_NECKLACES':
    case 'NECKLACES':
      return handleCategoryButton('necklaces', 'Necklaces', phone, lang, env);

    case 'CAT_BANGLES':
    case 'BANGLES':
      return handleCategoryButton('bangles', 'Bangles', phone, lang, env);

    case 'CAT_RINGS':
    case 'RINGS':
      return handleCategoryButton('rings', 'Rings', phone, lang, env);

    case 'CAT_PENDANTS':
    case 'PENDANTS':
      return handleCategoryButton('pendants', 'Pendants', phone, lang, env);

    case 'CAT_BRACELETS':
    case 'BRACELETS':
      return handleCategoryButton('bracelets', 'Bracelets', phone, lang, env);

    case 'ALL_CATEGORIES':
    case 'CATEGORIES':
    case 'BROWSE_CATEGORIES':
      return withRetry(() => sendCategoryMenu(phone, lang, env));

    // ═══════════════════════════════════════════════════════════════
    // QUICK ACTIONS
    // ═══════════════════════════════════════════════════════════════

    case 'YES':
    case 'CONFIRM':
    case 'OK':
    case 'ACCEPT':
      return handleYesButton(phone, lang, env, context);

    case 'NO':
    case 'DENY':
    case 'REJECT':
    case 'DECLINE':
      return handleNoButton(phone, lang, env, context);

    // ═══════════════════════════════════════════════════════════════
    // REVIEW & FEEDBACK
    // ═══════════════════════════════════════════════════════════════

    case 'GIVE_REVIEW':
    case 'REVIEW':
    case 'FEEDBACK':
    case 'RATE_US':
      return withRetry(() => sendCtaUrl(
        phone,
        fromEnglish(
          "⭐ *Love KAAPAV?* ⭐\n\n" +
          "Your review helps us serve you better!\n\n" +
          "Share your experience and help other jewellery lovers discover KAAPAV 💎",
          lang
        ),
        fromEnglish("⭐ Write Review", lang),
        LINKS.googleReview,
        env,
        fromEnglish("🙏 Thank you!", lang)
      ));

    // ═══════════════════════════════════════════════════════════════
    // POLICIES & INFO
    // ═══════════════════════════════════════════════════════════════

    case 'RETURN_POLICY':
    case 'RETURNS':
      return withRetry(() => sendText(
        phone,
        fromEnglish(
          "↩️ *KAAPAV Return Policy*\n\n" +
          "📅 *7-Day Easy Returns*\n\n" +
          "✅ Product must be unused\n" +
          "✅ Original packaging required\n" +
          "✅ Tags must be intact\n\n" +
          "📞 To initiate return:\n" +
          "Reply with your Order ID\n\n" +
          "💡 Refund within 7-10 business days",
          lang
        ),
        env
      ));

    case 'SHIPPING_INFO':
    case 'DELIVERY_INFO':
      return withRetry(() => sendText(
        phone,
        fromEnglish(
          "🚚 *KAAPAV Shipping Info*\n\n" +
          "📦 *Delivery Time:* 3-5 business days\n" +
          "🌍 *Coverage:* Pan India\n\n" +
          "💰 *Shipping Charges:*\n" +
          "• Orders above ₹498: FREE 🎉\n" +
          "• Below ₹498: ₹49\n\n" +
          "📍 We ship via trusted partners:\n" +
          "Shiprocket, Delhivery, BlueDart",
          lang
        ),
        env
      ));

    case 'ABOUT_US':
    case 'ABOUT':
      return withRetry(() => sendText(
        phone,
        fromEnglish(
          "👑 *About KAAPAV*\n\n" +
          "KAAPAV Fashion Jewellery brings you handcrafted elegance at affordable prices.\n\n" +
          "✨ *Our Promise:*\n" +
          "• Premium quality materials\n" +
          "• Handpicked designs\n" +
          "• Skin-friendly & hypoallergenic\n" +
          "• 10,000+ happy customers\n\n" +
          "💎 *Crafted Elegance • Timeless Sparkle*\n\n" +
          "🌐 kaapav.com",
          lang
        ),
        env
      ));

    // ═══════════════════════════════════════════════════════════════
    // DEFAULT / UNKNOWN BUTTONS
    // ═══════════════════════════════════════════════════════════════

    default:
      console.log(`[Button] ⚠️ Unknown button: ${id}`);
      
      // Check for dynamic button patterns
      if (id.startsWith('PROD_')) {
        return handleProductButton(id, phone, lang, env);
      }
      
      if (id.startsWith('ORDER_')) {
        return handleOrderButton(id, phone, lang, env);
      }
      
      if (id.startsWith('TRACK_')) {
        const orderId = id.replace('TRACK_', '');
        return handleTrackSpecificOrder(orderId, phone, lang, env, context);
      }
      
      if (id.startsWith('CAT_')) {
        const category = id.replace('CAT_', '').toLowerCase();
        return handleCategoryButton(category, category, phone, lang, env);
      }

      if (id.startsWith('VARIANT_')) {
        return handleVariantButton(id, phone, lang, env, context);
      }

      if (id.startsWith('QTY_')) {
        return handleQuantityButton(id, phone, lang, env, context);
      }

      // Smart fallback: suggest relevant options
      return handleUnknownButton(id, phone, lang, env, context);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function setCustomerLanguage(phone, lang, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO customers (phone, language, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(phone) DO UPDATE SET 
        language = excluded.language,
        updated_at = datetime('now')
    `).bind(phone, lang).run();
    
    // Invalidate cache
    buttonCache.invalidate(phone);
  } catch (e) {
    console.warn('[Button] Set language failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK ORDER BUTTON (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────

async function handleTrackOrderButton(phone, lang, env, context) {
  // Check cache first
  const cacheKey = buttonCache.generateKey('orders', phone);
  let orders = buttonCache.get(cacheKey);

  if (!orders) {
    try {
      const result = await env.DB.prepare(`
        SELECT order_id, status, total, created_at, tracking_id, 
               shipping_carrier, estimated_delivery
        FROM orders 
        WHERE phone = ? 
        ORDER BY created_at DESC 
        LIMIT 5
      `).bind(phone).all();
      
      orders = result.results || [];
      buttonCache.set(cacheKey, orders, CONFIG.CACHE.ORDERS_TTL_SECONDS);
    } catch (e) {
      console.warn('[Button] Get orders failed:', e.message);
      orders = [];
    }
  }

  if (orders.length > 0) {
    let message = await fromEnglish("📦 *Your Recent Orders:*\n\n", lang);
    
    for (const order of orders) {
      const statusEmoji = getStatusEmoji(order.status);
      const statusText = await getStatusText(order.status, lang);
      
      message += `${statusEmoji} *${order.order_id}*\n`;
      message += `   📋 ${statusText}\n`;
      message += `   💰 ₹${order.total}\n`;
      
      if (order.tracking_id) {
        message += `   📦 AWB: ${order.tracking_id}\n`;
      }
      
      if (order.estimated_delivery) {
        const estDate = new Date(order.estimated_delivery).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short'
        });
        message += `   🗓️ Est: ${estDate}\n`;
      }
      
      message += `\n`;
    }
    
    message += await fromEnglish("Reply with Order ID for detailed tracking", lang);
    
    // Build dynamic buttons based on orders
    const buttons = [];
    
    if (orders[0].tracking_id) {
      buttons.push({ id: `TRACK_${orders[0].order_id}`, title: `📦 Track ${orders[0].order_id.slice(-6)}` });
    }
    buttons.push({ id: 'CHAT_NOW', title: '💬 Need Help?' });
    buttons.push({ id: 'MAIN_MENU', title: '🏠 Home' });
    
    return sendReplyButtons(phone, message, buttons.slice(0, 3), env);
  }

  // No orders found - show tracking link
  return sendCtaUrl(
    phone,
    await fromEnglish(
      "📦 *Track Your KAAPAV Order* 📦\n\n" +
      "No recent orders found in our system.\n\n" +
      "If you have an AWB/Tracking number,\n" +
      "you can track directly on Shiprocket\n\n" +
      "Or reply with your Order ID\n" +
      "(Format: KAA-XXXXXX)",
      lang
    ),
    await fromEnglish("📦 Track Now", lang),
    LINKS.shiprocket,
    env,
    await fromEnglish("🚚 Delivered with love", lang)
  );
}

async function handleTrackSpecificOrder(orderId, phone, lang, env, context) {
  // Check cache
  const cacheKey = buttonCache.generateKey('order', orderId);
  let order = buttonCache.get(cacheKey);

  if (!order) {
    try {
      order = await env.DB.prepare(`
        SELECT * FROM orders WHERE order_id = ?
      `).bind(orderId).first();
      
      if (order) {
        buttonCache.set(cacheKey, order, CONFIG.CACHE.ORDERS_TTL_SECONDS);
      }
    } catch (e) {
      console.error('[Button] Track order error:', e.message);
    }
  }

  if (!order) {
    return sendReplyButtons(phone, 
      await fromEnglish(
        `❌ Order *${orderId}* not found.\n\n` +
        `Please check the order ID and try again.\n\n` +
        `Need help? Chat with our team!`,
        lang
      ),
      [
        { id: 'CHAT_NOW', title: '💬 Chat with Us' },
        { id: 'TRACK_ORDER', title: '📦 Try Again' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ],
      env
    );
  }

  const statusEmoji = getStatusEmoji(order.status);
  const statusText = await getStatusText(order.status, lang);
  const progress = getOrderProgress(order.status);
  
  let message = `${statusEmoji} *Order: ${orderId}*\n\n`;
  message += `📋 Status: ${statusText}\n`;
  message += `${progress}\n\n`;
  message += `💰 Total: ₹${order.total}\n`;
  message += `📅 Placed: ${new Date(order.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  })}\n`;
  
  if (order.tracking_id) {
    message += `\n📦 *Tracking Details:*\n`;
    message += `AWB: ${order.tracking_id}\n`;
    if (order.shipping_carrier) {
      message += `Carrier: ${order.shipping_carrier}\n`;
    }
    if (order.estimated_delivery) {
      message += `Est. Delivery: ${new Date(order.estimated_delivery).toLocaleDateString('en-IN')}\n`;
    }
  }

  const buttons = [];
  
  if (order.tracking_id) {
    buttons.push({ id: 'VIEW_TRACKING', title: '🔗 Live Tracking' });
  }
  buttons.push({ id: 'CHAT_NOW', title: '💬 Need Help?' });
  buttons.push({ id: 'MAIN_MENU', title: '🏠 Home' });

  return sendReplyButtons(phone, message, buttons.slice(0, 3), env);
}

function getStatusEmoji(status) {
  const emojis = {
    'pending': '⏳',
    'confirmed': '✅',
    'processing': '⚙️',
    'packed': '📦',
    'shipped': '🚚',
    'in_transit': '🛣️',
    'out_for_delivery': '🏃',
    'delivered': '🎉',
    'cancelled': '❌',
    'returned': '↩️',
    'refunded': '💸',
    'failed': '⚠️'
  };
  return emojis[status?.toLowerCase()] || '📦';
}

async function getStatusText(status, lang) {
  const statusTexts = {
    'pending': 'Payment Pending',
    'confirmed': 'Order Confirmed',
    'processing': 'Processing',
    'packed': 'Packed & Ready',
    'shipped': 'Shipped',
    'in_transit': 'In Transit',
    'out_for_delivery': 'Out for Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
    'returned': 'Returned',
    'refunded': 'Refunded',
    'failed': 'Failed'
  };
  return await fromEnglish(statusTexts[status?.toLowerCase()] || status, lang);
}

function getOrderProgress(status) {
  const stages = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const currentIndex = stages.indexOf(status?.toLowerCase());
  
  if (currentIndex === -1) return '';
  
  const progress = stages.map((stage, i) => {
    if (i < currentIndex) return '✅';
    if (i === currentIndex) return '🔵';
    return '⚪';
  });
  
  return progress.join('─');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT NOW BUTTON (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────

async function handleChatNowButton(phone, lang, env, context) {
  // Mark chat for agent attention with priority scoring
  try {
    const priority = calculateChatPriority(context);
    const labels = ['human-requested'];
    
    if (context?.hasActiveCart) labels.push('has-cart');
    if (context?.hasPendingOrders) labels.push('has-pending-orders');
    if (context?.isReturningCustomer) labels.push('returning-customer');
    
    await env.DB.prepare(`
      INSERT INTO chats (phone, needs_attention, priority, labels, updated_at, created_at)
      VALUES (?, 1, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(phone) DO UPDATE SET 
        needs_attention = 1,
        priority = excluded.priority,
        labels = excluded.labels,
        updated_at = datetime('now')
    `).bind(phone, priority, JSON.stringify(labels)).run();
    
    // Also create a support ticket
    await env.DB.prepare(`
      INSERT INTO support_tickets (phone, status, priority, created_at)
      VALUES (?, 'open', ?, datetime('now'))
    `).bind(phone, priority).run();
    
  } catch (e) {
    console.warn('[Button] Update chat failed:', e.message);
  }

  // Build personalized response
  let message = "💬 *Great! Our team is here for you!* 💬\n\n";
  
  if (context?.customer?.name) {
    message = `💬 *Hi ${context.customer.name}! We're here to help!* 💬\n\n`;
  }
  
  message += "Please share your query, and we'll assist you promptly.\n\n";
  
  // Add context-aware suggestions
  if (context?.hasActiveCart) {
    message += "💡 I see you have items in your cart. Need help with checkout?\n\n";
  }
  
  if (context?.hasPendingOrders) {
    message += "📦 You have orders in progress. Need an update?\n\n";
  }
  
  message += "💎 Average response: 10-15 minutes\n" +
    "⏰ Available: 9 AM - 9 PM IST\n\n" +
    "You can also:\n" +
    "📞 Call: +91 91483 30016\n" +
    "📧 Email: support@kaapav.com";

  return sendText(phone, await fromEnglish(message, lang), env);
}

function calculateChatPriority(context) {
  let score = 0;
  
  if (context?.hasActiveCart) score += 3;
  if (context?.cart?.total > 1000) score += 2;
  if (context?.hasPendingOrders) score += 2;
  if (context?.isReturningCustomer) score += 1;
  if (context?.customer?.total_spent > 5000) score += 2;
  
  if (score >= 6) return 'urgent';
  if (score >= 4) return 'high';
  if (score >= 2) return 'normal';
  return 'low';
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER FLOW BUTTONS (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────

async function handleStartOrderButton(phone, lang, env, context) {
  // Check if there's an active cart
  if (context?.hasActiveCart && context.cart.items.length > 0) {
    const itemCount = context.cart.item_count || context.cart.items.length;
    const total = context.cart.total;
    
    return sendReplyButtons(
      phone,
      await fromEnglish(
        `🛒 *You have ${itemCount} item(s) in your cart!*\n\n` +
        `💰 Total: ₹${total}\n\n` +
        `Would you like to continue with this cart or start fresh?`,
        lang
      ),
      [
        { id: 'CONFIRM_ORDER', title: '✅ Checkout Now' },
        { id: 'VIEW_CART', title: '👁️ View Cart' },
        { id: 'CLEAR_CART', title: '🔄 Start Fresh' }
      ],
      env
    );
  }

  const { handleOrderFlow } = await import('./orderHandler.js');
  return handleOrderFlow('START', phone, {}, lang, env);
}

async function handleConfirmOrderButton(phone, lang, env, context) {
  // Validate cart before proceeding
  if (!context?.hasActiveCart) {
    return sendReplyButtons(
      phone,
      await fromEnglish(
        "🛒 *Your cart is empty!*\n\n" +
        "Browse our catalog to add items.",
        lang
      ),
      [
        { id: 'OPEN_CATALOG', title: '📱 Browse Catalog' },
        { id: 'BESTSELLERS', title: '🏆 Bestsellers' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ],
      env
    );
  }

  const { handleOrderFlow } = await import('./orderHandler.js');
  return handleOrderFlow('CONFIRM', phone, {}, lang, env);
}

async function handleCancelOrderButton(phone, lang, env) {
  // Clear conversation state
  try {
    await env.DB.prepare(`
      DELETE FROM conversation_state WHERE phone = ?
    `).bind(phone).run();
    
    contextManager.invalidate(phone);
  } catch (e) {
    console.warn('[Button] Clear state failed:', e.message);
  }

  return sendReplyButtons(
    phone,
    await fromEnglish(
      "❌ *Order Cancelled*\n\n" +
      "No worries! Your cart items are saved.\n" +
      "Come back anytime to complete your order 💎",
      lang
    ),
    [
      { id: 'START_ORDER', title: '🛒 New Order' },
      { id: 'OPEN_CATALOG', title: '📱 Catalog' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    env
  );
}

async function handleModifyOrderButton(phone, lang, env) {
  return sendReplyButtons(
    phone,
    await fromEnglish(
      "✏️ *Modify Your Order*\n\n" +
      "What would you like to change?",
      lang
    ),
    [
      { id: 'VIEW_CART', title: '🛒 View Cart' },
      { id: 'CLEAR_CART', title: '🗑️ Clear Cart' },
      { id: 'START_ORDER', title: '🔄 Start Over' }
    ],
    env
  );
}

async function handleViewCartButton(phone, lang, env, context) {
  // Use context if available
  const cart = context?.cart;
  
  if (!cart || !cart.items || cart.items.length === 0) {
    return sendReplyButtons(
      phone,
      await fromEnglish(
        "🛒 *Your Cart is Empty*\n\n" +
        "Add some beautiful pieces to your cart!",
        lang
      ),
      [
        { id: 'OPEN_CATALOG', title: '📱 Browse Catalog' },
        { id: 'BESTSELLERS', title: '🏆 Bestsellers' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ],
      env
    );
  }

  let message = await fromEnglish("🛒 *Your Cart*\n\n", lang);
  
  cart.items.forEach((item, index) => {
    message += `${index + 1}. *${item.name}*\n`;
    message += `   Qty: ${item.quantity || 1} × ₹${item.price}\n`;
    if (item.variant) {
      message += `   Variant: ${item.variant}\n`;
    }
    message += `\n`;
  });
  
  // Add pricing breakdown
  const subtotal = cart.total;
  const shipping = subtotal >= 498 ? 0 : 49;
  const grandTotal = subtotal + shipping;
  
  message += `───────────────\n`;
  message += `💵 Subtotal: ₹${subtotal}\n`;
  message += `🚚 Shipping: ${shipping === 0 ? 'FREE! 🎉' : `₹${shipping}`}\n`;
  message += `───────────────\n`;
  message += `💰 *Total: ₹${grandTotal}*`;
  
  if (subtotal < 498) {
    const remaining = 498 - subtotal;
    message += `\n\n💡 Add ₹${remaining} more for FREE shipping!`;
  }

  return sendReplyButtons(phone, message, [
    { id: 'CONFIRM_ORDER', title: '✅ Checkout' },
    { id: 'CLEAR_CART', title: '🗑️ Clear' },
    { id: 'OPEN_CATALOG', title: '➕ Add More' }
  ], env);
}

async function handleClearCartButton(phone, lang, env) {
  try {
    await env.DB.prepare(`
      UPDATE carts SET status = 'cleared', items = '[]', total = 0, item_count = 0
      WHERE phone = ? AND status = 'active'
    `).bind(phone).run();
    
    contextManager.invalidate(phone);
    buttonCache.invalidate(phone);
  } catch (e) {
    console.warn('[Button] Clear cart failed:', e.message);
  }

  return sendReplyButtons(
    phone,
    await fromEnglish("🗑️ *Cart Cleared*\n\nReady to start fresh!", lang),
    [
      { id: 'OPEN_CATALOG', title: '📱 Browse Catalog' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    env
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY BUTTONS (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────

async function handleCategoryButton(categorySlug, categoryName, phone, lang, env) {
  // Check cache
  const cacheKey = buttonCache.generateKey('category', categorySlug);
  let products = buttonCache.get(cacheKey);

  if (!products) {
    try {
      const result = await env.DB.prepare(`
        SELECT product_id, name, price, sale_price, image_url, rating
        FROM products 
        WHERE category = ? AND is_active = 1 
        ORDER BY order_count DESC, rating DESC
        LIMIT 10
      `).bind(categorySlug).all();
      
      products = result.results || [];
      buttonCache.set(cacheKey, products, CONFIG.CACHE.PRODUCTS_TTL_SECONDS);
    } catch (e) {
      console.warn('[Button] Get products failed:', e.message);
      products = [];
    }
  }

  if (products.length > 0) {
    // Try WhatsApp product list first
    try {
      return await sendProductList(
        phone,
        [{
          title: categoryName,
          products: products.map(p => ({ product_retailer_id: p.product_id }))
        }],
        `💎 ${categoryName.toUpperCase()}`,
        `Explore our ${categoryName.toLowerCase()} collection`,
        env
      );
    } catch {
      // Fallback to text list with prices and ratings
      let message = `💎 *${categoryName}*\n\n`;
      
      products.forEach((p, i) => {
        const displayPrice = p.sale_price || p.price;
        const hasDiscount = p.sale_price && p.sale_price < p.price;
        const ratingStars = p.rating ? '⭐'.repeat(Math.round(p.rating)) : '';
        
        message += `${i + 1}. *${p.name}*\n`;
        message += `   💰 ₹${displayPrice}`;
        if (hasDiscount) {
          const discount = Math.round((1 - p.sale_price / p.price) * 100);
          message += ` ~~₹${p.price}~~ (${discount}% OFF)`;
        }
        if (ratingStars) message += `\n   ${ratingStars}`;
        message += `\n\n`;
      });
      
      message += `📱 View full collection in our catalog`;
      
      return sendReplyButtons(phone, message, [
        { id: 'OPEN_CATALOG', title: '📱 Open Catalog' },
        { id: 'START_ORDER', title: '🛒 Order Now' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ], env);
    }
  }

  // Fallback to catalog link
  return sendCtaUrl(
    phone,
    await fromEnglish(
      `💎 *${categoryName} Collection* 💎\n\n` +
      `Explore our beautiful ${categoryName.toLowerCase()} designs!\n` +
      `✨ Premium quality\n` +
      `🚚 Free shipping above ₹498`,
      lang
    ),
    await fromEnglish(`📱 View ${categoryName}`, lang),
    `${LINKS.website}/shop/category/${categorySlug}`,
    env
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC BUTTON HANDLERS (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────

async function handleProductButton(buttonId, phone, lang, env) {
  const productId = buttonId.replace('PROD_', '');
  
  // Check cache
  const cacheKey = buttonCache.generateKey('product', productId);
  let product = buttonCache.get(cacheKey);

  if (!product) {
    try {
      product = await env.DB.prepare(`
        SELECT * FROM products WHERE product_id = ? AND is_active = 1
      `).bind(productId).first();
      
      if (product) {
        buttonCache.set(cacheKey, product, CONFIG.CACHE.PRODUCTS_TTL_SECONDS);
      }
    } catch (e) {
      console.warn('[Button] Get product failed:', e.message);
    }
  }

  if (product) {
    // Try to send product from catalog
    try {
      return await sendProduct(phone, productId, 
        `✨ ${product.name}\n💰 ₹${product.sale_price || product.price}`, env);
    } catch {
      // Rich fallback message
      const displayPrice = product.sale_price || product.price;
      const hasDiscount = product.sale_price && product.sale_price < product.price;
      
      let message = `✨ *${product.name}*\n\n`;
      message += `💰 Price: ₹${displayPrice}`;
      
      if (hasDiscount) {
        const discount = Math.round((1 - product.sale_price / product.price) * 100);
        message += ` ~~₹${product.price}~~ (${discount}% OFF!)`;
      }
      message += `\n`;
      
      if (product.description) {
        message += `\n${product.description}\n`;
      }
      
      if (product.rating) {
        message += `\n⭐ Rating: ${product.rating}/5`;
      }
      
      if (product.stock_quantity <= 5 && product.stock_quantity > 0) {
        message += `\n⚠️ Only ${product.stock_quantity} left!`;
      }
      
      message += `\n\n🛒 Reply "order" to purchase`;
      
      return sendReplyButtons(phone, message, [
        { id: 'START_ORDER', title: '🛒 Order Now' },
        { id: 'OPEN_CATALOG', title: '📱 More Items' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ], env);
    }
  }

  return sendCtaUrl(phone, 
    await fromEnglish('View this product in our catalog', lang), 
    '📱 Catalog', LINKS.whatsappCatalog, env);
}

async function handleOrderButton(buttonId, phone, lang, env) {
  const orderId = buttonId.replace('ORDER_', '');
  return handleTrackSpecificOrder(orderId, phone, lang, env, null);
}

async function handleVariantButton(buttonId, phone, lang, env, context) {
  const [, productId, variant] = buttonId.split('_');
  
  // Add to cart with variant
  try {
    const { addToCart } = await import('./cartHandler.js');
    await addToCart(phone, productId, 1, { variant }, env);
    
    contextManager.invalidate(phone);
    
    return sendReplyButtons(
      phone,
      await fromEnglish(
        `✅ *Added to cart!*\n\nVariant: ${variant}\n\nWhat's next?`,
        lang
      ),
      [
        { id: 'VIEW_CART', title: '🛒 View Cart' },
        { id: 'CONFIRM_ORDER', title: '✅ Checkout' },
        { id: 'OPEN_CATALOG', title: '➕ Continue Shopping' }
      ],
      env
    );
  } catch (e) {
    console.error('[Button] Add variant failed:', e.message);
    return sendText(phone, 
      await fromEnglish('Unable to add item. Please try again.', lang), env);
  }
}

async function handleQuantityButton(buttonId, phone, lang, env, context) {
  const [, productId, quantity] = buttonId.split('_');
  
  try {
    const { updateCartQuantity } = await import('./cartHandler.js');
    await updateCartQuantity(phone, productId, parseInt(quantity), env);
    
    contextManager.invalidate(phone);
    
    return handleViewCartButton(phone, lang, env, null);
  } catch (e) {
    console.error('[Button] Update quantity failed:', e.message);
    return sendText(phone, 
      await fromEnglish('Unable to update quantity. Please try again.', lang), env);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YES/NO CONFIRMATION HANDLERS (ENHANCED)
// ─────────────────────────────────────────────────────────────────────────────

async function handleYesButton(phone, lang, env, context) {
  // Check for active flow from context
  const state = context?.conversationState;
  
  if (state?.current_flow === 'order') {
    const { handleOrderFlow } = await import('./orderHandler.js');
    return handleOrderFlow('CONFIRM', phone, {}, lang, env);
  }
  
  if (state?.current_flow === 'return') {
    const { handleReturnFlow } = await import('./returnHandler.js');
    return handleReturnFlow('CONFIRM', phone, state.data || {}, lang, env);
  }
  
  if (state?.current_flow === 'cancel') {
    const { handleCancellationFlow } = await import('./cancelHandler.js');
    return handleCancellationFlow('CONFIRM', phone, state.data || {}, lang, env);
  }

  return sendMainMenu(phone, lang, env);
}

async function handleNoButton(phone, lang, env, context) {
  const state = context?.conversationState;
  
  if (state?.current_flow) {
    // Clear state
    try {
      await env.DB.prepare(`
        DELETE FROM conversation_state WHERE phone = ?
      `).bind(phone).run();
      
      contextManager.invalidate(phone);
    } catch (e) {
      console.warn('[Button] Clear state failed:', e.message);
    }
    
    return sendReplyButtons(
      phone,
      await fromEnglish("No problem! Is there anything else I can help you with?", lang),
      [
        { id: 'OPEN_CATALOG', title: '📱 Browse' },
        { id: 'CHAT_NOW', title: '💬 Support' },
        { id: 'MAIN_MENU', title: '🏠 Home' }
      ],
      env
    );
  }

  return sendMainMenu(phone, lang, env);
}

// ─────────────────────────────────────────────────────────────────────────────
// UNKNOWN BUTTON HANDLER (SMART FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────

async function handleUnknownButton(buttonId, phone, lang, env, context) {
  // Log for analysis
  try {
    await env.DB.prepare(`
      INSERT INTO unknown_buttons (button_id, phone, context, timestamp)
      VALUES (?, ?, ?, datetime('now'))
    `).bind(buttonId, phone, JSON.stringify(context || {})).run();
  } catch (e) {
    console.warn('[Button] Log unknown button failed:', e.message);
  }

  // Get smart suggestions
  let suggestions = null;
  if (CONFIG.FEATURES.SMART_SUGGESTIONS) {
    suggestions = await suggestionEngine.getSuggestions(phone, buttonId, env);
  }

  // Build helpful response
  let message = await fromEnglish(
    "🤔 *I'm not sure what that means.*\n\n" +
    "Here are some things I can help you with:",
    lang
  );

  const buttons = [];

  if (context?.hasActiveCart) {
    buttons.push({ id: 'VIEW_CART', title: '🛒 View Cart' });
  }

  if (suggestions && suggestions.length > 0) {
    buttons.push({ id: suggestions[0].buttonId, title: getButtonLabel(suggestions[0].buttonId) });
  }

  if (buttons.length < 3) {
    if (!buttons.find(b => b.id === 'MAIN_MENU')) {
      buttons.push({ id: 'MAIN_MENU', title: '🏠 Main Menu' });
    }
    if (!buttons.find(b => b.id === 'CHAT_NOW')) {
      buttons.push({ id: 'CHAT_NOW', title: '💬 Chat with Us' });
    }
  }

  return sendReplyButtons(phone, message, buttons.slice(0, 3), env);
}

function getButtonLabel(buttonId) {
  const labels = {
    'MAIN_MENU': '🏠 Main Menu',
    'JEWELLERY_MENU': '💎 Browse Jewellery',
    'OFFERS_MENU': '🎁 Offers',
    'TRACK_ORDER': '📦 Track Order',
    'CHAT_NOW': '💬 Chat with Us',
    'OPEN_CATALOG': '📱 Catalog',
    'BESTSELLERS': '🏆 Bestsellers',
    'VIEW_CART': '🛒 Cart'
  };
  return labels[buttonId] || buttonId.replace(/_/g, ' ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS FOR EXTERNAL USE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  handleButtonClick,
  buttonCache,
  analytics,
  perfMonitor,
  rateLimiter,
  contextManager,
  suggestionEngine,
  buttonNormalizer,
  CONFIG
};

// Export utility functions for testing
export const __test__ = {
  getStatusEmoji,
  getStatusText,
  getOrderProgress,
  calculateChatPriority,
  getButtonLabel,
  withRetry
};

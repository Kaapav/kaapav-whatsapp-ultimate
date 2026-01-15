/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - AI HANDLER
 * ═══════════════════════════════════════════════════════════════
 * OpenAI GPT Integration for smart responses
 * ═══════════════════════════════════════════════════════════════
 */

import { sendText, sendReplyButtons, sendMainMenu, LINKS } from '../utils/sendMessage.js';
import { fromEnglish } from '../utils/translate.js';

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT FOR KAAPAV
// ═══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are KAAPAV's friendly WhatsApp assistant for a fashion jewellery brand in India.

ABOUT KAAPAV:
- Premium fashion jewellery brand
- Products: Earrings, Necklaces, Bangles, Rings, Pendants
- Price range: ₹99 - ₹1999
- Free shipping above ₹498
- No COD available (prepaid only via UPI/Cards)
- Delivery: 3-5 business days pan India
- 7-day easy returns

YOUR PERSONALITY:
- Warm, friendly, professional
- Use emojis appropriately (💎✨👑🛍️)
- Keep responses concise (under 200 words)
- Always be helpful and positive
- Speak like a luxury brand assistant

CAPABILITIES:
- Answer product questions
- Help with order inquiries
- Provide shipping/return info
- Guide to catalog/website
- Handle complaints with empathy

LINKS TO SHARE:
- Website: https://www.kaapav.com
- Catalog: https://wa.me/c/919148330016
- Payment: https://razorpay.me/@kaapav
- Tracking: https://www.shiprocket.in/shipment-tracking/

IMPORTANT RULES:
1. Never make up product prices or availability
2. For specific orders, ask for Order ID (format: KAA-XXXXXX)
3. For complaints, empathize and offer to connect with support
4. Don't discuss competitors
5. If unsure, offer to connect with human support

Respond in the same language the customer uses (English, Hindi, or Kannada).`;

// ═══════════════════════════════════════════════════════════════
// MAIN AI HANDLER
// ═══════════════════════════════════════════════════════════════

/**
 * Handle AI-powered response
 * @param {string} text - User's message
 * @param {string} phone - User's phone number
 * @param {string} lang - User's language preference
 * @param {object} env - Environment bindings
 * @returns {boolean} - True if handled, false to continue normal flow
 */
export async function handleAIResponse(text, phone, lang, env) {
  // Check if AI is enabled
  if (!env.OPENAI_API_KEY) {
    console.log('[AI] ⚠️ OpenAI not configured');
    return false;
  }

  // Skip AI for very short messages or commands
  if (text.length < 5 || text.startsWith('/')) {
    return false;
  }

  // Check if message is a clear menu request
  const menuKeywords = ['menu', 'hi', 'hello', 'start', 'home'];
  if (menuKeywords.includes(text.toLowerCase().trim())) {
    return false;
  }

  try {
    console.log(`[AI] 🤖 Processing: "${text.slice(0, 50)}..."`);

    // Get conversation context
    const context = await getConversationContext(phone, env);

    // Get AI response
    const aiResponse = await getAIResponse(text, context, lang, env);

    if (!aiResponse) {
      console.log('[AI] No response generated');
      return false;
    }

    // Detect intent for analytics
    const intent = detectIntent(text, aiResponse);
    
    // Log AI interaction
    await logAIInteraction(phone, text, aiResponse, intent, env);

    // Check if response suggests menu/buttons
    if (shouldShowMenu(aiResponse, intent)) {
      await sendText(phone, aiResponse, env);
      await sendMainMenu(phone, lang, env);
      return true;
    }

    // Check if needs human handoff
    if (needsHumanHandoff(text, aiResponse, intent)) {
      await sendText(phone, aiResponse, env);
      await flagForHumanReview(phone, text, env);
      return true;
    }

    // Send AI response
    await sendText(phone, aiResponse, env);

    // Add helpful buttons based on intent
    const buttons = getContextualButtons(intent, lang);
    if (buttons.length > 0) {
      await sendReplyButtons(
        phone,
        await fromEnglish("Need anything else?", lang),
        buttons,
        env
      );
    }

    return true;

  } catch (error) {
    console.error('[AI] ❌ Error:', error.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// OPENAI API CALL
// ═══════════════════════════════════════════════════════════════

async function getAIResponse(userMessage, context, lang, env) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Add conversation context
  if (context && context.length > 0) {
    context.forEach(msg => {
      messages.push({
        role: msg.direction === 'incoming' ? 'user' : 'assistant',
        content: msg.text
      });
    });
  }

  // Add current message
  messages.push({ role: 'user', content: userMessage });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 300,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('[AI] OpenAI error:', data.error);
      return null;
    }

    const aiText = data.choices?.[0]?.message?.content?.trim();
    
    if (!aiText) {
      console.log('[AI] Empty response');
      return null;
    }

    console.log(`[AI] ✅ Response: "${aiText.slice(0, 50)}..."`);
    return aiText;

  } catch (error) {
    console.error('[AI] API call failed:', error.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT & INTENT DETECTION
// ═══════════════════════════════════════════════════════════════

async function getConversationContext(phone, env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT text, direction FROM messages
      WHERE phone = ? AND text IS NOT NULL AND text != ''
      ORDER BY timestamp DESC
      LIMIT 5
    `).bind(phone).all();

    return results?.reverse() || [];
  } catch {
    return [];
  }
}

function detectIntent(userMessage, aiResponse) {
  const lowerMessage = userMessage.toLowerCase();
  const lowerResponse = aiResponse.toLowerCase();

  // Order related
  if (/order|buy|purchase|checkout|cart/.test(lowerMessage)) {
    return 'order';
  }

  // Tracking
  if (/track|shipping|delivery|where|status|kaa-\d+/i.test(lowerMessage)) {
    return 'tracking';
  }

  // Payment
  if (/pay|payment|upi|card|razorpay|cod/.test(lowerMessage)) {
    return 'payment';
  }

  // Product inquiry
  if (/price|cost|earring|necklace|bangle|ring|pendant|jewel/.test(lowerMessage)) {
    return 'product';
  }

  // Complaint/Issue
  if (/complaint|problem|issue|wrong|damage|broken|refund|return|exchange/.test(lowerMessage)) {
    return 'complaint';
  }

  // Support
  if (/help|support|talk|human|agent|call/.test(lowerMessage)) {
    return 'support';
  }

  // Greeting
  if (/thank|thanks|ok|okay|great|perfect|awesome/.test(lowerMessage)) {
    return 'acknowledgment';
  }

  return 'general';
}

function shouldShowMenu(aiResponse, intent) {
  // Show menu after acknowledgments or greetings
  return intent === 'acknowledgment' || 
         /menu|browse|explore|what.*can.*do/i.test(aiResponse);
}

function needsHumanHandoff(userMessage, aiResponse, intent) {
  // Escalate complaints and explicit support requests
  if (intent === 'complaint' || intent === 'support') {
    return true;
  }

  // Check for frustration keywords
  const frustrationWords = ['angry', 'upset', 'frustrated', 'terrible', 'worst', 'scam', 'fraud', 'cheat'];
  if (frustrationWords.some(word => userMessage.toLowerCase().includes(word))) {
    return true;
  }

  // If AI suggests human handoff
  if (/connect.*team|speak.*agent|human.*support|customer.*care/i.test(aiResponse)) {
    return true;
  }

  return false;
}

function getContextualButtons(intent, lang) {
  const buttonSets = {
    order: [
      { id: 'OPEN_CATALOG', title: '📱 Catalog' },
      { id: 'BESTSELLERS', title: '🏆 Bestsellers' }
    ],
    tracking: [
      { id: 'TRACK_ORDER', title: '📦 Track' },
      { id: 'CHAT_NOW', title: '💬 Support' }
    ],
    payment: [
      { id: 'PAY_NOW', title: '💳 Pay Now' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    product: [
      { id: 'OPEN_CATALOG', title: '📱 View All' },
      { id: 'OPEN_WEBSITE', title: '🌐 Website' }
    ],
    complaint: [
      { id: 'CHAT_NOW', title: '💬 Support' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    support: [
      { id: 'CHAT_NOW', title: '💬 Talk to Us' },
      { id: 'MAIN_MENU', title: '🏠 Home' }
    ],
    general: [
      { id: 'MAIN_MENU', title: '🏠 Menu' }
    ],
    acknowledgment: []
  };

  return buttonSets[intent] || buttonSets.general;
}

// ═══════════════════════════════════════════════════════════════
// LOGGING & FLAGGING
// ═══════════════════════════════════════════════════════════════

async function logAIInteraction(phone, userMessage, aiResponse, intent, env) {
  try {
    await env.DB.prepare(`
      INSERT INTO analytics (event_type, event_name, phone, data, timestamp)
      VALUES ('ai_response', ?, ?, ?, datetime('now'))
    `).bind(intent, phone, JSON.stringify({
      user_message: userMessage.slice(0, 200),
      ai_response: aiResponse.slice(0, 200),
      intent
    })).run();

    // Update message with AI data
    await env.DB.prepare(`
      UPDATE messages SET ai_processed = 1, ai_response = ?, intent = ?
      WHERE phone = ? AND direction = 'incoming'
      ORDER BY timestamp DESC LIMIT 1
    `).bind(aiResponse.slice(0, 500), intent, phone).run();

  } catch (e) {
    console.warn('[AI] Log failed:', e.message);
  }
}

async function flagForHumanReview(phone, message, env) {
  try {
    await env.DB.prepare(`
      UPDATE chats SET 
        needs_attention = 1,
        priority = 'high',
        labels = json_insert(COALESCE(labels, '[]'), '$[#]', 'ai-escalated'),
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(phone).run();

    console.log(`[AI] 🚨 Flagged for human review: ${phone}`);
  } catch (e) {
    console.warn('[AI] Flag failed:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// SENTIMENT ANALYSIS (Lightweight)
// ═══════════════════════════════════════════════════════════════

export function analyzeSentiment(text) {
  const positiveWords = ['thank', 'love', 'great', 'awesome', 'perfect', 'beautiful', 'amazing', 'happy', 'excellent'];
  const negativeWords = ['angry', 'upset', 'bad', 'terrible', 'wrong', 'hate', 'worst', 'problem', 'issue', 'complaint'];
  
  const lowerText = text.toLowerCase();
  let score = 0;

  positiveWords.forEach(word => {
    if (lowerText.includes(word)) score++;
  });

  negativeWords.forEach(word => {
    if (lowerText.includes(word)) score--;
  });

  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════
// SMART SUGGESTIONS
// ═══════════════════════════════════════════════════════════════

export async function getSmartSuggestions(phone, env) {
  try {
    // Get customer data
    const customer = await env.DB.prepare(`
      SELECT * FROM customers WHERE phone = ?
    `).bind(phone).first();

    // Get recent orders
    const recentOrders = await env.DB.prepare(`
      SELECT * FROM orders WHERE phone = ? ORDER BY created_at DESC LIMIT 3
    `).bind(phone).all();

    const suggestions = [];

    // New customer - show bestsellers
    if (!customer || customer.order_count === 0) {
      suggestions.push({
        type: 'bestsellers',
        message: '🏆 Check out our bestsellers!',
        buttonId: 'BESTSELLERS'
      });
    }

    // Has pending payment
    const pendingOrder = recentOrders.results?.find(o => o.payment_status === 'unpaid');
    if (pendingOrder) {
      suggestions.push({
        type: 'payment',
        message: `💳 Complete payment for ${pendingOrder.order_id}`,
        buttonId: `PAY_${pendingOrder.order_id}`
      });
    }

    // Shipped order - suggest tracking
    const shippedOrder = recentOrders.results?.find(o => o.status === 'shipped');
    if (shippedOrder) {
      suggestions.push({
        type: 'tracking',
        message: `📦 Track your order ${shippedOrder.order_id}`,
        buttonId: `TRACK_${shippedOrder.order_id}`
      });
    }

    return suggestions;
  } catch {
    return [];
  }
}
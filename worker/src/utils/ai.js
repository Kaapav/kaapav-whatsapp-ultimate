/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - AI UTILITIES
 * ═══════════════════════════════════════════════════════════════
 * OpenAI helper functions
 * ═══════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// OPENAI API CALL
// ═══════════════════════════════════════════════════════════════

export async function callOpenAI(messages, options = {}, env) {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const {
    model = 'gpt-3.5-turbo',
    maxTokens = 300,
    temperature = 0.7
  } = options;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ═══════════════════════════════════════════════════════════════
// ANALYZE SENTIMENT
// ═══════════════════════════════════════════════════════════════

export async function analyzeSentiment(text, env) {
  if (!env.OPENAI_API_KEY) {
    return simpleSentiment(text);
  }

  try {
    const response = await callOpenAI([
      {
        role: 'system',
        content: 'Analyze the sentiment of the following message. Respond with only one word: positive, negative, or neutral.'
      },
      { role: 'user', content: text }
    ], { maxTokens: 10, temperature: 0 }, env);

    const sentiment = response.toLowerCase().trim();
    if (['positive', 'negative', 'neutral'].includes(sentiment)) {
      return sentiment;
    }
    return 'neutral';
  } catch {
    return simpleSentiment(text);
  }
}

function simpleSentiment(text) {
  const lower = text.toLowerCase();
  const positive = ['thank', 'love', 'great', 'awesome', 'amazing', 'good', 'nice', 'happy', 'excellent'];
  const negative = ['bad', 'worst', 'terrible', 'hate', 'angry', 'disappointed', 'poor', 'fraud', 'scam'];
  
  const posScore = positive.filter(w => lower.includes(w)).length;
  const negScore = negative.filter(w => lower.includes(w)).length;
  
  if (negScore > posScore) return 'negative';
  if (posScore > negScore) return 'positive';
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════
// EXTRACT INTENT
// ═══════════════════════════════════════════════════════════════

export async function extractIntent(text, env) {
  if (!env.OPENAI_API_KEY) {
    return simpleIntent(text);
  }

  try {
    const response = await callOpenAI([
      {
        role: 'system',
        content: 'Classify the intent of this customer message. Respond with only one word from: order, inquiry, complaint, tracking, payment, greeting, thanks, other.'
      },
      { role: 'user', content: text }
    ], { maxTokens: 10, temperature: 0 }, env);

    return response.toLowerCase().trim();
  } catch {
    return simpleIntent(text);
  }
}

function simpleIntent(text) {
  const lower = text.toLowerCase();
  
  if (/\b(order|buy|purchase|checkout)\b/.test(lower)) return 'order';
  if (/\b(track|where|status|delivery)\b/.test(lower)) return 'tracking';
  if (/\b(pay|payment|upi|card)\b/.test(lower)) return 'payment';
  if (/\b(complaint|issue|problem|refund|return)\b/.test(lower)) return 'complaint';
  if (/\b(price|cost|available|stock)\b/.test(lower)) return 'inquiry';
  if (/\b(hi|hello|hey|good morning|good evening)\b/.test(lower)) return 'greeting';
  if (/\b(thank|thanks|thx)\b/.test(lower)) return 'thanks';
  
  return 'other';
}

// ═══════════════════════════════════════════════════════════════
// GENERATE SMART REPLY SUGGESTIONS
// ═══════════════════════════════════════════════════════════════

export async function generateReplySuggestions(customerMessage, context, env) {
  if (!env.OPENAI_API_KEY) {
    return getDefaultSuggestions(customerMessage);
  }

  try {
    const response = await callOpenAI([
      {
        role: 'system',
        content: `You are a helpful assistant for KAAPAV jewellery store. Generate 3 short reply suggestions for the customer message. Return as JSON array of strings, max 50 chars each.`
      },
      { role: 'user', content: `Customer: ${customerMessage}\nContext: ${context || 'None'}` }
    ], { maxTokens: 150, temperature: 0.7 }, env);

    try {
      return JSON.parse(response);
    } catch {
      return getDefaultSuggestions(customerMessage);
    }
  } catch {
    return getDefaultSuggestions(customerMessage);
  }
}

function getDefaultSuggestions(text) {
  const lower = text.toLowerCase();
  
  if (lower.includes('price') || lower.includes('cost')) {
    return [
      'Our prices range from ₹99 to ₹1999',
      'Check our catalog for latest prices',
      'I can help you find products in your budget'
    ];
  }
  
  if (lower.includes('delivery') || lower.includes('shipping')) {
    return [
      'Delivery takes 3-5 business days',
      'Free shipping above ₹498!',
      'Share your order ID for tracking'
    ];
  }
  
  return [
    'How can I help you today?',
    'Would you like to see our catalog?',
    'I\'m here to assist you!'
  ];
}

// ═══════════════════════════════════════════════════════════════
// SUMMARIZE CONVERSATION
// ═══════════════════════════════════════════════════════════════

export async function summarizeConversation(messages, env) {
  if (!env.OPENAI_API_KEY || messages.length < 3) {
    return null;
  }

  try {
    const conversation = messages
      .slice(-10)
      .map(m => `${m.direction === 'incoming' ? 'Customer' : 'Agent'}: ${m.text}`)
      .join('\n');

    const summary = await callOpenAI([
      {
        role: 'system',
        content: 'Summarize this customer conversation in 2-3 sentences. Focus on the main issue/request and current status.'
      },
      { role: 'user', content: conversation }
    ], { maxTokens: 100, temperature: 0.5 }, env);

    return summary;
  } catch {
    return null;
  }
}
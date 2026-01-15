/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - MEDIA HANDLER
 * ═══════════════════════════════════════════════════════════════
 * Handle images, audio, video, documents, stickers
 * ═══════════════════════════════════════════════════════════════
 */

import { 
  sendText, 
  sendReplyButtons, 
  sendReaction,
  normalizeIN,
  LINKS 
} from '../utils/sendMessage.js';
import { fromEnglish } from '../utils/translate.js';

// ═══════════════════════════════════════════════════════════════
// MAIN MEDIA HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleMediaMessage(message, phone, lang, env) {
  const messageType = message.type;
  const normalizedPhone = normalizeIN(phone);
  
  console.log(`[Media] 📎 Type: ${messageType} from ${normalizedPhone}`);

  try {
    switch (messageType) {
      case 'image':
        return await handleImageMessage(message, normalizedPhone, lang, env);
      
      case 'video':
        return await handleVideoMessage(message, normalizedPhone, lang, env);
      
      case 'audio':
        return await handleAudioMessage(message, normalizedPhone, lang, env);
      
      case 'document':
        return await handleDocumentMessage(message, normalizedPhone, lang, env);
      
      case 'sticker':
        return await handleStickerMessage(message, normalizedPhone, lang, env);
      
      default:
        console.log(`[Media] ⚠️ Unknown type: ${messageType}`);
        return await sendText(
          normalizedPhone,
          await fromEnglish("Thanks for sharing! How can I help you today?", lang),
          env
        );
    }
  } catch (error) {
    console.error(`[Media] ❌ Error handling ${messageType}:`, error.message);
    return await sendText(
      normalizedPhone,
      await fromEnglish("Received your file! How can I assist you?", lang),
      env
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// IMAGE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleImageMessage(message, phone, lang, env) {
  const image = message.image;
  const caption = image.caption || '';
  const mediaId = image.id;
  const mimeType = image.mime_type;

  console.log(`[Media] 📷 Image: ${mediaId}, caption: "${caption.slice(0, 50)}"`);

  // Check if in order flow
  const activeFlow = await getConversationState(phone, env);
  
  if (activeFlow?.current_flow === 'order') {
    // User is sharing product image for order
    return await handleProductImage(phone, mediaId, caption, lang, env);
  }

  // React to image
  await sendReaction(phone, message.id, '👀', env).catch(() => {});

  // Save media reference
  await saveMediaReference(phone, mediaId, 'image', mimeType, caption, env);

  // Determine intent from caption
  if (caption) {
    const lowerCaption = caption.toLowerCase();
    
    // Order intent
    if (/order|buy|want|this|price/.test(lowerCaption)) {
      return await sendReplyButtons(
        phone,
        await fromEnglish(
          "📸 *Image received!*\n\n" +
          "I see you're interested in ordering!\n\n" +
          "Please share the product name or browse our catalog to find exact matches.",
          lang
        ),
        [
          { id: 'OPEN_CATALOG', title: '📱 Browse Catalog' },
          { id: 'START_ORDER', title: '🛒 Place Order' },
          { id: 'CHAT_NOW', title: '💬 Ask Support' }
        ],
        env
      );
    }

    // Complaint intent
    if (/damage|broken|wrong|defect|issue|problem/.test(lowerCaption)) {
      // Flag for human review
      await flagForSupport(phone, 'Image complaint received', env);
      
      return await sendText(
        phone,
        await fromEnglish(
          "📸 *Image received*\n\n" +
          "I'm sorry to see there's an issue! 😔\n\n" +
          "Our support team will review this and get back to you shortly.\n\n" +
          "Please also share your Order ID (KAA-XXXXXX) if you have it.",
          lang
        ),
        env
      );
    }
  }

  // Default response for image
  return await sendReplyButtons(
    phone,
    await fromEnglish(
      "📸 *Thanks for the image!*\n\n" +
      "How can I help you with this?\n\n" +
      "💡 Tip: Share product name or catalog item for faster assistance.",
      lang
    ),
    [
      { id: 'START_ORDER', title: '🛒 Order This' },
      { id: 'OPEN_CATALOG', title: '📱 View Catalog' },
      { id: 'CHAT_NOW', title: '💬 Talk to Us' }
    ],
    env
  );
}

async function handleProductImage(phone, mediaId, caption, lang, env) {
  // Update order flow state
  await updateConversationState(phone, 'order', 'product_image', { mediaId, caption }, env);

  return await sendText(
    phone,
    await fromEnglish(
      "📸 *Product image saved!*\n\n" +
      "Please share the product name or SKU so we can add it to your order.\n\n" +
      "Or browse our catalog to find the exact item 👇",
      lang
    ),
    env
  );
}

// ═══════════════════════════════════════════════════════════════
// VIDEO HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleVideoMessage(message, phone, lang, env) {
  const video = message.video;
  const caption = video.caption || '';
  const mediaId = video.id;

  console.log(`[Media] 🎥 Video: ${mediaId}`);

  // React to video
  await sendReaction(phone, message.id, '🎬', env).catch(() => {});

  // Save media reference
  await saveMediaReference(phone, mediaId, 'video', video.mime_type, caption, env);

  // Check for complaint (video evidence)
  if (caption && /damage|broken|wrong|defect|issue|problem/.test(caption.toLowerCase())) {
    await flagForSupport(phone, 'Video complaint received', env);
    
    return await sendText(
      phone,
      await fromEnglish(
        "🎥 *Video received*\n\n" +
        "Thank you for sharing the video. Our team will review this.\n\n" +
        "Please share your Order ID (KAA-XXXXXX) for faster resolution.",
        lang
      ),
      env
    );
  }

  return await sendReplyButtons(
    phone,
    await fromEnglish(
      "🎥 *Video received!*\n\n" +
      "Thanks for sharing! How can I help you?",
      lang
    ),
    [
      { id: 'CHAT_NOW', title: '💬 Talk to Us' },
      { id: 'MAIN_MENU', title: '🏠 Menu' }
    ],
    env
  );
}

// ═══════════════════════════════════════════════════════════════
// AUDIO/VOICE HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleAudioMessage(message, phone, lang, env) {
  const audio = message.audio;
  const mediaId = audio.id;
  const isVoiceNote = audio.voice === true;

  console.log(`[Media] 🎤 Audio: ${mediaId}, voice: ${isVoiceNote}`);

  // React to audio
  await sendReaction(phone, message.id, '🎧', env).catch(() => {});

  // Save media reference
  await saveMediaReference(phone, mediaId, isVoiceNote ? 'voice' : 'audio', audio.mime_type, '', env);

  // Flag for human review (voice messages often need personal attention)
  await flagForSupport(phone, 'Voice message received', env);

  if (isVoiceNote) {
    return await sendText(
      phone,
      await fromEnglish(
        "🎤 *Voice message received!*\n\n" +
        "Our team will listen to your message and respond shortly.\n\n" +
        "⏰ Average response time: 15-30 minutes\n\n" +
        "Meanwhile, you can also type your query for faster assistance.",
        lang
      ),
      env
    );
  }

  return await sendReplyButtons(
    phone,
    await fromEnglish(
      "🎵 *Audio received!*\n\n" +
      "How can I assist you?",
      lang
    ),
    [
      { id: 'CHAT_NOW', title: '💬 Support' },
      { id: 'MAIN_MENU', title: '🏠 Menu' }
    ],
    env
  );
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleDocumentMessage(message, phone, lang, env) {
  const doc = message.document;
  const filename = doc.filename || 'document';
  const mediaId = doc.id;
  const caption = doc.caption || '';

  console.log(`[Media] 📄 Document: ${filename}`);

  // React to document
  await sendReaction(phone, message.id, '📎', env).catch(() => {});

  // Save media reference
  await saveMediaReference(phone, mediaId, 'document', doc.mime_type, filename, env);

  // Check file type
  const extension = filename.split('.').pop()?.toLowerCase();
  
  // Payment screenshot (common for UPI)
  if (['jpg', 'jpeg', 'png', 'pdf'].includes(extension) && 
      (caption.toLowerCase().includes('payment') || caption.toLowerCase().includes('paid'))) {
    await flagForSupport(phone, 'Payment proof received', env);
    
    return await sendText(
      phone,
      await fromEnglish(
        "📄 *Payment proof received!*\n\n" +
        "Thank you! Our team will verify and update your order.\n\n" +
        "Please share your Order ID (KAA-XXXXXX) if you haven't already.",
        lang
      ),
      env
    );
  }

  return await sendReplyButtons(
    phone,
    await fromEnglish(
      `📄 *Document received:* ${filename}\n\n` +
      "How can I help you with this?",
      lang
    ),
    [
      { id: 'CHAT_NOW', title: '💬 Talk to Us' },
      { id: 'MAIN_MENU', title: '🏠 Menu' }
    ],
    env
  );
}

// ═══════════════════════════════════════════════════════════════
// STICKER HANDLER
// ═══════════════════════════════════════════════════════════════

async function handleStickerMessage(message, phone, lang, env) {
  const sticker = message.sticker;
  const mediaId = sticker.id;

  console.log(`[Media] 🎭 Sticker: ${mediaId}`);

  // React with a fun emoji
  const reactions = ['💎', '✨', '💖', '😊', '👑'];
  const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
  await sendReaction(phone, message.id, randomReaction, env).catch(() => {});

  // Save sticker reference
  await saveMediaReference(phone, mediaId, 'sticker', sticker.mime_type, '', env);

  // Fun response
  return await sendReplyButtons(
    phone,
    await fromEnglish(
      "😊 Nice sticker!\n\n" +
      "Is there anything I can help you with today? 💎",
      lang
    ),
    [
      { id: 'OPEN_CATALOG', title: '📱 Browse' },
      { id: 'MAIN_MENU', title: '🏠 Menu' }
    ],
    env
  );
}

// ═══════════════════════════════════════════════════════════════
// MEDIA DOWNLOAD (For processing)
// ═══════════════════════════════════════════════════════════════

export async function downloadMedia(mediaId, env) {
  const phoneId = env.WA_PHONE_ID;
  const token = env.WA_TOKEN;
  const apiVersion = env.GRAPH_API_VERSION || 'v21.0';

  try {
    // Step 1: Get media URL
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${mediaId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const mediaInfo = await mediaInfoResponse.json();
    
    if (!mediaInfo.url) {
      throw new Error('Failed to get media URL');
    }

    // Step 2: Download media
    const mediaResponse = await fetch(mediaInfo.url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const buffer = await mediaResponse.arrayBuffer();

    return {
      buffer,
      mimeType: mediaInfo.mime_type,
      sha256: mediaInfo.sha256,
      fileSize: mediaInfo.file_size
    };

  } catch (error) {
    console.error('[Media] Download failed:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// MEDIA UPLOAD TO R2 (Optional)
// ═══════════════════════════════════════════════════════════════

export async function uploadToR2(mediaId, phone, env) {
  if (!env.MEDIA) {
    console.log('[Media] R2 not configured');
    return null;
  }

  try {
    const media = await downloadMedia(mediaId, env);
    
    // Generate unique filename
    const timestamp = Date.now();
    const extension = getExtensionFromMime(media.mimeType);
    const filename = `${phone}/${timestamp}.${extension}`;

    // Upload to R2
    await env.MEDIA.put(filename, media.buffer, {
      httpMetadata: {
        contentType: media.mimeType
      }
    });

    console.log(`[Media] ✅ Uploaded to R2: ${filename}`);
    return filename;

  } catch (error) {
    console.error('[Media] R2 upload failed:', error.message);
    return null;
  }
}

function getExtensionFromMime(mimeType) {
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/amr': 'amr',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
  };
  return mimeMap[mimeType] || 'bin';
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getConversationState(phone, env) {
  try {
    return await env.DB.prepare(`
      SELECT * FROM conversation_state 
      WHERE phone = ? AND expires_at > datetime('now')
    `).bind(phone).first();
  } catch {
    return null;
  }
}

async function updateConversationState(phone, flow, step, data, env) {
  try {
    const existingState = await getConversationState(phone, env);
    const flowData = existingState?.flow_data ? JSON.parse(existingState.flow_data) : {};
    
    Object.assign(flowData, data);

    await env.DB.prepare(`
      INSERT OR REPLACE INTO conversation_state 
      (phone, current_flow, current_step, flow_data, updated_at, expires_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+2 hours'))
    `).bind(phone, flow, step, JSON.stringify(flowData)).run();
  } catch (e) {
    console.warn('[Media] Update state failed:', e.message);
  }
}

async function saveMediaReference(phone, mediaId, type, mimeType, caption, env) {
  try {
    await env.DB.prepare(`
      UPDATE messages SET 
        media_id = ?,
        media_mime = ?,
        media_caption = ?
      WHERE phone = ? AND direction = 'incoming'
      ORDER BY timestamp DESC LIMIT 1
    `).bind(mediaId, mimeType, caption, phone).run();
  } catch (e) {
    console.warn('[Media] Save reference failed:', e.message);
  }
}

async function flagForSupport(phone, reason, env) {
  try {
    await env.DB.prepare(`
      UPDATE chats SET 
        needs_attention = 1,
        priority = CASE WHEN priority = 'urgent' THEN 'urgent' ELSE 'high' END,
        notes = COALESCE(notes, '') || '\n[' || datetime('now') || '] ' || ?,
        labels = json_insert(COALESCE(labels, '[]'), '$[#]', 'media-support'),
        updated_at = datetime('now')
      WHERE phone = ?
    `).bind(reason, phone).run();

    console.log(`[Media] 🚨 Flagged for support: ${phone} - ${reason}`);
  } catch (e) {
    console.warn('[Media] Flag failed:', e.message);
  }
}
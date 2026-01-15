-- ═══════════════════════════════════════════════════════════════
-- KAAPAV WHATSAPP ULTIMATE - DATABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════
-- Run: wrangler d1 execute kaapav-whatsapp-db --file=schema.sql
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- MESSAGES TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE,                    -- WhatsApp message ID
    phone TEXT NOT NULL,
    text TEXT,
    direction TEXT CHECK(direction IN ('incoming', 'outgoing')) NOT NULL,
    message_type TEXT DEFAULT 'text',          -- text, image, audio, video, document, location, contacts, sticker, interactive
    timestamp TEXT NOT NULL,
    
    -- Media
    media_id TEXT,
    media_url TEXT,
    media_mime TEXT,
    media_caption TEXT,
    
    -- Interactive
    button_id TEXT,
    button_title TEXT,
    list_id TEXT,
    list_title TEXT,
    
    -- Context
    context_message_id TEXT,                   -- Reply to message
    forwarded INTEGER DEFAULT 0,
    
    -- Status
    is_auto_reply INTEGER DEFAULT 0,
    is_template INTEGER DEFAULT 0,
    template_name TEXT,
    status TEXT DEFAULT 'sent',                -- sent, delivered, read, failed
    read INTEGER DEFAULT 0,
    
    -- AI
    ai_processed INTEGER DEFAULT 0,
    ai_response TEXT,
    sentiment TEXT,                            -- positive, negative, neutral
    intent TEXT,                               -- order, inquiry, complaint, etc.
    
    -- Metadata
    metadata TEXT,                             -- JSON for extra data
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────
-- CHATS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    profile_pic_url TEXT,
    
    -- Last message info
    last_message TEXT,
    last_message_type TEXT DEFAULT 'text',
    last_timestamp TEXT,
    last_direction TEXT,
    
    -- Counts
    unread_count INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    
    -- Assignment
    assigned_to TEXT,                          -- Agent ID
    assigned_at TEXT,
    
    -- Status
    status TEXT DEFAULT 'open',                -- open, resolved, pending, spam
    priority TEXT DEFAULT 'normal',            -- low, normal, high, urgent
    
    -- Tags
    labels TEXT DEFAULT '[]',                  -- JSON array
    
    -- Language
    language TEXT DEFAULT 'en',
    
    -- Notes
    notes TEXT,
    
    -- Flags
    is_starred INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    needs_attention INTEGER DEFAULT 0,
    
    -- Timestamps
    first_message_at TEXT,
    last_customer_message_at TEXT,
    last_agent_message_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- ─────────────────────────────────────────────────────────────────
-- CUSTOMERS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    
    -- Basic Info
    name TEXT,
    email TEXT,
    gender TEXT,
    birthday TEXT,
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    country TEXT DEFAULT 'India',
    
    -- Alternate Contact
    alternate_phone TEXT,
    
    -- Preferences
    language TEXT DEFAULT 'en',
    currency TEXT DEFAULT 'INR',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    
    -- Segmentation
    labels TEXT DEFAULT '[]',                  -- JSON array
    segment TEXT,                              -- vip, regular, new, inactive
    source TEXT,                               -- whatsapp, website, instagram, facebook
    
    -- Notes
    notes TEXT,
    
    -- Stats
    message_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    average_order_value REAL DEFAULT 0,
    last_order_amount REAL,
    
    -- Scoring
    engagement_score INTEGER DEFAULT 0,        -- 0-100
    purchase_probability REAL DEFAULT 0,       -- 0-1
    lifetime_value REAL DEFAULT 0,
    
    -- Dates
    first_seen TEXT,
    last_seen TEXT,
    first_purchase TEXT,
    last_purchase TEXT,
    
    -- Marketing
    opted_in_marketing INTEGER DEFAULT 1,
    last_campaign_at TEXT,
    campaign_count INTEGER DEFAULT 0,
    
    -- Flags
    is_verified INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    
    -- Metadata
    metadata TEXT,                             -- JSON for extra data
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- ─────────────────────────────────────────────────────────────────
-- ORDERS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,             -- KAA-XXXXX format
    phone TEXT NOT NULL,
    customer_name TEXT,
    
    -- Items
    items TEXT NOT NULL,                       -- JSON array
    item_count INTEGER DEFAULT 1,
    
    -- Pricing
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    discount_code TEXT,
    shipping_cost REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    
    -- Shipping
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_pincode TEXT,
    shipping_country TEXT DEFAULT 'India',
    
    -- Shipping Details
    shipping_method TEXT DEFAULT 'standard',   -- standard, express
    estimated_delivery TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending',             -- pending, confirmed, processing, shipped, delivered, cancelled, returned
    payment_status TEXT DEFAULT 'unpaid',      -- unpaid, paid, refunded, partial
    
    -- Payment
    payment_method TEXT,                       -- upi, card, netbanking, cod
    payment_id TEXT,                           -- Razorpay payment ID
    payment_link TEXT,
    paid_at TEXT,
    
    -- Tracking
    tracking_id TEXT,
    tracking_url TEXT,
    courier TEXT,                              -- shiprocket, delhivery, etc.
    
    -- Dates
    confirmed_at TEXT,
    shipped_at TEXT,
    delivered_at TEXT,
    cancelled_at TEXT,
    
    -- Notes
    customer_notes TEXT,
    internal_notes TEXT,
    cancellation_reason TEXT,
    
    -- Source
    source TEXT DEFAULT 'whatsapp',            -- whatsapp, website
    
    -- Metadata
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- ─────────────────────────────────────────────────────────────────
-- ORDER ITEMS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    
    -- Product
    product_id TEXT,
    product_name TEXT NOT NULL,
    product_sku TEXT,
    product_image TEXT,
    
    -- Details
    variant TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- ─────────────────────────────────────────────────────────────────
-- PRODUCTS TABLE (Catalog)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT UNIQUE NOT NULL,           -- SKU
    
    -- Basic
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    
    -- Pricing
    price REAL NOT NULL,
    compare_price REAL,                        -- Original price
    discount_percent INTEGER DEFAULT 0,
    
    -- Inventory
    stock INTEGER DEFAULT 0,
    in_stock INTEGER DEFAULT 1,
    
    -- Media
    image_url TEXT,
    images TEXT,                               -- JSON array
    
    -- Details
    material TEXT,
    weight TEXT,
    dimensions TEXT,
    
    -- Variants
    variants TEXT,                             -- JSON array
    
    -- SEO
    tags TEXT,                                 -- JSON array
    
    -- Stats
    view_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    
    -- WhatsApp Catalog
    wa_product_id TEXT,                        -- WhatsApp product retailer ID
    
    -- Flags
    is_active INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    
    -- Metadata
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- ─────────────────────────────────────────────────────────────────
-- QUICK REPLIES TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Trigger
    keyword TEXT NOT NULL,
    match_type TEXT DEFAULT 'contains',        -- exact, contains, starts, regex
    
    -- Response
    response TEXT NOT NULL,
    response_type TEXT DEFAULT 'text',         -- text, buttons, list, template
    buttons TEXT,                              -- JSON for buttons
    
    -- Language
    language TEXT DEFAULT 'en',
    
    -- Priority (higher = checked first)
    priority INTEGER DEFAULT 0,
    
    -- Stats
    use_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    
    -- Flags
    is_active INTEGER DEFAULT 1,
    
    -- Metadata
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- ─────────────────────────────────────────────────────────────────
-- BROADCASTS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id TEXT UNIQUE NOT NULL,
    
    -- Campaign Info
    name TEXT NOT NULL,
    description TEXT,
    
    -- Message
    message TEXT,
    message_type TEXT DEFAULT 'text',          -- text, template, image
    template_name TEXT,
    template_params TEXT,                      -- JSON
    media_url TEXT,
    buttons TEXT,                              -- JSON
    
    -- Targeting
    target_type TEXT DEFAULT 'all',            -- all, labels, segment, custom
    target_labels TEXT,                        -- JSON array
    target_segment TEXT,
    target_phones TEXT,                        -- JSON array for custom
    
    -- Counts
    target_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'draft',               -- draft, scheduled, sending, completed, cancelled
    
    -- Scheduling
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    
    -- Rate limiting
    send_rate INTEGER DEFAULT 20,              -- messages per minute
    
    -- Metadata
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- ─────────────────────────────────────────────────────────────────
-- BROADCAST RECIPIENTS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'pending',             -- pending, sent, delivered, read, failed
    message_id TEXT,
    
    -- Timestamps
    sent_at TEXT,
    delivered_at TEXT,
    read_at TEXT,
    
    -- Error
    error_message TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id)
);

-- ─────────────────────────────────────────────────────────────────
-- TEMPLATES TABLE (WhatsApp Message Templates)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name TEXT UNIQUE NOT NULL,
    
    -- Template Details
    category TEXT,                             -- marketing, utility, authentication
    language TEXT DEFAULT 'en',
    status TEXT DEFAULT 'pending',             -- pending, approved, rejected
    
    -- Content
    header_type TEXT,                          -- text, image, video, document
    header_text TEXT,
    body_text TEXT,
    footer_text TEXT,
    buttons TEXT,                              -- JSON
    
    -- WhatsApp
    wa_template_id TEXT,
    
    -- Stats
    use_count INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- ─────────────────────────────────────────────────────────────────
-- ANALYTICS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Event
    event_type TEXT NOT NULL,                  -- message_in, message_out, order, button_click, etc.
    event_name TEXT,
    
    -- Context
    phone TEXT,
    order_id TEXT,
    product_id TEXT,
    campaign_id TEXT,
    
    -- Data
    data TEXT,                                 -- JSON
    
    -- Source
    source TEXT,
    
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────
-- AGENTS TABLE (For multi-agent support)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT UNIQUE NOT NULL,
    
    -- Info
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    
    -- Role
    role TEXT DEFAULT 'agent',                 -- admin, agent
    
    -- Stats
    chats_handled INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,       -- seconds
    
    -- Status
    is_active INTEGER DEFAULT 1,
    is_online INTEGER DEFAULT 0,
    last_online TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────
-- CONVERSATION STATE TABLE (For order flow, etc.)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_state (
    phone TEXT PRIMARY KEY,
    
    -- State
    current_flow TEXT,                         -- order, support, catalog, etc.
    current_step TEXT,
    
    -- Data
    flow_data TEXT,                            -- JSON
    
    -- Timestamps
    started_at TEXT,
    updated_at TEXT,
    expires_at TEXT
);

-- ─────────────────────────────────────────────────────────────────
-- CARTS TABLE (Abandoned cart tracking)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    
    -- Items
    items TEXT,                                -- JSON array
    item_count INTEGER DEFAULT 0,
    total REAL DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'active',              -- active, converted, abandoned, recovered
    
    -- Recovery
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TEXT,
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    converted_at TEXT,
    abandoned_at TEXT
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

CREATE INDEX IF NOT EXISTS idx_chats_phone ON chats(phone);
CREATE INDEX IF NOT EXISTS idx_chats_timestamp ON chats(last_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chats_unread ON chats(unread_count);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
CREATE INDEX IF NOT EXISTS idx_chats_assigned ON chats(assigned_to);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(segment);
CREATE INDEX IF NOT EXISTS idx_customers_labels ON customers(labels);

CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_quick_replies_keyword ON quick_replies(keyword);
CREATE INDEX IF NOT EXISTS idx_quick_replies_active ON quick_replies(is_active);

CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled ON broadcasts(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);
CREATE INDEX IF NOT EXISTS idx_carts_updated ON carts(updated_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- DEFAULT DATA
-- ═══════════════════════════════════════════════════════════════

-- Insert default quick replies
INSERT OR IGNORE INTO quick_replies (keyword, match_type, response, priority, language) VALUES
('hi', 'exact', '✨ Welcome to *KAAPAV Fashion Jewellery*! 💎\n\n👑 Crafted Elegance • Timeless Sparkle\n\nHow can I help you today?', 100, 'en'),
('hello', 'exact', '✨ Welcome to *KAAPAV Fashion Jewellery*! 💎\n\n👑 Crafted Elegance • Timeless Sparkle\n\nHow can I help you today?', 100, 'en'),
('hey', 'exact', '✨ Welcome to *KAAPAV Fashion Jewellery*! 💎\n\n👑 Crafted Elegance • Timeless Sparkle\n\nHow can I help you today?', 100, 'en'),
('price', 'contains', '💰 *KAAPAV Price Range*\n\n• Earrings: ₹149 - ₹999\n• Necklaces: ₹299 - ₹1999\n• Bangles: ₹199 - ₹1499\n• Rings: ₹99 - ₹499\n\n🛍️ View all: kaapav.com/shop', 90, 'en'),
('catalog', 'contains', '📱 *View Our Catalog*\n\n👉 WhatsApp: wa.me/c/919148330016\n👉 Website: kaapav.com\n\n✨ 500+ Designs\n💎 New arrivals every week!', 90, 'en'),
('catalogue', 'contains', '📱 *View Our Catalog*\n\n👉 WhatsApp: wa.me/c/919148330016\n👉 Website: kaapav.com\n\n✨ 500+ Designs\n💎 New arrivals every week!', 90, 'en'),
('order', 'contains', '🛒 *Place Your Order*\n\nTo order:\n1. Share product name/image\n2. Share delivery address\n3. We''ll send payment link!\n\nOr type *"start order"* to begin!', 85, 'en'),
('delivery', 'contains', '🚚 *Delivery Information*\n\n• Delivery: 3-5 business days\n• FREE shipping above ₹498\n• Pan India delivery\n\nTrack: shiprocket.in/shipment-tracking', 80, 'en'),
('shipping', 'contains', '🚚 *Shipping Information*\n\n• Delivery: 3-5 business days\n• FREE shipping above ₹498\n• Pan India delivery\n\nTrack: shiprocket.in/shipment-tracking', 80, 'en'),
('track', 'contains', '📦 *Track Your Order*\n\n1. Visit: shiprocket.in/shipment-tracking\n2. Enter your AWB/Tracking number\n\nOr share your Order ID and I''ll help!', 80, 'en'),
('payment', 'contains', '💳 *Payment Options*\n\n✅ UPI (GPay, PhonePe, Paytm)\n✅ Credit/Debit Cards\n✅ Net Banking\n\n🚫 COD not available\n\n💰 Pay: razorpay.me/@kaapav', 80, 'en'),
('cod', 'contains', '🚫 *COD Not Available*\n\nSorry, we don''t offer Cash on Delivery.\n\n💳 We accept:\n• UPI (GPay, PhonePe, Paytm)\n• Credit/Debit Cards\n• Net Banking\n\n✨ Prepaid = FREE shipping!', 85, 'en'),
('return', 'contains', '↩️ *Return Policy*\n\n• 7-day easy returns\n• Product must be unused\n• Original packaging required\n\nTo initiate return, share your Order ID.', 75, 'en'),
('exchange', 'contains', '🔄 *Exchange Policy*\n\n• Exchange within 7 days\n• Product must be unused\n• Original packaging required\n\nTo initiate exchange, share your Order ID.', 75, 'en'),
('refund', 'contains', '💸 *Refund Policy*\n\n• Refund within 7-10 business days\n• Amount credited to original payment method\n\nTo check refund status, share your Order ID.', 75, 'en'),
('thanks', 'contains', 'You''re welcome! 😊\n\nThank you for choosing *KAAPAV*! 💎\n\nHappy shopping! ✨', 70, 'en'),
('thank you', 'contains', 'You''re welcome! 😊\n\nThank you for choosing *KAAPAV*! 💎\n\nHappy shopping! ✨', 70, 'en'),
('bye', 'exact', 'Thank you for visiting *KAAPAV*! 🙏\n\nCome back soon for more sparkle! ✨💎', 70, 'en');

-- Insert default agent
INSERT OR IGNORE INTO agents (agent_id, name, email, role) VALUES
('admin', 'KAAPAV Admin', 'admin@kaapav.com', 'admin');
-- ═══════════════════════════════════════════════════════════════
-- KAAPAV WHATSAPP ULTIMATE - DATABASE SCHEMA v2.1
-- ═══════════════════════════════════════════════════════════════
-- Enhanced Version - Original Structure Preserved
-- Run: wrangler d1 execute kaapav-whatsapp-db --file=schema.sql
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- PRAGMA SETTINGS (Performance)
-- ═══════════════════════════════════════════════════════════════
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;


-- ─────────────────────────────────────────────────────────────────
-- MESSAGES TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE,                    -- WhatsApp message ID
    phone TEXT NOT NULL,
    text TEXT,
    direction TEXT CHECK(direction IN ('incoming', 'outgoing')) NOT NULL,
    message_type TEXT DEFAULT 'text',          -- text, image, audio, video, document, location, contacts, sticker, interactive
    timestamp TEXT NOT NULL,
    
    -- Media (YOUR ORIGINAL)
    media_id TEXT,
    media_url TEXT,
    media_mime TEXT,
    media_caption TEXT,
    
    -- Media (ENHANCED)
    media_filename TEXT,
    media_size INTEGER,
    media_sha256 TEXT,
    
    -- Interactive (YOUR ORIGINAL)
    button_id TEXT,
    button_title TEXT,
    list_id TEXT,
    list_title TEXT,
    
    -- Interactive (ENHANCED)
    list_description TEXT,
    
    -- Context (YOUR ORIGINAL)
    context_message_id TEXT,                   -- Reply to message
    forwarded INTEGER DEFAULT 0,
    
    -- Context (ENHANCED)
    frequently_forwarded INTEGER DEFAULT 0,
    context_phone TEXT,
    
    -- Status (YOUR ORIGINAL)
    is_auto_reply INTEGER DEFAULT 0,
    is_template INTEGER DEFAULT 0,
    template_name TEXT,
    status TEXT DEFAULT 'sent',                -- sent, delivered, read, failed
    read INTEGER DEFAULT 0,
    
    -- Status (ENHANCED)
    status_timestamp TEXT,
    error_code INTEGER,
    error_message TEXT,
    wa_message_id TEXT,
    
    -- AI (YOUR ORIGINAL)
    ai_processed INTEGER DEFAULT 0,
    ai_response TEXT,
    sentiment TEXT,                            -- positive, negative, neutral
    intent TEXT,                               -- order, inquiry, complaint, etc.
    
    -- AI (ENHANCED)
    confidence REAL,
    entities TEXT,
    
    -- Metadata (YOUR ORIGINAL)
    metadata TEXT,                             -- JSON for extra data
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata (ENHANCED)
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- CHATS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    profile_pic_url TEXT,
    
    -- Last message info (YOUR ORIGINAL)
    last_message TEXT,
    last_message_type TEXT DEFAULT 'text',
    last_timestamp TEXT,
    last_direction TEXT,
    
    -- Last message (ENHANCED)
    last_message_id TEXT,
    
    -- Counts (YOUR ORIGINAL)
    unread_count INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    
    -- Counts (ENHANCED)
    incoming_count INTEGER DEFAULT 0,
    outgoing_count INTEGER DEFAULT 0,
    
    -- Assignment (YOUR ORIGINAL)
    assigned_to TEXT,                          -- Agent ID
    assigned_at TEXT,
    
    -- Status (YOUR ORIGINAL)
    status TEXT DEFAULT 'open',                -- open, resolved, pending, spam
    priority TEXT DEFAULT 'normal',            -- low, normal, high, urgent
    
    -- Tags (YOUR ORIGINAL)
    labels TEXT DEFAULT '[]',                  -- JSON array
    
    -- Language (YOUR ORIGINAL)
    language TEXT DEFAULT 'en',
    
    -- Notes (YOUR ORIGINAL)
    notes TEXT,
    
    -- Notes (ENHANCED)
    pinned_note TEXT,
    
    -- Flags (YOUR ORIGINAL)
    is_starred INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    needs_attention INTEGER DEFAULT 0,
    
    -- Flags (ENHANCED)
    is_muted INTEGER DEFAULT 0,
    is_bot_enabled INTEGER DEFAULT 1,
    
    -- Response Time (ENHANCED)
    first_response_time INTEGER,
    avg_response_time INTEGER,
    
    -- Timestamps (YOUR ORIGINAL)
    first_message_at TEXT,
    last_customer_message_at TEXT,
    last_agent_message_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    
    -- Timestamps (ENHANCED)
    last_read_at TEXT,
    resolved_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- CUSTOMERS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    
    -- Basic Info (YOUR ORIGINAL)
    name TEXT,
    email TEXT,
    gender TEXT,
    birthday TEXT,
    
    -- Address (YOUR ORIGINAL)
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    country TEXT DEFAULT 'India',
    
    -- Address (ENHANCED)
    landmark TEXT,
    addresses TEXT DEFAULT '[]',               -- JSON array for multiple addresses
    
    -- Alternate Contact (YOUR ORIGINAL)
    alternate_phone TEXT,
    
    -- Preferences (YOUR ORIGINAL)
    language TEXT DEFAULT 'en',
    currency TEXT DEFAULT 'INR',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    
    -- Location (ENHANCED)
    last_location_lat REAL,
    last_location_lng REAL,
    last_location_address TEXT,
    
    -- Segmentation (YOUR ORIGINAL)
    labels TEXT DEFAULT '[]',                  -- JSON array
    segment TEXT,                              -- vip, regular, new, inactive
    source TEXT,                               -- whatsapp, website, instagram, facebook
    
    -- Segmentation (ENHANCED)
    tier TEXT DEFAULT 'bronze',                -- bronze, silver, gold, platinum
    referral_code TEXT UNIQUE,
    referred_by TEXT,
    referral_count INTEGER DEFAULT 0,
    
    -- Notes (YOUR ORIGINAL)
    notes TEXT,
    
    -- Stats (YOUR ORIGINAL)
    message_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    average_order_value REAL DEFAULT 0,
    last_order_amount REAL,
    
    -- Stats (ENHANCED)
    completed_order_count INTEGER DEFAULT 0,
    cancelled_order_count INTEGER DEFAULT 0,
    last_order_at TEXT,
    last_message_at TEXT,
    
    -- Cart (ENHANCED)
    cart_items TEXT DEFAULT '[]',
    cart_total REAL DEFAULT 0,
    cart_updated_at TEXT,
    wishlist TEXT DEFAULT '[]',
    
    -- Scoring (YOUR ORIGINAL)
    engagement_score INTEGER DEFAULT 0,        -- 0-100
    purchase_probability REAL DEFAULT 0,       -- 0-1
    lifetime_value REAL DEFAULT 0,
    
    -- Scoring (ENHANCED)
    recency_score INTEGER DEFAULT 0,
    frequency_score INTEGER DEFAULT 0,
    monetary_score INTEGER DEFAULT 0,
    rfm_segment TEXT,
    
    -- Dates (YOUR ORIGINAL)
    first_seen TEXT,
    last_seen TEXT,
    first_purchase TEXT,
    last_purchase TEXT,
    
    -- Marketing (YOUR ORIGINAL)
    opted_in_marketing INTEGER DEFAULT 1,
    last_campaign_at TEXT,
    campaign_count INTEGER DEFAULT 0,
    
    -- Marketing (ENHANCED)
    opted_in_transactional INTEGER DEFAULT 1,
    unsubscribed_at TEXT,
    
    -- Flags (YOUR ORIGINAL)
    is_verified INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    
    -- Flags (ENHANCED)
    is_valid_whatsapp INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    blocked_reason TEXT,
    blocked_at TEXT,
    deleted_at TEXT,
    
    -- External IDs (ENHANCED)
    external_id TEXT,
    shopify_customer_id TEXT,
    razorpay_customer_id TEXT,
    
    -- Metadata (YOUR ORIGINAL)
    metadata TEXT,                             -- JSON for extra data
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- ORDERS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,             -- KAA-XXXXX format
    phone TEXT NOT NULL,
    customer_name TEXT,
    
    -- Order Number (ENHANCED)
    order_number INTEGER,
    
    -- Items (YOUR ORIGINAL)
    items TEXT NOT NULL,                       -- JSON array
    item_count INTEGER DEFAULT 1,
    
    -- Pricing (YOUR ORIGINAL)
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    discount_code TEXT,
    shipping_cost REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total REAL DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    
    -- Pricing (ENHANCED)
    discount_type TEXT,
    tax_rate REAL DEFAULT 0,
    applied_offers TEXT,
    
    -- Shipping (YOUR ORIGINAL)
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_pincode TEXT,
    shipping_country TEXT DEFAULT 'India',
    
    -- Shipping (ENHANCED)
    shipping_name TEXT,
    shipping_phone TEXT,
    shipping_landmark TEXT,
    delivery_instructions TEXT,
    
    -- Shipping Details (YOUR ORIGINAL)
    shipping_method TEXT DEFAULT 'standard',   -- standard, express
    estimated_delivery TEXT,
    
    -- Shipping Details (ENHANCED)
    shipping_zone TEXT,
    total_weight REAL,
    package_dimensions TEXT,
    
    -- Status (YOUR ORIGINAL)
    status TEXT DEFAULT 'pending',             -- pending, confirmed, processing, shipped, delivered, cancelled, returned
    payment_status TEXT DEFAULT 'unpaid',      -- unpaid, paid, refunded, partial
    
    -- Status (ENHANCED)
    status_history TEXT DEFAULT '[]',
    
    -- Payment (YOUR ORIGINAL)
    payment_method TEXT,                       -- upi, card, netbanking, cod
    payment_id TEXT,                           -- Razorpay payment ID
    payment_link TEXT,
    paid_at TEXT,
    
    -- Payment (ENHANCED)
    payment_gateway TEXT,
    payment_order_id TEXT,
    payment_signature TEXT,
    payment_link_expires_at TEXT,
    paid_amount REAL DEFAULT 0,
    
    -- COD (ENHANCED)
    is_cod INTEGER DEFAULT 0,
    cod_amount REAL DEFAULT 0,
    cod_collected INTEGER DEFAULT 0,
    cod_collected_at TEXT,
    
    -- Tracking (YOUR ORIGINAL)
    tracking_id TEXT,
    tracking_url TEXT,
    courier TEXT,                              -- shiprocket, delhivery, etc.
    
    -- Tracking (ENHANCED)
    courier_order_id TEXT,
    shipment_id TEXT,
    
    -- Fulfillment (ENHANCED)
    warehouse_id TEXT,
    picked_at TEXT,
    packed_at TEXT,
    out_for_delivery_at TEXT,
    delivery_attempts INTEGER DEFAULT 0,
    proof_of_delivery TEXT,
    
    -- Dates (YOUR ORIGINAL)
    confirmed_at TEXT,
    shipped_at TEXT,
    delivered_at TEXT,
    cancelled_at TEXT,
    
    -- Cancellation (ENHANCED)
    cancelled_by TEXT,
    
    -- Return/Refund (ENHANCED)
    return_requested_at TEXT,
    return_reason TEXT,
    return_status TEXT,
    return_tracking_id TEXT,
    returned_at TEXT,
    refund_amount REAL DEFAULT 0,
    refund_id TEXT,
    refunded_at TEXT,
    
    -- Notes (YOUR ORIGINAL)
    customer_notes TEXT,
    internal_notes TEXT,
    cancellation_reason TEXT,
    
    -- Notes (ENHANCED)
    gift_message TEXT,
    is_gift INTEGER DEFAULT 0,
    
    -- Source (YOUR ORIGINAL)
    source TEXT DEFAULT 'whatsapp',            -- whatsapp, website
    
    -- Source (ENHANCED)
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    
    -- Notifications (ENHANCED)
    confirmation_sent INTEGER DEFAULT 0,
    shipping_notification_sent INTEGER DEFAULT 0,
    delivery_notification_sent INTEGER DEFAULT 0,
    review_request_sent INTEGER DEFAULT 0,
    
    -- Metadata (YOUR ORIGINAL)
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- ORDER ITEMS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    
    -- Product (YOUR ORIGINAL)
    product_id TEXT,
    product_name TEXT NOT NULL,
    product_sku TEXT,
    product_image TEXT,
    
    -- Product (ENHANCED)
    product_url TEXT,
    
    -- Details (YOUR ORIGINAL)
    variant TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    
    -- Details (ENHANCED)
    variant_id TEXT,
    variant_options TEXT,
    original_price REAL,
    discount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    weight REAL,
    
    -- Status (ENHANCED)
    status TEXT DEFAULT 'pending',
    fulfilled_quantity INTEGER DEFAULT 0,
    returned_quantity INTEGER DEFAULT 0,
    
    -- Notes (YOUR ORIGINAL)
    notes TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);


-- ─────────────────────────────────────────────────────────────────
-- PRODUCTS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT UNIQUE NOT NULL,           -- SKU
    
    -- Basic (YOUR ORIGINAL)
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    
    -- Basic (ENHANCED)
    slug TEXT UNIQUE,
    short_description TEXT,
    category_id TEXT,
    brand TEXT,
    
    -- Pricing (YOUR ORIGINAL)
    price REAL NOT NULL,
    compare_price REAL,                        -- Original price
    discount_percent INTEGER DEFAULT 0,
    
    -- Pricing (ENHANCED)
    cost_price REAL,
    
    -- Inventory (YOUR ORIGINAL)
    stock INTEGER DEFAULT 0,
    in_stock INTEGER DEFAULT 1,
    
    -- Inventory (ENHANCED)
    reserved_stock INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    track_inventory INTEGER DEFAULT 1,
    allow_backorder INTEGER DEFAULT 0,
    
    -- Media (YOUR ORIGINAL)
    image_url TEXT,
    images TEXT,                               -- JSON array
    
    -- Media (ENHANCED)
    video_url TEXT,
    
    -- Details (YOUR ORIGINAL)
    material TEXT,
    weight TEXT,
    dimensions TEXT,
    
    -- Details (ENHANCED)
    color TEXT,
    size TEXT,
    
    -- Variants (YOUR ORIGINAL)
    variants TEXT,                             -- JSON array
    
    -- Variants (ENHANCED)
    has_variants INTEGER DEFAULT 0,
    variant_options TEXT,
    
    -- SEO (YOUR ORIGINAL)
    tags TEXT,                                 -- JSON array
    
    -- SEO (ENHANCED)
    meta_title TEXT,
    meta_description TEXT,
    
    -- Stats (YOUR ORIGINAL)
    view_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    
    -- Stats (ENHANCED)
    wishlist_count INTEGER DEFAULT 0,
    cart_count INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    avg_rating REAL DEFAULT 0,
    
    -- WhatsApp Catalog (YOUR ORIGINAL)
    wa_product_id TEXT,                        -- WhatsApp product retailer ID
    
    -- WhatsApp Catalog (ENHANCED)
    wa_content_id TEXT,
    
    -- Flags (YOUR ORIGINAL)
    is_active INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    
    -- Flags (ENHANCED)
    is_bestseller INTEGER DEFAULT 0,
    is_new_arrival INTEGER DEFAULT 0,
    is_on_sale INTEGER DEFAULT 0,
    
    -- Availability (ENHANCED)
    available_from TEXT,
    available_until TEXT,
    
    -- Metadata (YOUR ORIGINAL)
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    
    -- Metadata (ENHANCED)
    deleted_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- QUICK REPLIES TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Trigger (YOUR ORIGINAL)
    keyword TEXT NOT NULL,
    match_type TEXT DEFAULT 'contains',        -- exact, contains, starts, regex
    
    -- Trigger (ENHANCED)
    keywords TEXT DEFAULT '[]',                -- JSON array for multiple triggers
    
    -- Response (YOUR ORIGINAL)
    response TEXT NOT NULL,
    response_type TEXT DEFAULT 'text',         -- text, buttons, list, template
    buttons TEXT,                              -- JSON for buttons
    
    -- Response (ENHANCED)
    list_data TEXT,
    media_url TEXT,
    template_name TEXT,
    
    -- Language (YOUR ORIGINAL)
    language TEXT DEFAULT 'en',
    
    -- Priority (YOUR ORIGINAL)
    priority INTEGER DEFAULT 0,
    
    -- Conditions (ENHANCED)
    conditions TEXT,
    active_from TEXT,
    active_until TEXT,
    active_days TEXT DEFAULT '[1,2,3,4,5,6,7]',
    active_hours_start TEXT,
    active_hours_end TEXT,
    
    -- Stats (YOUR ORIGINAL)
    use_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    
    -- Flags (YOUR ORIGINAL)
    is_active INTEGER DEFAULT 1,
    
    -- Metadata (YOUR ORIGINAL)
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    
    -- Metadata (ENHANCED)
    notes TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- BROADCASTS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id TEXT UNIQUE NOT NULL,
    
    -- Campaign Info (YOUR ORIGINAL)
    name TEXT NOT NULL,
    description TEXT,
    
    -- Message (YOUR ORIGINAL)
    message TEXT,
    message_type TEXT DEFAULT 'text',          -- text, template, image
    template_name TEXT,
    template_params TEXT,                      -- JSON
    media_url TEXT,
    buttons TEXT,                              -- JSON
    
    -- Message (ENHANCED)
    media_caption TEXT,
    
    -- Targeting (YOUR ORIGINAL)
    target_type TEXT DEFAULT 'all',            -- all, labels, segment, custom
    target_labels TEXT,                        -- JSON array
    target_segment TEXT,
    target_phones TEXT,                        -- JSON array for custom
    
    -- Targeting (ENHANCED)
    target_filter TEXT,
    exclude_labels TEXT,
    exclude_phones TEXT,
    
    -- Counts (YOUR ORIGINAL)
    target_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    
    -- Counts (ENHANCED)
    opted_out_count INTEGER DEFAULT 0,
    
    -- Status (YOUR ORIGINAL)
    status TEXT DEFAULT 'draft',               -- draft, scheduled, sending, completed, cancelled
    
    -- Status (ENHANCED - more states)
    -- paused, failed added
    
    -- Scheduling (YOUR ORIGINAL)
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    
    -- Scheduling (ENHANCED)
    timezone TEXT DEFAULT 'Asia/Kolkata',
    paused_at TEXT,
    resumed_at TEXT,
    cancelled_at TEXT,
    
    -- Rate limiting (YOUR ORIGINAL)
    send_rate INTEGER DEFAULT 20,              -- messages per minute
    
    -- Rate limiting (ENHANCED)
    batch_size INTEGER DEFAULT 100,
    delay_between_batches INTEGER DEFAULT 60,
    
    -- Cost (ENHANCED)
    estimated_cost REAL DEFAULT 0,
    actual_cost REAL DEFAULT 0,
    
    -- A/B Testing (ENHANCED)
    is_ab_test INTEGER DEFAULT 0,
    ab_variant TEXT,
    ab_test_id TEXT,
    
    -- Metadata (YOUR ORIGINAL)
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    
    -- Metadata (ENHANCED)
    notes TEXT,
    metadata TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- BROADCAST RECIPIENTS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    
    -- Personalization (ENHANCED)
    variables TEXT,
    
    -- Status (YOUR ORIGINAL)
    status TEXT DEFAULT 'pending',             -- pending, sent, delivered, read, failed
    message_id TEXT,
    
    -- Status (ENHANCED - more states)
    -- queued, replied, opted_out added
    
    -- Timestamps (YOUR ORIGINAL)
    sent_at TEXT,
    delivered_at TEXT,
    read_at TEXT,
    
    -- Timestamps (ENHANCED)
    queued_at TEXT,
    replied_at TEXT,
    failed_at TEXT,
    
    -- Error (YOUR ORIGINAL)
    error_message TEXT,
    
    -- Error (ENHANCED)
    error_code INTEGER,
    retry_count INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(broadcast_id, phone),
    FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE
);


-- ─────────────────────────────────────────────────────────────────
-- TEMPLATES TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name TEXT UNIQUE NOT NULL,
    
    -- Template Details (YOUR ORIGINAL)
    category TEXT,                             -- marketing, utility, authentication
    language TEXT DEFAULT 'en',
    status TEXT DEFAULT 'pending',             -- pending, approved, rejected
    
    -- Template Details (ENHANCED)
    template_id TEXT UNIQUE,
    wa_template_id TEXT,
    wa_namespace TEXT,
    rejection_reason TEXT,
    
    -- Content (YOUR ORIGINAL)
    header_type TEXT,                          -- text, image, video, document
    header_text TEXT,
    body_text TEXT,
    footer_text TEXT,
    buttons TEXT,                              -- JSON
    
    -- Content (ENHANCED)
    header_example TEXT,
    body_example TEXT,
    button_type TEXT,
    variables TEXT,
    
    -- WhatsApp (YOUR ORIGINAL)
    wa_template_id TEXT,
    
    -- Stats (YOUR ORIGINAL)
    use_count INTEGER DEFAULT 0,
    
    -- Stats (ENHANCED)
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    
    -- Metadata (ENHANCED)
    created_by TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- ANALYTICS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Event (YOUR ORIGINAL)
    event_type TEXT NOT NULL,                  -- message_in, message_out, order, button_click, etc.
    event_name TEXT,
    
    -- Context (YOUR ORIGINAL)
    phone TEXT,
    order_id TEXT,
    product_id TEXT,
    campaign_id TEXT,
    
    -- Context (ENHANCED)
    user_id TEXT,
    session_id TEXT,
    
    -- Data (YOUR ORIGINAL)
    data TEXT,                                 -- JSON
    
    -- Source (YOUR ORIGINAL)
    source TEXT,
    
    -- Source (ENHANCED)
    referrer TEXT,
    device_type TEXT,
    platform TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    
    -- Alias for consistency (ENHANCED)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────
-- AGENTS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT UNIQUE NOT NULL,
    
    -- Link to users (ENHANCED)
    user_id TEXT,
    
    -- Info (YOUR ORIGINAL)
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    
    -- Info (ENHANCED)
    avatar_url TEXT,
    
    -- Role (YOUR ORIGINAL)
    role TEXT DEFAULT 'agent',                 -- admin, agent
    
    -- Role (ENHANCED)
    team_id TEXT,
    skills TEXT DEFAULT '[]',
    languages TEXT DEFAULT '["en"]',
    
    -- Capacity (ENHANCED)
    max_chats INTEGER DEFAULT 10,
    current_chats INTEGER DEFAULT 0,
    
    -- Stats (YOUR ORIGINAL)
    chats_handled INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,       -- seconds
    
    -- Stats (ENHANCED)
    chats_resolved INTEGER DEFAULT 0,
    avg_resolution_time INTEGER DEFAULT 0,
    csat_score REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    
    -- Status (YOUR ORIGINAL)
    is_active INTEGER DEFAULT 1,
    is_online INTEGER DEFAULT 0,
    last_online TEXT,
    
    -- Status (ENHANCED)
    status TEXT DEFAULT 'offline',             -- online, away, busy, offline
    status_message TEXT,
    
    -- Schedule (ENHANCED)
    work_hours TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- CONVERSATION STATE TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_state (
    phone TEXT PRIMARY KEY,
    
    -- State (YOUR ORIGINAL)
    current_flow TEXT,                         -- order, support, catalog, etc.
    current_step TEXT,
    
    -- Data (YOUR ORIGINAL)
    flow_data TEXT,                            -- JSON
    
    -- History (ENHANCED)
    previous_flow TEXT,
    previous_step TEXT,
    
    -- Timestamps (YOUR ORIGINAL)
    started_at TEXT,
    updated_at TEXT,
    expires_at TEXT,
    
    -- Timestamps (ENHANCED)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────
-- CARTS TABLE (YOUR ORIGINAL + ENHANCEMENTS)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    
    -- Cart ID (ENHANCED)
    cart_id TEXT UNIQUE,
    
    -- Items (YOUR ORIGINAL)
    items TEXT,                                -- JSON array
    item_count INTEGER DEFAULT 0,
    total REAL DEFAULT 0,
    
    -- Totals (ENHANCED)
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    discount_code TEXT,
    shipping_cost REAL DEFAULT 0,
    
    -- Status (YOUR ORIGINAL)
    status TEXT DEFAULT 'active',              -- active, converted, abandoned, recovered
    
    -- Recovery (YOUR ORIGINAL)
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TEXT,
    
    -- Recovery (ENHANCED)
    reminder_scheduled_at TEXT,
    recovery_discount_sent INTEGER DEFAULT 0,
    
    -- Conversion (ENHANCED)
    order_id TEXT,
    
    -- Timestamps (YOUR ORIGINAL)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    converted_at TEXT,
    abandoned_at TEXT,
    
    -- Timestamps (ENHANCED)
    recovered_at TEXT,
    expires_at TEXT,
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);


-- ═══════════════════════════════════════════════════════════════
-- NEW TABLES (Required by index.js)
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- USERS TABLE (Dashboard Users)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    
    -- Authentication
    email TEXT UNIQUE,
    password_hash TEXT,
    
    -- Profile
    name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    
    -- Role
    role TEXT DEFAULT 'agent',                 -- super_admin, admin, manager, agent, viewer
    permissions TEXT DEFAULT '[]',
    
    -- Status
    is_active INTEGER DEFAULT 1,
    is_verified INTEGER DEFAULT 0,
    email_verified_at TEXT,
    
    -- 2FA
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_secret TEXT,
    
    -- Tracking
    last_login_at TEXT,
    last_login_ip TEXT,
    login_count INTEGER DEFAULT 0,
    failed_login_count INTEGER DEFAULT 0,
    locked_until TEXT,
    
    -- Preferences
    preferences TEXT DEFAULT '{}',
    notification_settings TEXT DEFAULT '{}',
    
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- SESSIONS TABLE (API Authentication)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Device Info
    device_type TEXT,
    device_name TEXT,
    user_agent TEXT,
    ip_address TEXT,
    
    -- Status
    is_active INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    last_used_at TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);


-- ─────────────────────────────────────────────────────────────────
-- SETTINGS TABLE (App Configuration)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    
    -- Metadata
    value_type TEXT DEFAULT 'string',          -- string, number, boolean, json
    category TEXT DEFAULT 'general',           -- general, whatsapp, payment, shipping, notifications
    description TEXT,
    is_sensitive INTEGER DEFAULT 0,
    
    updated_by TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────
-- LABELS TABLE (For tagging customers/chats)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#6B7280',
    description TEXT,
    
    -- Counts
    customer_count INTEGER DEFAULT 0,
    chat_count INTEGER DEFAULT 0,
    
    -- Flags
    is_system INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────
-- ERROR LOGS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Error Info
    error_type TEXT NOT NULL,                  -- webhook, api, database, external
    error_code TEXT,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    
    -- Context
    context TEXT,
    phone TEXT,
    endpoint TEXT,
    method TEXT,
    
    -- Severity
    severity TEXT DEFAULT 'error',             -- debug, info, warning, error, critical
    
    -- Resolution
    resolved INTEGER DEFAULT 0,
    resolved_at TEXT,
    resolved_by TEXT,
    resolution_notes TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────
-- MESSAGE FAILURES TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_failures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT,
    phone TEXT NOT NULL,
    
    -- Error
    error_code INTEGER,
    error_message TEXT,
    error_details TEXT,
    
    -- Retry
    retry_count INTEGER DEFAULT 0,
    last_retry_at TEXT,
    next_retry_at TEXT,
    
    -- Status
    status TEXT DEFAULT 'failed',              -- failed, retrying, resolved, abandoned
    resolved_at TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────
-- DELIVERY PINCODES TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_pincodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pincode TEXT UNIQUE NOT NULL,
    
    -- Location
    city TEXT,
    state TEXT,
    zone TEXT,                                 -- metro, tier1, tier2, remote
    
    -- Delivery
    is_serviceable INTEGER DEFAULT 1,
    cod_available INTEGER DEFAULT 0,
    prepaid_only INTEGER DEFAULT 0,
    
    -- Timing
    delivery_days_min INTEGER DEFAULT 3,
    delivery_days_max INTEGER DEFAULT 7,
    
    -- Cost
    shipping_cost REAL DEFAULT 0,
    cod_charge REAL DEFAULT 0,
    free_shipping_above REAL,
    
    -- Restrictions
    blocked INTEGER DEFAULT 0,
    blocked_reason TEXT,
    max_weight REAL,
    
    -- Metadata
    courier_mapping TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- CATEGORIES TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id TEXT UNIQUE NOT NULL,
    
    -- Hierarchy
    parent_id TEXT,
    level INTEGER DEFAULT 0,
    path TEXT,
    
    -- Info
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    
    -- Media
    image_url TEXT,
    icon TEXT,
    
    -- Display
    display_order INTEGER DEFAULT 0,
    
    -- Counts
    product_count INTEGER DEFAULT 0,
    
    -- Flags
    is_active INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    show_in_menu INTEGER DEFAULT 1,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- PRODUCT VARIANTS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL,
    
    -- Variant Info
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    
    -- Options
    option1_name TEXT,
    option1_value TEXT,
    option2_name TEXT,
    option2_value TEXT,
    option3_name TEXT,
    option3_value TEXT,
    
    -- Pricing
    price REAL,
    compare_price REAL,
    cost_price REAL,
    
    -- Inventory
    stock INTEGER DEFAULT 0,
    reserved_stock INTEGER DEFAULT 0,
    
    -- Media
    image_url TEXT,
    
    -- Physical
    weight REAL,
    
    -- Flags
    is_active INTEGER DEFAULT 1,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);


-- ─────────────────────────────────────────────────────────────────
-- PAYMENTS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT UNIQUE NOT NULL,
    
    -- References
    order_id TEXT,
    phone TEXT,
    
    -- Gateway Details
    gateway TEXT NOT NULL,
    gateway_payment_id TEXT,
    gateway_order_id TEXT,
    gateway_signature TEXT,
    
    -- Amount
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'INR',
    fee REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    net_amount REAL,
    
    -- Payment Details
    method TEXT,
    bank TEXT,
    wallet TEXT,
    vpa TEXT,
    card_last4 TEXT,
    card_network TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending',
    failure_reason TEXT,
    
    -- Refund
    refund_amount REAL DEFAULT 0,
    refund_id TEXT,
    refund_status TEXT,
    refunded_at TEXT,
    
    -- Timestamps
    authorized_at TEXT,
    captured_at TEXT,
    failed_at TEXT,
    
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);


-- ─────────────────────────────────────────────────────────────────
-- COUPONS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    
    -- Info
    name TEXT,
    description TEXT,
    
    -- Type
    type TEXT DEFAULT 'percent',               -- percent, fixed, free_shipping
    value REAL NOT NULL,
    
    -- Conditions
    min_order_value REAL DEFAULT 0,
    max_discount REAL,
    
    -- Product Restrictions
    applicable_products TEXT,
    applicable_categories TEXT,
    excluded_products TEXT,
    excluded_categories TEXT,
    
    -- Customer Restrictions
    applicable_segments TEXT,
    first_order_only INTEGER DEFAULT 0,
    
    -- Usage Limits
    usage_limit INTEGER,
    usage_limit_per_customer INTEGER DEFAULT 1,
    used_count INTEGER DEFAULT 0,
    
    -- Validity
    starts_at TEXT,
    expires_at TEXT,
    
    -- Flags
    is_active INTEGER DEFAULT 1,
    is_public INTEGER DEFAULT 1,
    
    -- Stats
    total_discount_given REAL DEFAULT 0,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- COUPON USAGE TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupon_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_code TEXT NOT NULL,
    phone TEXT NOT NULL,
    order_id TEXT,
    
    discount_amount REAL NOT NULL,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (coupon_code) REFERENCES coupons(code),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);


-- ─────────────────────────────────────────────────────────────────
-- REVIEWS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT UNIQUE NOT NULL,
    
    -- Subject
    type TEXT DEFAULT 'product',
    product_id TEXT,
    order_id TEXT,
    
    -- Reviewer
    phone TEXT NOT NULL,
    customer_name TEXT,
    
    -- Review
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT,
    
    -- Media
    images TEXT DEFAULT '[]',
    
    -- Moderation
    status TEXT DEFAULT 'pending',
    moderated_by TEXT,
    moderated_at TEXT,
    rejection_reason TEXT,
    
    -- Response
    response TEXT,
    responded_at TEXT,
    responded_by TEXT,
    
    -- Flags
    is_verified_purchase INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    
    -- Votes
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);


-- ─────────────────────────────────────────────────────────────────
-- NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id TEXT UNIQUE NOT NULL,
    
    -- Recipient
    user_id TEXT,
    
    -- Content
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    
    -- Action
    action_url TEXT,
    action_text TEXT,
    
    -- Related
    related_type TEXT,
    related_id TEXT,
    
    -- Status
    is_read INTEGER DEFAULT 0,
    read_at TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);


-- ─────────────────────────────────────────────────────────────────
-- SCHEDULED NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Target
    phone TEXT NOT NULL,
    
    -- Message
    message_type TEXT DEFAULT 'text',
    message TEXT,
    template_name TEXT,
    template_params TEXT,
    
    -- Schedule
    scheduled_for TEXT NOT NULL,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    
    -- Status
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    message_id TEXT,
    error_message TEXT,
    
    -- Context
    trigger_type TEXT,
    trigger_id TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ─────────────────────────────────────────────────────────────────
-- TEAMS TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT UNIQUE NOT NULL,
    
    -- Info
    name TEXT NOT NULL,
    description TEXT,
    
    -- Lead
    lead_agent_id TEXT,
    
    -- Stats
    member_count INTEGER DEFAULT 0,
    
    -- Flags
    is_active INTEGER DEFAULT 1,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (lead_agent_id) REFERENCES agents(agent_id)
);


-- ─────────────────────────────────────────────────────────────────
-- AUDIT LOG TABLE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Action
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    
    -- User
    user_id TEXT,
    user_name TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    -- Changes
    old_values TEXT,
    new_values TEXT,
    
    -- Context
    notes TEXT,
    
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ═══════════════════════════════════════════════════════════════
-- YOUR ORIGINAL INDEXES (UNCHANGED)
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
-- ADDITIONAL INDEXES (For enhancements & new tables)
-- ═══════════════════════════════════════════════════════════════

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_phone_timestamp ON messages(phone, timestamp DESC);

-- Chats
CREATE INDEX IF NOT EXISTS idx_chats_starred ON chats(is_starred);
CREATE INDEX IF NOT EXISTS idx_chats_needs_attention ON chats(needs_attention);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_last_seen ON customers(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_customers_order_count ON customers(order_count DESC);
CREATE INDEX IF NOT EXISTS idx_customers_total_spent ON customers(total_spent DESC);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_id);
CREATE INDEX IF NOT EXISTS idx_orders_phone_status ON orders(phone, status);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_product_id ON products(product_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_bestseller ON products(is_bestseller);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Quick Replies
CREATE INDEX IF NOT EXISTS idx_quick_replies_priority ON quick_replies(priority DESC);

-- Broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_status ON broadcast_recipients(status);

-- Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_phone ON analytics(phone);

-- Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Settings
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- Labels
CREATE INDEX IF NOT EXISTS idx_labels_name ON labels(name);

-- Error Logs
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);

-- Message Failures
CREATE INDEX IF NOT EXISTS idx_message_failures_phone ON message_failures(phone);
CREATE INDEX IF NOT EXISTS idx_message_failures_status ON message_failures(status);

-- Delivery Pincodes
CREATE INDEX IF NOT EXISTS idx_pincodes_pincode ON delivery_pincodes(pincode);
CREATE INDEX IF NOT EXISTS idx_pincodes_serviceable ON delivery_pincodes(is_serviceable);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- Product Variants
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Coupons
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Scheduled Notifications
CREATE INDEX IF NOT EXISTS idx_scheduled_notif_time ON scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notif_status ON scheduled_notifications(status);

-- Conversation State
CREATE INDEX IF NOT EXISTS idx_conv_state_expires ON conversation_state(expires_at);


-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS (Auto-update timestamps)
-- ═══════════════════════════════════════════════════════════════

CREATE TRIGGER IF NOT EXISTS trg_messages_updated 
AFTER UPDATE ON messages
BEGIN
    UPDATE messages SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_chats_updated 
AFTER UPDATE ON chats
BEGIN
    UPDATE chats SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_customers_updated 
AFTER UPDATE ON customers
BEGIN
    UPDATE customers SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_orders_updated 
AFTER UPDATE ON orders
BEGIN
    UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_products_updated 
AFTER UPDATE ON products
BEGIN
    UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_quick_replies_updated 
AFTER UPDATE ON quick_replies
BEGIN
    UPDATE quick_replies SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_broadcasts_updated 
AFTER UPDATE ON broadcasts
BEGIN
    UPDATE broadcasts SET updated_at = datetime('now') WHERE id = NEW.id;
END;


-- ═══════════════════════════════════════════════════════════════
-- VIEWS (Common Queries)
-- ═══════════════════════════════════════════════════════════════

-- Active Chats View
CREATE VIEW IF NOT EXISTS v_active_chats AS
SELECT 
    c.*,
    cust.name as customer_full_name,
    cust.segment,
    cust.order_count,
    cust.total_spent
FROM chats c
LEFT JOIN customers cust ON c.phone = cust.phone
WHERE c.status IN ('open', 'pending')
ORDER BY c.is_starred DESC, c.last_timestamp DESC;

-- Today's Stats View
CREATE VIEW IF NOT EXISTS v_today_stats AS
SELECT
    (SELECT COUNT(*) FROM messages WHERE date(timestamp) = date('now') AND direction = 'incoming') as messages_in,
    (SELECT COUNT(*) FROM messages WHERE date(timestamp) = date('now') AND direction = 'outgoing') as messages_out,
    (SELECT COUNT(*) FROM orders WHERE date(created_at) = date('now')) as orders_today,
    (SELECT COALESCE(SUM(total), 0) FROM orders WHERE date(created_at) = date('now') AND status != 'cancelled') as revenue_today,
    (SELECT COUNT(*) FROM customers WHERE date(first_seen) = date('now')) as new_customers,
    (SELECT COUNT(*) FROM chats WHERE unread_count > 0) as unread_chats;

-- Pending Orders View
CREATE VIEW IF NOT EXISTS v_pending_orders AS
SELECT 
    o.*,
    c.name as customer_full_name,
    c.email as customer_email
FROM orders o
LEFT JOIN customers c ON o.phone = c.phone
WHERE o.status IN ('pending', 'confirmed', 'processing')
ORDER BY o.created_at DESC;

-- Low Stock Products View
CREATE VIEW IF NOT EXISTS v_low_stock_products AS
SELECT *
FROM products
WHERE is_active = 1 
  AND track_inventory = 1 
  AND stock <= low_stock_threshold
ORDER BY stock ASC;


-- ═══════════════════════════════════════════════════════════════
-- YOUR ORIGINAL DEFAULT DATA (UNCHANGED)
-- ═══════════════════════════════════════════════════════════════

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

INSERT OR IGNORE INTO agents (agent_id, name, email, role) VALUES
('admin', 'KAAPAV Admin', 'admin@kaapav.com', 'admin');


-- ═══════════════════════════════════════════════════════════════
-- DEFAULT DATA FOR NEW TABLES
-- ═══════════════════════════════════════════════════════════════

-- Default admin user
INSERT OR IGNORE INTO users (user_id, email, name, role) VALUES
('admin', 'admin@kaapav.com', 'KAAPAV Admin', 'super_admin');

-- Default settings
INSERT OR IGNORE INTO settings (key, value, category, description) VALUES
('business_name', 'KAAPAV Fashion Jewellery', 'general', 'Business name'),
('business_phone', '919148330016', 'general', 'WhatsApp business number'),
('business_email', 'hello@kaapav.com', 'general', 'Business email'),
('currency', 'INR', 'general', 'Default currency'),
('timezone', 'Asia/Kolkata', 'general', 'Default timezone'),
('free_shipping_threshold', '498', 'shipping', 'Minimum order for free shipping'),
('default_shipping_cost', '49', 'shipping', 'Default shipping cost'),
('cod_enabled', 'false', 'payment', 'Cash on delivery enabled'),
('razorpay_enabled', 'true', 'payment', 'Razorpay payments enabled'),
('auto_reply_enabled', 'true', 'whatsapp', 'Auto-reply enabled'),
('ai_enabled', 'true', 'whatsapp', 'AI responses enabled'),
('working_hours_start', '09:00', 'general', 'Business hours start'),
('working_hours_end', '21:00', 'general', 'Business hours end'),
('max_broadcast_rate', '20', 'whatsapp', 'Messages per minute for broadcasts'),
('cart_abandonment_delay', '60', 'whatsapp', 'Minutes before cart reminder'),
('order_confirmation_auto', 'true', 'whatsapp', 'Auto send order confirmation');

-- Default labels
INSERT OR IGNORE INTO labels (name, color, is_system) VALUES
('VIP', '#FFD700', 1),
('New Customer', '#10B981', 1),
('Repeat Buyer', '#3B82F6', 1),
('Hot Lead', '#EF4444', 1),
('Pending Payment', '#F59E0B', 1),
('Order Issue', '#DC2626', 1),
('Interested', '#8B5CF6', 0),
('Follow Up', '#06B6D4', 0),
('Wholesale', '#059669', 0),
('Influencer', '#EC4899', 0);

-- Default categories
INSERT OR IGNORE INTO categories (category_id, name, slug, display_order, is_active) VALUES
('CAT_EARRINGS', 'Earrings', 'earrings', 1, 1),
('CAT_NECKLACES', 'Necklaces', 'necklaces', 2, 1),
('CAT_BANGLES', 'Bangles & Bracelets', 'bangles', 3, 1),
('CAT_RINGS', 'Rings', 'rings', 4, 1),
('CAT_PENDANTS', 'Pendants', 'pendants', 5, 1),
('CAT_SETS', 'Jewellery Sets', 'sets', 6, 1),
('CAT_ANKLETS', 'Anklets', 'anklets', 7, 1),
('CAT_HAIR', 'Hair Accessories', 'hair-accessories', 8, 1);

-- Default coupons
INSERT OR IGNORE INTO coupons (code, name, type, value, min_order_value, is_active) VALUES
('WELCOME10', 'Welcome Discount', 'percent', 10, 299, 1),
('FLAT50', 'Flat ₹50 Off', 'fixed', 50, 499, 1),
('FREESHIP', 'Free Shipping', 'free_shipping', 0, 0, 1);


-- ═══════════════════════════════════════════════════════════════
-- DONE! 🎉
-- ═══════════════════════════════════════════════════════════════

/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - CATALOG SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Product catalog management
 * ═══════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// GET PRODUCTS
// ═══════════════════════════════════════════════════════════════

export async function getProducts(filters, env) {
  const {
    category,
    subcategory,
    search,
    min_price,
    max_price,
    in_stock,
    featured,
    limit = 50,
    offset = 0
  } = filters || {};

  let query = `SELECT * FROM products WHERE is_active = 1`;
  const params = [];

  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  if (subcategory) {
    query += ` AND subcategory = ?`;
    params.push(subcategory);
  }

  if (search) {
    query += ` AND (name LIKE ? OR description LIKE ? OR product_id LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (min_price) {
    query += ` AND price >= ?`;
    params.push(min_price);
  }

  if (max_price) {
    query += ` AND price <= ?`;
    params.push(max_price);
  }

  if (in_stock !== undefined) {
    query += ` AND in_stock = ?`;
    params.push(in_stock ? 1 : 0);
  }

  if (featured) {
    query += ` AND is_featured = 1`;
  }

  query += ` ORDER BY order_count DESC, created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return results || [];
}

// ═══════════════════════════════════════════════════════════════
// GET PRODUCT BY ID
// ═══════════════════════════════════════════════════════════════

export async function getProduct(productId, env) {
  return env.DB.prepare(`
    SELECT * FROM products WHERE product_id = ? AND is_active = 1
  `).bind(productId).first();
}

// ═══════════════════════════════════════════════════════════════
// GET CATEGORIES
// ═══════════════════════════════════════════════════════════════

export async function getCategories(env) {
  const { results } = await env.DB.prepare(`
    SELECT 
      category,
      COUNT(*) as product_count,
      MIN(price) as min_price,
      MAX(price) as max_price
    FROM products
    WHERE is_active = 1
    GROUP BY category
    ORDER BY product_count DESC
  `).all();

  return results || [];
}

// ═══════════════════════════════════════════════════════════════
// CREATE PRODUCT
// ═══════════════════════════════════════════════════════════════

export async function createProduct(productData, env) {
  const {
    product_id,
    name,
    description,
    category,
    subcategory,
    price,
    compare_price,
    stock,
    image_url,
    images,
    material,
    weight,
    tags,
    wa_product_id
  } = productData;

  if (!product_id || !name || !price) {
    return { success: false, error: 'Missing required fields' };
  }

  try {
    await env.DB.prepare(`
      INSERT INTO products (
        product_id, name, description, category, subcategory,
        price, compare_price, discount_percent, stock, in_stock,
        image_url, images, material, weight, tags, wa_product_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      product_id,
      name,
      description || '',
      category || '',
      subcategory || '',
      price,
      compare_price || null,
      compare_price ? Math.round((1 - price / compare_price) * 100) : 0,
      stock || 0,
      stock > 0 ? 1 : 0,
      image_url || '',
      images ? JSON.stringify(images) : '[]',
      material || '',
      weight || '',
      tags ? JSON.stringify(tags) : '[]',
      wa_product_id || ''
    ).run();

    return { success: true, product_id };
  } catch (error) {
    console.error('[Catalog] Create error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE PRODUCT
// ═══════════════════════════════════════════════════════════════

export async function updateProduct(productId, updates, env) {
  const allowedFields = [
    'name', 'description', 'category', 'subcategory',
    'price', 'compare_price', 'stock', 'in_stock',
    'image_url', 'images', 'material', 'weight', 'tags',
    'is_active', 'is_featured'
  ];

  const updateClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      updateClauses.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
  }

  if (updateClauses.length === 0) {
    return { success: false, error: 'No valid fields to update' };
  }

  // Update discount percent if prices changed
  if (updates.price || updates.compare_price) {
    const current = await getProduct(productId, env);
    const newPrice = updates.price || current.price;
    const newCompare = updates.compare_price || current.compare_price;
    
    if (newCompare && newCompare > newPrice) {
      updateClauses.push('discount_percent = ?');
      values.push(Math.round((1 - newPrice / newCompare) * 100));
    }
  }

  // Update stock status
  if (updates.stock !== undefined) {
    updateClauses.push('in_stock = ?');
    values.push(updates.stock > 0 ? 1 : 0);
  }

  updateClauses.push('updated_at = datetime("now")');
  values.push(productId);

  await env.DB.prepare(`
    UPDATE products SET ${updateClauses.join(', ')} WHERE product_id = ?
  `).bind(...values).run();

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// UPDATE STOCK
// ═══════════════════════════════════════════════════════════════

export async function updateStock(productId, quantity, operation = 'set', env) {
  let query;
  
  switch (operation) {
    case 'add':
      query = `UPDATE products SET stock = stock + ?, in_stock = 1 WHERE product_id = ?`;
      break;
    case 'subtract':
      query = `UPDATE products SET stock = MAX(0, stock - ?), in_stock = CASE WHEN stock - ? > 0 THEN 1 ELSE 0 END WHERE product_id = ?`;
      await env.DB.prepare(query).bind(quantity, quantity, productId).run();
      return { success: true };
    case 'set':
    default:
      query = `UPDATE products SET stock = ?, in_stock = ? WHERE product_id = ?`;
      await env.DB.prepare(query).bind(quantity, quantity > 0 ? 1 : 0, productId).run();
      return { success: true };
  }

  await env.DB.prepare(query).bind(quantity, productId).run();
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// GET BESTSELLERS
// ═══════════════════════════════════════════════════════════════

export async function getBestsellers(limit = 10, env) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM products 
    WHERE is_active = 1 AND in_stock = 1
    ORDER BY order_count DESC
    LIMIT ?
  `).bind(limit).all();

  return results || [];
}

// ═══════════════════════════════════════════════════════════════
// GET NEW ARRIVALS
// ═══════════════════════════════════════════════════════════════

export async function getNewArrivals(limit = 10, env) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM products 
    WHERE is_active = 1 AND in_stock = 1
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  return results || [];
}

// ═══════════════════════════════════════════════════════════════
// SYNC WITH WHATSAPP CATALOG
// ═══════════════════════════════════════════════════════════════

export async function syncWhatsAppCatalog(env) {
  if (!env.CATALOG_ID || !env.WA_TOKEN) {
    return { success: false, error: 'Catalog not configured' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${env.GRAPH_API_VERSION || 'v21.0'}/${env.CATALOG_ID}/products`,
      {
        headers: { 'Authorization': `Bearer ${env.WA_TOKEN}` }
      }
    );

    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const products = data.data || [];
    let synced = 0;

    for (const product of products) {
      // Update or insert product
      const existing = await env.DB.prepare(`
        SELECT product_id FROM products WHERE wa_product_id = ?
      `).bind(product.id).first();

      if (existing) {
        await updateProduct(existing.product_id, {
          name: product.name,
          price: parseFloat(product.price?.replace(/[^0-9.]/g, '') || 0),
          image_url: product.image_url,
          in_stock: product.availability === 'in stock'
        }, env);
      }
      
      synced++;
    }

    return { success: true, synced };
  } catch (error) {
    console.error('[Catalog] Sync error:', error.message);
    return { success: false, error: error.message };
  }
}
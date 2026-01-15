/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - SHIPPING SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Shiprocket integration for shipping & tracking
 * ═══════════════════════════════════════════════════════════════
 */

import { sendText, sendShippingUpdate, LINKS } from '../utils/sendMessage.js';

// ═══════════════════════════════════════════════════════════════
// SHIPROCKET API BASE
// ═══════════════════════════════════════════════════════════════

const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';

async function getShiprocketToken(env) {
  // Use stored token if available
  if (env.SHIPROCKET_TOKEN) {
    return env.SHIPROCKET_TOKEN;
  }

  // Or authenticate with email/password
  if (env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD) {
    try {
      const response = await fetch(`${SHIPROCKET_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: env.SHIPROCKET_EMAIL,
          password: env.SHIPROCKET_PASSWORD
        })
      });

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('[Shipping] Auth failed:', error.message);
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// CREATE SHIPMENT
// ═══════════════════════════════════════════════════════════════

export async function createShipment(order, env) {
  const token = await getShiprocketToken(env);
  
  if (!token) {
    console.warn('[Shipping] Shiprocket not configured');
    return { success: false, error: 'Shiprocket not configured' };
  }

  try {
    // Parse items
    const items = typeof order.items === 'string' 
      ? JSON.parse(order.items) 
      : order.items;

    // Prepare order items for Shiprocket
    const orderItems = items.map(item => ({
      name: item.name,
      sku: item.product_id || item.sku || `SKU-${Date.now()}`,
      units: item.quantity || 1,
      selling_price: item.price,
      discount: 0,
      tax: 0,
      hsn: ''
    }));

    // Create order in Shiprocket
    const response = await fetch(`${SHIPROCKET_API}/orders/create/adhoc`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id: order.order_id,
        order_date: new Date().toISOString().split('T')[0],
        pickup_location: env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
        channel_id: '',
        comment: `WhatsApp Order - ${order.order_id}`,
        billing_customer_name: order.customer_name || 'Customer',
        billing_last_name: '',
        billing_address: order.shipping_address,
        billing_address_2: '',
        billing_city: order.shipping_city || 'City',
        billing_pincode: order.shipping_pincode,
        billing_state: order.shipping_state || 'State',
        billing_country: 'India',
        billing_email: order.email || '',
        billing_phone: order.phone.replace('91', ''),
        shipping_is_billing: true,
        order_items: orderItems,
        payment_method: order.payment_status === 'paid' ? 'Prepaid' : 'COD',
        shipping_charges: order.shipping_cost || 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: order.discount || 0,
        sub_total: order.subtotal || order.total,
        length: 10,
        breadth: 10,
        height: 5,
        weight: 0.2
      })
    });

    const data = await response.json();

    if (data.order_id) {
      // Update order with Shiprocket order ID
      await env.DB.prepare(`
        UPDATE orders SET 
          shiprocket_order_id = ?,
          status = 'processing',
          updated_at = datetime('now')
        WHERE order_id = ?
      `).bind(data.order_id, order.order_id).run();

      console.log('[Shipping] ✅ Order created:', data.order_id);

      return {
        success: true,
        shiprocket_order_id: data.order_id,
        shipment_id: data.shipment_id
      };
    }

    return { success: false, error: data.message || 'Failed to create order' };

  } catch (error) {
    console.error('[Shipping] Create shipment error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// GENERATE AWB (ASSIGN COURIER)
// ═══════════════════════════════════════════════════════════════

export async function generateAWB(shipmentId, courierId, env) {
  const token = await getShiprocketToken(env);
  if (!token) return { success: false, error: 'Not configured' };

  try {
    const response = await fetch(`${SHIPROCKET_API}/courier/assign/awb`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shipment_id: shipmentId,
        courier_id: courierId
      })
    });

    const data = await response.json();

    if (data.awb_assign_status === 1) {
      return {
        success: true,
        awb_code: data.response.data.awb_code,
        courier_name: data.response.data.courier_name
      };
    }

    return { success: false, error: data.message || 'AWB generation failed' };

  } catch (error) {
    console.error('[Shipping] AWB error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// GET TRACKING INFO
// ═══════════════════════════════════════════════════════════════

export async function getTrackingInfo(awbCode, env) {
  const token = await getShiprocketToken(env);
  
  if (!token) {
    // Return public tracking URL
    return {
      success: true,
      tracking_url: `${LINKS.shiprocket}?tracking_id=${awbCode}`,
      status: 'unknown'
    };
  }

  try {
    const response = await fetch(`${SHIPROCKET_API}/courier/track/awb/${awbCode}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.tracking_data) {
      const tracking = data.tracking_data;
      return {
        success: true,
        awb_code: awbCode,
        tracking_url: tracking.track_url || `${LINKS.shiprocket}?tracking_id=${awbCode}`,
        current_status: tracking.shipment_status,
        current_status_id: tracking.shipment_status_id,
        delivered_date: tracking.delivered_date,
        edd: tracking.edd,
        activities: tracking.shipment_track_activities || []
      };
    }

    return { success: false, error: 'No tracking data' };

  } catch (error) {
    console.error('[Shipping] Tracking error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// CHECK PINCODE SERVICEABILITY
// ═══════════════════════════════════════════════════════════════

export async function checkPincodeServiceability(pickupPincode, deliveryPincode, weight = 0.5, env) {
  const token = await getShiprocketToken(env);
  
  if (!token) {
    // Assume serviceable for common pincodes
    return { success: true, serviceable: true };
  }

  try {
    const response = await fetch(
      `${SHIPROCKET_API}/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${weight}&cod=0`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    const data = await response.json();

    if (data.data && data.data.available_courier_companies) {
      const couriers = data.data.available_courier_companies;
      
      return {
        success: true,
        serviceable: couriers.length > 0,
        couriers: couriers.map(c => ({
          id: c.courier_company_id,
          name: c.courier_name,
          rate: c.rate,
          etd: c.etd,
          cod: c.cod === 1
        })),
        recommended: couriers[0] // Cheapest/fastest
      };
    }

    return { success: true, serviceable: false };

  } catch (error) {
    console.error('[Shipping] Serviceability error:', error.message);
    return { success: true, serviceable: true }; // Assume serviceable on error
  }
}

// ═══════════════════════════════════════════════════════════════
// SYNC TRACKING STATUS
// ═══════════════════════════════════════════════════════════════

export async function syncTrackingStatus(orderId, env) {
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ? AND tracking_id IS NOT NULL
  `).bind(orderId).first();

  if (!order || !order.tracking_id) {
    return { success: false, error: 'No tracking ID' };
  }

  const tracking = await getTrackingInfo(order.tracking_id, env);

  if (!tracking.success) {
    return tracking;
  }

  // Map Shiprocket status to our status
  const statusMap = {
    1: 'shipped',           // AWB Assigned
    2: 'shipped',           // Label Generated
    3: 'shipped',           // Pickup Scheduled
    4: 'shipped',           // Picked Up
    5: 'in_transit',        // In Transit
    6: 'out_for_delivery',  // Out for Delivery
    7: 'delivered',         // Delivered
    8: 'cancelled',         // Cancelled
    9: 'cancelled',         // RTO Initiated
    10: 'returned'          // RTO Delivered
  };

  const newStatus = statusMap[tracking.current_status_id] || order.status;

  // Update if status changed
  if (newStatus !== order.status) {
    await env.DB.prepare(`
      UPDATE orders SET 
        status = ?,
        delivered_at = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE delivered_at END,
        updated_at = datetime('now')
      WHERE order_id = ?
    `).bind(newStatus, newStatus, orderId).run();

    // Notify customer
    await sendShippingUpdate(
      order.phone,
      orderId,
      order.tracking_id,
      order.courier || 'Courier',
      newStatus,
      'en',
      env
    );

    console.log(`[Shipping] Order ${orderId} status: ${order.status} → ${newStatus}`);
  }

  return {
    success: true,
    previous_status: order.status,
    current_status: newStatus,
    tracking
  };
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULE PICKUP
// ═══════════════════════════════════════════════════════════════

export async function schedulePickup(shipmentIds, pickupDate, env) {
  const token = await getShiprocketToken(env);
  if (!token) return { success: false, error: 'Not configured' };

  try {
    const response = await fetch(`${SHIPROCKET_API}/courier/generate/pickup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shipment_id: shipmentIds,
        pickup_date: pickupDate // YYYY-MM-DD format
      })
    });

    const data = await response.json();
    return { success: true, ...data };

  } catch (error) {
    console.error('[Shipping] Pickup error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// CANCEL SHIPMENT
// ═══════════════════════════════════════════════════════════════

export async function cancelShipment(awbCodes, env) {
  const token = await getShiprocketToken(env);
  if (!token) return { success: false, error: 'Not configured' };

  try {
    const response = await fetch(`${SHIPROCKET_API}/orders/cancel/shipment/awbs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        awbs: Array.isArray(awbCodes) ? awbCodes : [awbCodes]
      })
    });

    const data = await response.json();
    return { success: true, ...data };

  } catch (error) {
    console.error('[Shipping] Cancel error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// GET SHIPPING LABEL
// ═══════════════════════════════════════════════════════════════

export async function getShippingLabel(shipmentIds, env) {
  const token = await getShiprocketToken(env);
  if (!token) return { success: false, error: 'Not configured' };

  try {
    const response = await fetch(`${SHIPROCKET_API}/courier/generate/label`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        shipment_id: Array.isArray(shipmentIds) ? shipmentIds : [shipmentIds]
      })
    });

    const data = await response.json();

    if (data.label_url) {
      return { success: true, label_url: data.label_url };
    }

    return { success: false, error: 'Label generation failed' };

  } catch (error) {
    console.error('[Shipping] Label error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// GET INVOICE
// ═══════════════════════════════════════════════════════════════

export async function getInvoice(orderIds, env) {
  const token = await getShiprocketToken(env);
  if (!token) return { success: false, error: 'Not configured' };

  try {
    const response = await fetch(`${SHIPROCKET_API}/orders/print/invoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ids: Array.isArray(orderIds) ? orderIds : [orderIds]
      })
    });

    const data = await response.json();

    if (data.invoice_url) {
      return { success: true, invoice_url: data.invoice_url };
    }

    return { success: false, error: 'Invoice generation failed' };

  } catch (error) {
    console.error('[Shipping] Invoice error:', error.message);
    return { success: false, error: error.message };
  }
}
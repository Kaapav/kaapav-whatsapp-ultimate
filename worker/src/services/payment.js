/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV WHATSAPP - PAYMENT SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Razorpay integration for payments
 * ═══════════════════════════════════════════════════════════════
 */

import { sendText, sendReplyButtons, sendOrderConfirmation, LINKS } from '../utils/sendMessage.js';

// ═══════════════════════════════════════════════════════════════
// CREATE PAYMENT LINK
// ═══════════════════════════════════════════════════════════════

export async function createPaymentLink(order, env) {
  if (!env.RAZORPAY_KEY || !env.RAZORPAY_SECRET) {
    console.warn('[Payment] Razorpay not configured, using static link');
    return LINKS.payment;
  }

  try {
    const auth = btoa(`${env.RAZORPAY_KEY}:${env.RAZORPAY_SECRET}`);
    
    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(order.total * 100), // Razorpay uses paise
        currency: 'INR',
        accept_partial: false,
        first_min_partial_amount: 0,
        description: `KAAPAV Order: ${order.order_id}`,
        customer: {
          name: order.customer_name || 'Customer',
          contact: `+${order.phone}`,
          email: order.email || undefined
        },
        notify: {
          sms: true,
          email: !!order.email,
          whatsapp: false
        },
        reminder_enable: true,
        notes: {
          order_id: order.order_id,
          phone: order.phone,
          source: 'whatsapp'
        },
        callback_url: `${env.WORKER_URL}/api/payment/callback?order_id=${order.order_id}`,
        callback_method: 'get',
        expire_by: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('[Payment] Razorpay error:', data.error);
      return LINKS.payment;
    }

    // Save payment link to order
    if (data.short_url) {
      await env.DB.prepare(`
        UPDATE orders SET payment_link = ?, payment_link_id = ?
        WHERE order_id = ?
      `).bind(data.short_url, data.id, order.order_id).run();
    }

    console.log('[Payment] ✅ Link created:', data.short_url);
    return data.short_url;

  } catch (error) {
    console.error('[Payment] Create link error:', error.message);
    return LINKS.payment;
  }
}

// ═══════════════════════════════════════════════════════════════
// VERIFY PAYMENT
// ═══════════════════════════════════════════════════════════════

export async function verifyPayment(paymentId, orderId, signature, env) {
  if (!env.RAZORPAY_KEY || !env.RAZORPAY_SECRET) {
    return { verified: false, error: 'Razorpay not configured' };
  }

  try {
    const auth = btoa(`${env.RAZORPAY_KEY}:${env.RAZORPAY_SECRET}`);
    
    // Fetch payment details
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    const payment = await response.json();

    if (payment.error) {
      return { verified: false, error: payment.error.description };
    }

    // Check payment status
    if (payment.status !== 'captured') {
      return { verified: false, error: `Payment status: ${payment.status}` };
    }

    // Verify order ID matches
    const paymentOrderId = payment.notes?.order_id;
    if (paymentOrderId && paymentOrderId !== orderId) {
      return { verified: false, error: 'Order ID mismatch' };
    }

    return {
      verified: true,
      payment: {
        id: payment.id,
        amount: payment.amount / 100,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        status: payment.status,
        created_at: new Date(payment.created_at * 1000).toISOString()
      }
    };

  } catch (error) {
    console.error('[Payment] Verify error:', error.message);
    return { verified: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// HANDLE PAYMENT CALLBACK
// ═══════════════════════════════════════════════════════════════

export async function handlePaymentCallback(request, env) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('order_id');
  const paymentId = url.searchParams.get('razorpay_payment_id');
  const paymentLinkId = url.searchParams.get('razorpay_payment_link_id');
  const paymentLinkStatus = url.searchParams.get('razorpay_payment_link_status');
  const signature = url.searchParams.get('razorpay_signature');

  console.log('[Payment] Callback received:', { orderId, paymentId, paymentLinkStatus });

  if (!orderId) {
    return Response.redirect(`${LINKS.website}/payment-error?error=missing_order`, 302);
  }

  // Get order
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();

  if (!order) {
    return Response.redirect(`${LINKS.website}/payment-error?error=order_not_found`, 302);
  }

  // Payment successful
  if (paymentLinkStatus === 'paid' && paymentId) {
    // Verify payment
    const verification = await verifyPayment(paymentId, orderId, signature, env);

    if (verification.verified) {
      // Update order
      await env.DB.prepare(`
        UPDATE orders SET 
          payment_status = 'paid',
          payment_id = ?,
          payment_method = ?,
          paid_at = datetime('now'),
          status = 'confirmed',
          confirmed_at = datetime('now'),
          updated_at = datetime('now')
        WHERE order_id = ?
      `).bind(paymentId, verification.payment?.method || 'razorpay', orderId).run();

      // Update customer stats
      await env.DB.prepare(`
        UPDATE customers SET 
          total_spent = total_spent + ?,
          last_order_amount = ?,
          last_purchase = datetime('now'),
          first_purchase = COALESCE(first_purchase, datetime('now')),
          updated_at = datetime('now')
        WHERE phone = ?
      `).bind(order.total, order.total, order.phone).run();

      // Send confirmation via WhatsApp
      await sendOrderConfirmation(order.phone, {
        ...order,
        status: 'confirmed',
        payment_status: 'paid'
      }, 'en', env);

      // Log analytics
      await env.DB.prepare(`
        INSERT INTO analytics (event_type, event_name, phone, order_id, data, timestamp)
        VALUES ('payment', 'success', ?, ?, ?, datetime('now'))
      `).bind(order.phone, orderId, JSON.stringify({
        payment_id: paymentId,
        amount: order.total,
        method: verification.payment?.method
      })).run();

      // Redirect to success page
      return Response.redirect(`${LINKS.website}/order-success?order_id=${orderId}`, 302);
    }
  }

  // Payment failed or cancelled
  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, phone, order_id, data, timestamp)
    VALUES ('payment', 'failed', ?, ?, ?, datetime('now'))
  `).bind(order.phone, orderId, JSON.stringify({
    status: paymentLinkStatus,
    payment_id: paymentId
  })).run();

  // Notify customer
  await sendReplyButtons(
    order.phone,
    `❌ *Payment Not Completed*\n\n` +
    `Order: ${orderId}\n` +
    `Amount: ₹${order.total}\n\n` +
    `Please try again or contact support if you need help.`,
    [
      { id: `PAY_${orderId}`, title: '🔄 Try Again' },
      { id: 'CHAT_NOW', title: '💬 Support' }
    ],
    env
  );

  return Response.redirect(`${LINKS.website}/payment-failed?order_id=${orderId}`, 302);
}

// ═══════════════════════════════════════════════════════════════
// HANDLE RAZORPAY WEBHOOK
// ═══════════════════════════════════════════════════════════════

export async function handleRazorpayWebhook(request, env) {
  try {
    const body = await request.json();
    const event = body.event;
    const payload = body.payload;

    console.log('[Payment] Webhook:', event);

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload.payment.entity, env);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload.payment.entity, env);
        break;

      case 'payment_link.paid':
        await handlePaymentLinkPaid(payload.payment_link.entity, payload.payment.entity, env);
        break;

      case 'refund.created':
        await handleRefundCreated(payload.refund.entity, env);
        break;

      default:
        console.log('[Payment] Unhandled webhook event:', event);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('[Payment] Webhook error:', error.message);
    return new Response('Error', { status: 500 });
  }
}

async function handlePaymentCaptured(payment, env) {
  const orderId = payment.notes?.order_id;
  if (!orderId) return;

  await env.DB.prepare(`
    UPDATE orders SET 
      payment_status = 'paid',
      payment_id = ?,
      payment_method = ?,
      paid_at = datetime('now'),
      status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
      confirmed_at = CASE WHEN status = 'pending' THEN datetime('now') ELSE confirmed_at END,
      updated_at = datetime('now')
    WHERE order_id = ? AND payment_status != 'paid'
  `).bind(payment.id, payment.method, orderId).run();
}

async function handlePaymentFailed(payment, env) {
  const orderId = payment.notes?.order_id;
  if (!orderId) return;

  await env.DB.prepare(`
    INSERT INTO analytics (event_type, event_name, order_id, data, timestamp)
    VALUES ('payment', 'webhook_failed', ?, ?, datetime('now'))
  `).bind(orderId, JSON.stringify({
    error_code: payment.error_code,
    error_description: payment.error_description
  })).run();
}

async function handlePaymentLinkPaid(paymentLink, payment, env) {
  const orderId = paymentLink.notes?.order_id;
  if (!orderId) return;

  await handlePaymentCaptured(payment, env);
}

async function handleRefundCreated(refund, env) {
  const paymentId = refund.payment_id;
  
  // Find order by payment ID
  const order = await env.DB.prepare(`
    SELECT order_id, phone FROM orders WHERE payment_id = ?
  `).bind(paymentId).first();

  if (order) {
    await env.DB.prepare(`
      UPDATE orders SET 
        payment_status = CASE 
          WHEN ? >= total THEN 'refunded' 
          ELSE 'partial_refund' 
        END,
        updated_at = datetime('now')
      WHERE order_id = ?
    `).bind(refund.amount / 100, order.order_id).run();

    // Notify customer
    await sendText(
      order.phone,
      `💸 *Refund Processed*\n\n` +
      `Order: ${order.order_id}\n` +
      `Amount: ₹${refund.amount / 100}\n\n` +
      `The refund will reflect in 5-7 business days.\n\n` +
      `Thank you for shopping with KAAPAV! 💎`,
      env
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// CREATE REFUND
// ═══════════════════════════════════════════════════════════════

export async function createRefund(orderId, amount, reason, env) {
  const order = await env.DB.prepare(`
    SELECT * FROM orders WHERE order_id = ?
  `).bind(orderId).first();

  if (!order || !order.payment_id) {
    return { success: false, error: 'Order or payment not found' };
  }

  if (!env.RAZORPAY_KEY || !env.RAZORPAY_SECRET) {
    return { success: false, error: 'Razorpay not configured' };
  }

  try {
    const auth = btoa(`${env.RAZORPAY_KEY}:${env.RAZORPAY_SECRET}`);
    const refundAmount = amount || order.total;

    const response = await fetch(`https://api.razorpay.com/v1/payments/${order.payment_id}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(refundAmount * 100),
        speed: 'normal',
        notes: {
          order_id: orderId,
          reason: reason || 'Customer requested refund'
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.description };
    }

    // Update order
    await env.DB.prepare(`
      UPDATE orders SET 
        payment_status = CASE WHEN ? >= total THEN 'refunded' ELSE 'partial_refund' END,
        status = 'cancelled',
        cancellation_reason = ?,
        cancelled_at = datetime('now'),
        updated_at = datetime('now')
      WHERE order_id = ?
    `).bind(refundAmount, reason || 'Refund processed', orderId).run();

    return {
      success: true,
      refund_id: data.id,
      amount: refundAmount
    };

  } catch (error) {
    console.error('[Payment] Refund error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// GET PAYMENT STATUS
// ═══════════════════════════════════════════════════════════════

export async function getPaymentStatus(orderId, env) {
  const order = await env.DB.prepare(`
    SELECT order_id, total, payment_status, payment_id, payment_link, paid_at
    FROM orders WHERE order_id = ?
  `).bind(orderId).first();

  if (!order) {
    return null;
  }

  // If we have a payment ID, get live status from Razorpay
  if (order.payment_id && env.RAZORPAY_KEY && env.RAZORPAY_SECRET) {
    try {
      const auth = btoa(`${env.RAZORPAY_KEY}:${env.RAZORPAY_SECRET}`);
      
      const response = await fetch(`https://api.razorpay.com/v1/payments/${order.payment_id}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      const payment = await response.json();

      if (!payment.error) {
        return {
          ...order,
          razorpay_status: payment.status,
          method: payment.method,
          bank: payment.bank,
          wallet: payment.wallet,
          vpa: payment.vpa
        };
      }
    } catch (e) {
      console.warn('[Payment] Status fetch failed:', e.message);
    }
  }

  return order;
}
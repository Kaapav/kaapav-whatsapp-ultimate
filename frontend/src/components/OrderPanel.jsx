/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Order Panel Component
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { X, Package, Truck, CheckCircle, XCircle, Copy, ExternalLink } from 'lucide-react';
import { formatCurrency, formatDateTime, getStatusEmoji } from '../utils/helpers';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

function OrderPanel({ order, onClose, onUpdate }) {
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState(order.status);

  if (!order) return null;

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'gray' },
    { value: 'confirmed', label: 'Confirmed', color: 'blue' },
    { value: 'processing', label: 'Processing', color: 'blue' },
    { value: 'shipped', label: 'Shipped', color: 'blue' },
    { value: 'delivered', label: 'Delivered', color: 'green' },
    { value: 'cancelled', label: 'Cancelled', color: 'red' },
  ];

  async function handleStatusUpdate() {
    if (newStatus === order.status) return;

    try {
      setUpdating(true);
      await api.put(`/api/orders/${order.order_id}`, { status: newStatus });
      toast.success('Order status updated');
      onUpdate?.({ ...order, status: newStatus });
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  function copyOrderId() {
    navigator.clipboard.writeText(order.order_id);
    toast.success('Order ID copied');
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-kaapav-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-gold-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{order.order_id}</h3>
                <button onClick={copyOrderId} className="p-1 hover:bg-gray-100 rounded">
                  <Copy className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-kaapav-muted">{formatDateTime(order.created_at)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Status */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-kaapav-muted block mb-2">
                Order Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="input-field"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {getStatusEmoji(option.value)} {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-kaapav-muted block mb-2">
                Payment Status
              </label>
              <div className={`input-field ${
                order.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-gray-50'
              }`}>
                {order.payment_status === 'paid' ? '✅ Paid' : '⏳ Unpaid'}
              </div>
            </div>
            <button
              onClick={handleStatusUpdate}
              disabled={updating || newStatus === order.status}
              className="btn-gold mt-6 disabled:opacity-50"
            >
              {updating ? 'Updating...' : 'Update'}
            </button>
          </div>

          {/* Customer */}
          <div>
            <h4 className="font-medium mb-3">Customer Details</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p><strong>Name:</strong> {order.customer_name || 'N/A'}</p>
              <p><strong>Phone:</strong> {order.phone}</p>
              <p><strong>Address:</strong> {order.shipping_address || 'N/A'}</p>
              <p><strong>City:</strong> {order.shipping_city}, {order.shipping_pincode}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h4 className="font-medium mb-3">Order Items ({order.item_count})</h4>
            <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
              {items?.map((item, index) => (
                <div key={index} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-kaapav-muted">Qty: {item.quantity || 1}</p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.price * (item.quantity || 1))}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gold-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{order.shipping_cost === 0 ? 'FREE' : formatCurrency(order.shipping_cost)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gold-200">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>

          {/* Tracking */}
          {order.tracking_id && (
            <div>
              <h4 className="font-medium mb-3">Tracking</h4>
              <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{order.tracking_id}</p>
                  <p className="text-sm text-kaapav-muted">{order.courier || 'Shiprocket'}</p>
                </div>
                <a
                  href={order.tracking_url || `https://shiprocket.in/shipment-tracking?tracking_id=${order.tracking_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline-gold flex items-center gap-2"
                >
                  <Truck className="w-4 h-4" />
                  Track
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-kaapav-border flex justify-end gap-3">
          <button onClick={onClose} className="btn-outline-gold">
            Close
          </button>
          {order.payment_link && order.payment_status !== 'paid' && (
            <a
              href={order.payment_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold flex items-center gap-2"
            >
              Send Payment Link
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderPanel;
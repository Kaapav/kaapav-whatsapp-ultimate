/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Customer Info Sidebar
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, ShoppingBag, Tag, Edit2, Save } from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import toast from 'react-hot-toast';

function CustomerInfo({ phone, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  async function loadCustomerData() {
    try {
      setLoading(true);
      const response = await api.get(`/api/customers/${phone}`);
      setCustomer(response.data.customer || {});
      setOrders(response.data.orders || []);
      setFormData(response.data.customer || {});
    } catch (error) {
      console.error('Load customer error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      await api.put(`/api/customers/${phone}`, formData);
      setCustomer(formData);
      setEditing(false);
      toast.success('Customer updated');
    } catch (error) {
      toast.error('Failed to update customer');
    }
  }

  if (loading) {
    return (
      <div className="w-80 border-l border-kaapav-border bg-white p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-20 w-20 bg-gray-200 rounded-full mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-kaapav-border bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-kaapav-border flex items-center justify-between">
        <h3 className="font-semibold text-kaapav-text">Customer Info</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {editing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Profile */}
        <div className="text-center">
          <div className="w-20 h-20 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-gold-600 font-bold text-2xl">
              {(customer?.name || phone)?.[0]?.toUpperCase()}
            </span>
          </div>
          
          {editing ? (
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Customer name"
              className="input-field text-center"
            />
          ) : (
            <h4 className="font-semibold text-lg">{customer?.name || 'Unknown'}</h4>
          )}
          
          <p className="text-sm text-kaapav-muted">{phone}</p>
          
          {customer?.segment && (
            <span className="badge badge-gold mt-2">{customer.segment}</span>
          )}
        </div>

        {/* Contact Details */}
        <div className="space-y-3">
          <h5 className="font-medium text-sm text-kaapav-muted uppercase">Contact</h5>
          
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{phone}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-400" />
            {editing ? (
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email"
                className="input-field text-sm py-1"
              />
            ) : (
              <span className="text-sm">{customer?.email || 'Not provided'}</span>
            )}
          </div>
          
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
            {editing ? (
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                  className="input-field text-sm py-1"
                />
                <input
                  type="text"
                  value={formData.pincode || ''}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  placeholder="Pincode"
                  className="input-field text-sm py-1"
                />
              </div>
            ) : (
              <span className="text-sm">
                {customer?.city ? `${customer.city}, ${customer.pincode}` : 'Not provided'}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-kaapav-text">{customer?.order_count || 0}</p>
            <p className="text-xs text-kaapav-muted">Orders</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-kaapav-text">
              {formatCurrency(customer?.total_spent || 0)}
            </p>
            <p className="text-xs text-kaapav-muted">Total Spent</p>
          </div>
        </div>

        {/* Labels */}
        <div>
          <h5 className="font-medium text-sm text-kaapav-muted uppercase mb-2">Labels</h5>
          <div className="flex flex-wrap gap-2">
            {customer?.labels && JSON.parse(customer.labels).map((label, i) => (
              <span key={i} className="badge badge-gold">
                <Tag className="w-3 h-3 mr-1" />
                {label}
              </span>
            ))}
            <button className="badge badge-gray hover:bg-gray-200">+ Add</button>
          </div>
        </div>

        {/* Recent Orders */}
        <div>
          <h5 className="font-medium text-sm text-kaapav-muted uppercase mb-2">Recent Orders</h5>
          <div className="space-y-2">
            {orders.length === 0 ? (
              <p className="text-sm text-kaapav-muted">No orders yet</p>
            ) : (
              orders.slice(0, 5).map((order) => (
                <div 
                  key={order.order_id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">{order.order_id}</p>
                    <p className="text-xs text-kaapav-muted">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(order.total)}</p>
                    <span className={`badge ${
                      order.status === 'delivered' ? 'badge-green' :
                      order.status === 'cancelled' ? 'badge-red' : 'badge-gray'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <h5 className="font-medium text-sm text-kaapav-muted uppercase mb-2">Notes</h5>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add notes about this customer..."
            className="input-field text-sm h-24 resize-none"
            disabled={!editing}
          />
        </div>
      </div>
    </div>
  );
}

export default CustomerInfo;
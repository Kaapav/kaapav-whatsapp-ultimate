/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Orders Page
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, RefreshCw, 
  Package, Eye, MoreVertical, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getOrderStatusColor, getStatusEmoji } from '../utils/helpers';
import OrderPanel from '../components/OrderPanel';
import toast from 'react-hot-toast';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    payment_status: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  useEffect(() => {
    loadOrders();
  }, [filters, pagination.page]);

  async function loadOrders() {
    try {
      setLoading(true);
      const response = await api.get('/api/orders', {
        params: {
          ...filters,
          limit: pagination.limit,
          offset: (pagination.page - 1) * pagination.limit
        }
      });
      setOrders(response.data || []);
      // Note: Backend should return total count
    } catch (error) {
      console.error('Load orders error:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    setFilters({ ...filters, search: e.target.value });
    setPagination({ ...pagination, page: 1 });
  }

  function handleFilterChange(key, value) {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, page: 1 });
  }

  async function handleExport() {
    try {
      toast.loading('Preparing export...');
      const response = await api.get('/api/orders/export', {
        params: filters,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.dismiss();
      toast.success('Export downloaded');
    } catch (error) {
      toast.dismiss();
      toast.error('Export failed');
    }
  }

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const paymentOptions = [
    { value: '', label: 'All Payments' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'paid', label: 'Paid' },
    { value: 'refunded', label: 'Refunded' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-kaapav-text">Orders</h1>
          <p className="text-kaapav-muted">Manage and track customer orders</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadOrders}
            disabled={loading}
            className="btn-outline-gold flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={handleExport} className="btn-gold flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={handleSearch}
              placeholder="Search by Order ID, Phone, Name..."
              className="input-field pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="input-field w-40"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Payment Filter */}
          <select
            value={filters.payment_status}
            onChange={(e) => handleFilterChange('payment_status', e.target.value)}
            className="input-field w-40"
          >
            {paymentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-kaapav-border">
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Order ID</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Items</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Total</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Status</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Payment</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Date</th>
                <th className="text-center py-3 px-4 font-medium text-kaapav-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-kaapav-muted">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No orders found</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr 
                    key={order.order_id} 
                    className="border-b border-kaapav-border hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="py-3 px-4">
                      <span className="font-medium text-kaapav-text">{order.order_id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{order.customer_name || 'N/A'}</p>
                        <p className="text-sm text-kaapav-muted">{order.phone}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge badge-gray">{order.item_count} items</span>
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${getOrderStatusColor(order.status)}`}>
                        {getStatusEmoji(order.status)} {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${
                        order.payment_status === 'paid' ? 'badge-green' :
                        order.payment_status === 'refunded' ? 'badge-red' : 'badge-gray'
                      }`}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-kaapav-muted">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-kaapav-border">
          <p className="text-sm text-kaapav-muted">
            Showing {orders.length} orders
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
              disabled={pagination.page === 1}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 bg-gray-100 rounded-lg">
              Page {pagination.page}
            </span>
            <button
              onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
              disabled={orders.length < pagination.limit}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(updated) => {
            setOrders(orders.map(o => 
              o.order_id === updated.order_id ? updated : o
            ));
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}

export default Orders;
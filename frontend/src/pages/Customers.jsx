/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Customers Page
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Download, RefreshCw, Users, 
  MessageSquare, Tag, ChevronLeft, ChevronRight,
  Star, Phone, Mail
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, formatDate, formatPhone } from '../utils/helpers';
import toast from 'react-hot-toast';

function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    segment: '',
    label: ''
  });
  const [segments, setSegments] = useState([]);
  const [labels, setLabels] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    loadCustomers();
    loadFiltersData();
  }, [filters, pagination.page]);

  async function loadCustomers() {
    try {
      setLoading(true);
      const response = await api.get('/api/customers', {
        params: {
          ...filters,
          limit: pagination.limit,
          offset: (pagination.page - 1) * pagination.limit
        }
      });
      setCustomers(response.data || []);
    } catch (error) {
      console.error('Load customers error:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  async function loadFiltersData() {
    try {
      // Load segments
      const segmentsRes = await api.get('/api/customers/segments');
      setSegments(segmentsRes.data || []);

      // Load labels
      const labelsRes = await api.get('/api/customers/labels');
      setLabels(labelsRes.data || []);
    } catch (error) {
      console.error('Load filters error:', error);
    }
  }

  function handleSearch(e) {
    setFilters({ ...filters, search: e.target.value });
    setPagination({ ...pagination, page: 1 });
  }

  function handleStartChat(phone) {
    navigate(`/chats/${phone}`);
  }

  async function handleExport() {
    try {
      toast.loading('Preparing export...');
      const response = await api.get('/api/customers/export', {
        params: filters,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.csv`);
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

  const segmentColors = {
    vip: 'badge-gold',
    regular: 'badge-blue',
    new: 'badge-green',
    inactive: 'badge-gray',
    at_risk: 'badge-red'
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-kaapav-text">Customers</h1>
          <p className="text-kaapav-muted">Manage your customer relationships</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadCustomers}
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

      {/* Segment Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'All', value: '', count: customers.length, color: 'bg-gray-100' },
          { label: 'VIP', value: 'vip', icon: Star, color: 'bg-gold-100 text-gold-600' },
          { label: 'Regular', value: 'regular', color: 'bg-blue-100 text-blue-600' },
          { label: 'New', value: 'new', color: 'bg-green-100 text-green-600' },
          { label: 'Inactive', value: 'inactive', color: 'bg-gray-200 text-gray-600' },
        ].map((seg) => (
          <button
            key={seg.label}
            onClick={() => setFilters({ ...filters, segment: seg.value })}
            className={`p-4 rounded-lg border-2 transition-all ${
              filters.segment === seg.value 
                ? 'border-gold-400 bg-gold-50' 
                : 'border-transparent hover:border-gray-200'
            } ${seg.color}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{seg.label}</span>
              {seg.icon && <seg.icon className="w-4 h-4" />}
            </div>
            <p className="text-2xl font-bold mt-1">
              {segments.find(s => s.segment === seg.value)?.count || 0}
            </p>
          </button>
        ))}
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
              placeholder="Search by Phone, Name, Email..."
              className="input-field pl-10"
            />
          </div>

          {/* Label Filter */}
          <select
            value={filters.label}
            onChange={(e) => setFilters({ ...filters, label: e.target.value })}
            className="input-field w-48"
          >
            <option value="">All Labels</option>
            {labels.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-kaapav-border">
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Contact</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Segment</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Orders</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Total Spent</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Last Seen</th>
                <th className="text-left py-3 px-4 font-medium text-kaapav-muted">Labels</th>
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
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-kaapav-muted">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No customers found</p>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => {
                  const customerLabels = customer.labels ? JSON.parse(customer.labels) : [];
                  
                  return (
                    <tr 
                      key={customer.phone} 
                      className="border-b border-kaapav-border hover:bg-gray-50"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gold-100 rounded-full flex items-center justify-center">
                            <span className="text-gold-600 font-medium">
                              {(customer.name || customer.phone)?.[0]?.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{customer.name || 'Unknown'}</p>
                            <p className="text-sm text-kaapav-muted">{formatPhone(customer.phone)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <p className="text-sm flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {formatPhone(customer.phone)}
                          </p>
                          {customer.email && (
                            <p className="text-sm text-kaapav-muted flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {customer.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {customer.segment && (
                          <span className={`badge ${segmentColors[customer.segment] || 'badge-gray'}`}>
                            {customer.segment === 'vip' && <Star className="w-3 h-3 mr-1" />}
                            {customer.segment}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {customer.order_count || 0}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {formatCurrency(customer.total_spent || 0)}
                      </td>
                      <td className="py-3 px-4 text-kaapav-muted">
                        {formatDate(customer.last_seen)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {customerLabels.slice(0, 2).map((label, i) => (
                            <span key={i} className="badge badge-gray text-xs">
                              {label}
                            </span>
                          ))}
                          {customerLabels.length > 2 && (
                            <span className="badge badge-gray text-xs">
                              +{customerLabels.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleStartChat(customer.phone)}
                          className="p-2 hover:bg-gold-100 rounded-lg text-gold-600"
                          title="Start Chat"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-kaapav-border">
          <p className="text-sm text-kaapav-muted">
            Showing {customers.length} customers
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
              
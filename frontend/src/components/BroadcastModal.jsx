/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Broadcast Modal Component
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { X, Send, Users, Tag, Calendar, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

function BroadcastModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    message_type: 'text',
    target_type: 'all',
    target_labels: [],
    target_segment: '',
    scheduled_at: '',
  });
  const [loading, setLoading] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState(0);
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadLabels();
      estimateRecipients();
    }
  }, [isOpen, formData.target_type, formData.target_labels, formData.target_segment]);

  async function loadLabels() {
    try {
      const response = await api.get('/api/customers/labels');
      setLabels(response.data || []);
    } catch (error) {
      console.error('Load labels error:', error);
    }
  }

  async function estimateRecipients() {
    try {
      const response = await api.post('/api/broadcasts/estimate', {
        target_type: formData.target_type,
        target_labels: formData.target_labels,
        target_segment: formData.target_segment,
      });
      setEstimatedCount(response.data.estimated_count || 0);
    } catch (error) {
      setEstimatedCount(0);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.name || !formData.message) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/api/broadcasts', formData);
      toast.success('Broadcast created successfully');
      onSuccess?.(response.data);
      onClose();
    } catch (error) {
      toast.error('Failed to create broadcast');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-kaapav-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center">
              <Send className="w-5 h-5 text-gold-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Create Broadcast</h3>
              <p className="text-sm text-kaapav-muted">Send message to multiple customers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-kaapav-text mb-2">
              Campaign Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Flash Sale Announcement"
              className="input-field"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-kaapav-text mb-2">
              Message *
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Type your broadcast message here..."
              className="input-field h-32 resize-none"
              required
            />
            <p className="text-xs text-kaapav-muted mt-1">
              {formData.message.length} / 1024 characters
            </p>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium text-kaapav-text mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              Target Audience
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'all', label: 'All Customers' },
                { value: 'segment', label: 'By Segment' },
                { value: 'labels', label: 'By Labels' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, target_type: option.value })}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    formData.target_type === option.value
                      ? 'border-gold-400 bg-gold-50 text-gold-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Segment Selector */}
          {formData.target_type === 'segment' && (
            <div>
              <label className="block text-sm font-medium text-kaapav-text mb-2">
                Select Segment
              </label>
              <select
                value={formData.target_segment}
                onChange={(e) => setFormData({ ...formData, target_segment: e.target.value })}
                className="input-field"
              >
                <option value="">Select a segment</option>
                <option value="vip">VIP Customers</option>
                <option value="regular">Regular Customers</option>
                <option value="new">New Customers</option>
                <option value="inactive">Inactive Customers</option>
                <option value="at_risk">At Risk</option>
              </select>
            </div>
          )}

          {/* Labels Selector */}
          {formData.target_type === 'labels' && (
            <div>
              <label className="block text-sm font-medium text-kaapav-text mb-2">
                Select Labels
              </label>
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      const selected = formData.target_labels.includes(label)
                        ? formData.target_labels.filter(l => l !== label)
                        : [...formData.target_labels, label];
                      setFormData({ ...formData, target_labels: selected });
                    }}
                    className={`badge ${
                      formData.target_labels.includes(label)
                        ? 'badge-gold'
                        : 'badge-gray hover:bg-gray-200'
                    }`}
                  >
                    <Tag className="w-3 h-3 mr-1" />
                    {label}
                  </button>
                ))}
                {labels.length === 0 && (
                  <p className="text-sm text-kaapav-muted">No labels available</p>
                )}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-kaapav-text mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Schedule (Optional)
            </label>
            <input
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              className="input-field"
            />
            <p className="text-xs text-kaapav-muted mt-1">
              Leave empty to save as draft
            </p>
          </div>

          {/* Estimated Recipients */}
          <div className="bg-gold-50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gold-600" />
              <div>
                <p className="font-medium text-kaapav-text">Estimated Recipients</p>
                <p className="text-sm text-kaapav-muted">Based on selected criteria</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-gold-600">{estimatedCount}</p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 text-sm text-orange-600 bg-orange-50 p-4 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>
              Broadcast messages are sent to opted-in customers only. 
              Make sure your message complies with WhatsApp Business policies.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-kaapav-border flex justify-end gap-3">
          <button onClick={onClose} className="btn-outline-gold">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !formData.name || !formData.message}
            className="btn-gold flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Creating...' : formData.scheduled_at ? 'Schedule' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BroadcastModal;
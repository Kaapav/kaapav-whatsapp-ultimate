/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Quick Replies Component
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { Search, X, Plus, Star } from 'lucide-react';
import { api } from '../utils/api';

const DEFAULT_REPLIES = [
  { id: 1, keyword: 'greeting', response: 'Hello! Welcome to KAAPAV. How can I help you today? 💎' },
  { id: 2, keyword: 'price', response: 'Our prices range from ₹99 to ₹1999. Would you like to see our catalog?' },
  { id: 3, keyword: 'delivery', response: 'We deliver in 3-5 business days. Free shipping above ₹498! 🚚' },
  { id: 4, keyword: 'payment', response: 'We accept UPI, Cards & Net Banking. No COD available. 💳' },
  { id: 5, keyword: 'return', response: 'We offer 7-day easy returns. Product must be unused with original packaging. ↩️' },
  { id: 6, keyword: 'thanks', response: 'Thank you for choosing KAAPAV! Happy shopping! ✨💎' },
];

function QuickReplies({ onSelect, onClose }) {
  const [replies, setReplies] = useState(DEFAULT_REPLIES);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReplies();
  }, []);

  async function loadReplies() {
    try {
      setLoading(true);
      const response = await api.get('/api/quick-replies');
      if (response.data && response.data.length > 0) {
        setReplies(response.data);
      }
    } catch (error) {
      console.error('Load replies error:', error);
      // Keep default replies on error
    } finally {
      setLoading(false);
    }
  }

  const filteredReplies = replies.filter(reply =>
    reply.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reply.response.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="border-t border-kaapav-border bg-white p-4 max-h-64 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm text-kaapav-text">Quick Replies</h4>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search replies..."
          className="input-field pl-9 py-2 text-sm"
        />
      </div>

      {/* Replies Grid */}
      <div className="grid grid-cols-2 gap-2">
        {filteredReplies.map((reply) => (
          <button
            key={reply.id}
            onClick={() => onSelect(reply.response)}
            className="text-left p-3 bg-gray-50 hover:bg-gold-50 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gold-600 uppercase">
                {reply.keyword}
              </span>
              {reply.is_featured && (
                <Star className="w-3 h-3 text-gold-400 fill-gold-400" />
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 group-hover:text-kaapav-text">
              {reply.response}
            </p>
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filteredReplies.length === 0 && (
        <div className="text-center py-6 text-kaapav-muted">
          <p className="text-sm">No matching replies found</p>
        </div>
      )}

      {/* Add New Button */}
      <button className="w-full mt-3 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-gold-400 hover:text-gold-600 transition-colors flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" />
        Add Quick Reply
      </button>
    </div>
  );
}

export default QuickReplies;
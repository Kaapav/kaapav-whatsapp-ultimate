/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - useChats Hook
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export function useChats(initialFilters = {}) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [total, setTotal] = useState(0);

  // Load chats
  const loadChats = useCallback(async (newFilters = null) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        limit: 50,
        offset: 0,
        ...(newFilters || filters)
      };

      const response = await api.get('/api/chats', { params });
      
      setChats(response.data.chats || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      console.error('Load chats error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Refresh chats
  const refreshChats = useCallback(() => {
    return loadChats();
  }, [loadChats]);

  // Update filters and reload
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Update a single chat locally
  const updateChat = useCallback((phone, updates) => {
    setChats(prev => prev.map(chat => 
      chat.phone === phone ? { ...chat, ...updates } : chat
    ));
  }, []);

  // Add new chat or update existing
  const upsertChat = useCallback((chatData) => {
    setChats(prev => {
      const existingIndex = prev.findIndex(c => c.phone === chatData.phone);
      
      if (existingIndex >= 0) {
        // Update existing
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...chatData };
        // Re-sort by last_timestamp
        return updated.sort((a, b) => 
          new Date(b.last_timestamp) - new Date(a.last_timestamp)
        );
      } else {
        // Add new at top
        return [chatData, ...prev];
      }
    });
  }, []);

  // Mark chat as read
  const markAsRead = useCallback(async (phone) => {
    try {
      await api.put(`/api/chats/${phone}`, { unread_count: 0 });
      updateChat(phone, { unread_count: 0 });
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  }, [updateChat]);

  // Add label to chat
  const addLabel = useCallback(async (phone, label) => {
    try {
      const chat = chats.find(c => c.phone === phone);
      const currentLabels = chat?.labels ? JSON.parse(chat.labels) : [];
      
      if (!currentLabels.includes(label)) {
        const newLabels = [...currentLabels, label];
        await api.put(`/api/chats/${phone}`, { labels: newLabels });
        updateChat(phone, { labels: JSON.stringify(newLabels) });
      }
    } catch (err) {
      console.error('Add label error:', err);
    }
  }, [chats, updateChat]);

  // Remove label from chat
  const removeLabel = useCallback(async (phone, label) => {
    try {
      const chat = chats.find(c => c.phone === phone);
      const currentLabels = chat?.labels ? JSON.parse(chat.labels) : [];
      const newLabels = currentLabels.filter(l => l !== label);
      
      await api.put(`/api/chats/${phone}`, { labels: newLabels });
      updateChat(phone, { labels: JSON.stringify(newLabels) });
    } catch (err) {
      console.error('Remove label error:', err);
    }
  }, [chats, updateChat]);

  // Get unread count
  const unreadCount = chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);

  // Initial load
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Reload when filters change
  useEffect(() => {
    loadChats();
  }, [filters, loadChats]);

  return {
    chats,
    loading,
    error,
    total,
    unreadCount,
    filters,
    loadChats,
    refreshChats,
    updateFilters,
    updateChat,
    upsertChat,
    markAsRead,
    addLabel,
    removeLabel,
    setChats
  };
}

export default useChats;
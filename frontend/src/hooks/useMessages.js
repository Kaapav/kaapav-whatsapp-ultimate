/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - useMessages Hook
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export function useMessages(phone) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Load messages for a phone number
  const loadMessages = useCallback(async (beforeTimestamp = null) => {
    if (!phone) return;

    try {
      setLoading(true);
      setError(null);

      const params = { limit: 50 };
      if (beforeTimestamp) {
        params.before = beforeTimestamp;
      }

      const response = await api.get(`/api/messages/${phone}`, { params });
      const newMessages = response.data || [];

      if (beforeTimestamp) {
        // Loading older messages
        setMessages(prev => [...newMessages, ...prev]);
      } else {
        // Initial load
        setMessages(newMessages);
      }

      setHasMore(newMessages.length === 50);
    } catch (err) {
      console.error('Load messages error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  // Load more (older) messages
  const loadMore = useCallback(() => {
    if (messages.length > 0 && hasMore && !loading) {
      const oldestMessage = messages[0];
      loadMessages(oldestMessage.timestamp);
    }
  }, [messages, hasMore, loading, loadMessages]);

  // Send a message
  const sendMessage = useCallback(async (text, type = 'text') => {
    if (!phone || !text.trim()) return null;

    try {
      const response = await api.post('/api/messages/send', {
        to: phone,
        text: text.trim(),
        type
      });

      // Add to local messages immediately
      const newMessage = {
        id: Date.now(),
        phone,
        text: text.trim(),
        direction: 'outgoing',
        message_type: type,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      setMessages(prev => [...prev, newMessage]);

      return response.data;
    } catch (err) {
      console.error('Send message error:', err);
      throw err;
    }
  }, [phone]);

  // Send template message
  const sendTemplate = useCallback(async (templateName, language = 'en', components = []) => {
    if (!phone || !templateName) return null;

    try {
      const response = await api.post('/api/messages/template', {
        to: phone,
        template_name: templateName,
        language,
        components
      });

      // Add to local messages
      const newMessage = {
        id: Date.now(),
        phone,
        text: `[Template: ${templateName}]`,
        direction: 'outgoing',
        message_type: 'template',
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      setMessages(prev => [...prev, newMessage]);

      return response.data;
    } catch (err) {
      console.error('Send template error:', err);
      throw err;
    }
  }, [phone]);

  // Add incoming message (from WebSocket)
  const addIncomingMessage = useCallback((message) => {
    if (message.phone === phone) {
      setMessages(prev => {
        // Avoid duplicates
        const exists = prev.some(m => m.message_id === message.message_id);
        if (exists) return prev;
        return [...prev, message];
      });
    }
  }, [phone]);

  // Update message status
  const updateMessageStatus = useCallback((messageId, status) => {
    setMessages(prev => prev.map(m => 
      m.message_id === messageId ? { ...m, status } : m
    ));
  }, []);

  // Initial load when phone changes
  useEffect(() => {
    if (phone) {
      setMessages([]);
      setHasMore(true);
      loadMessages();
    }
  }, [phone, loadMessages]);

  return {
    messages,
    loading,
    error,
    hasMore,
    loadMessages,
    loadMore,
    sendMessage,
    sendTemplate,
    addIncomingMessage,
    updateMessageStatus,
    setMessages
  };
}

export default useMessages;
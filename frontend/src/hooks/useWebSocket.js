/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - useWebSocket Hook
 * ═══════════════════════════════════════════════════════════════
 * Real-time updates via polling (Cloudflare Workers don't support WebSocket)
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api';

export function useWebSocket(options = {}) {
  const {
    onNewMessage,
    onChatUpdate,
    onOrderUpdate,
    pollInterval = 5000 // 5 seconds
  } = options;

  const [connected, setConnected] = useState(false);
  const [lastPoll, setLastPoll] = useState(null);
  const lastMessageTimestamp = useRef(null);
  const lastChatTimestamp = useRef(null);
  const intervalRef = useRef(null);

  // Poll for new messages
  const pollUpdates = useCallback(async () => {
    try {
      // Get recent messages
      const messagesRes = await api.get('/api/messages/recent', {
        params: { since: lastMessageTimestamp.current }
      });

      const newMessages = messagesRes.data || [];
      
      if (newMessages.length > 0) {
        // Update timestamp
        lastMessageTimestamp.current = newMessages[newMessages.length - 1].timestamp;
        
        // Notify about new messages
        newMessages.forEach(msg => {
          if (msg.direction === 'incoming' && onNewMessage) {
            onNewMessage(msg);
          }
        });
      }

      // Get updated chats
      const chatsRes = await api.get('/api/chats', {
        params: { 
          limit: 20,
          updated_since: lastChatTimestamp.current 
        }
      });

      const updatedChats = chatsRes.data.chats || [];
      
      if (updatedChats.length > 0 && onChatUpdate) {
        updatedChats.forEach(chat => onChatUpdate(chat));
        lastChatTimestamp.current = new Date().toISOString();
      }

      setConnected(true);
      setLastPoll(new Date());

    } catch (error) {
      console.error('Poll error:', error);
      setConnected(false);
    }
  }, [onNewMessage, onChatUpdate]);

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    // Initial poll
    pollUpdates();

    // Set up interval
    intervalRef.current = setInterval(pollUpdates, pollInterval);
    console.log('[WebSocket] Polling started');
  }, [pollUpdates, pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[WebSocket] Polling stopped');
    }
  }, []);

  // Force refresh
  const refresh = useCallback(() => {
    pollUpdates();
  }, [pollUpdates]);

  // Start/stop on mount/unmount
  useEffect(() => {
    // Initialize timestamps
    lastMessageTimestamp.current = new Date().toISOString();
    lastChatTimestamp.current = new Date().toISOString();

    startPolling();

    return () => {
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  // Pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startPolling, stopPolling]);

  return {
    connected,
    lastPoll,
    refresh,
    startPolling,
    stopPolling
  };
}

export default useWebSocket;
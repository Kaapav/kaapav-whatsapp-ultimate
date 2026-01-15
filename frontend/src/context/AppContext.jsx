import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [stats, setStats] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [statsRes, chatsRes] = await Promise.all([
        api.get('/api/stats'),
        api.get('/api/chats?limit=50')
      ]);
      
      setStats(statsRes.data);
      setChats(chatsRes.data.chats || []);
      
      // Calculate unread
      const unread = (chatsRes.data.chats || [])
        .reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Load dashboard error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(phone) {
    try {
      const res = await api.get(`/api/messages/${phone}?limit=100`);
      setMessages(res.data || []);
    } catch (error) {
      console.error('Load messages error:', error);
      setMessages([]);
    }
  }

  async function sendMessage(phone, text, type = 'text') {
    try {
      const res = await api.post('/api/messages/send', { to: phone, text, type });
      
      // Add to local messages
      const newMessage = {
        id: Date.now(),
        phone,
        text,
        direction: 'outgoing',
        timestamp: new Date().toISOString(),
        message_type: type
      };
      setMessages(prev => [...prev, newMessage]);

      return res.data;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  async function refreshChats() {
    try {
      const res = await api.get('/api/chats?limit=50');
      setChats(res.data.chats || []);
    } catch (error) {
      console.error('Refresh chats error:', error);
    }
  }

  const value = {
    stats,
    chats,
    selectedChat,
    setSelectedChat,
    messages,
    loading,
    unreadCount,
    loadDashboardData,
    loadMessages,
    sendMessage,
    refreshChats,
    setChats,
    setMessages
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
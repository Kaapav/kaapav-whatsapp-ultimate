import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API helpers
export const apiHelpers = {
  // Stats
  getStats: (period = 'today') => api.get(`/api/stats?period=${period}`),
  
  // Chats
  getChats: (params) => api.get('/api/chats', { params }),
  getChat: (phone) => api.get(`/api/chats/${phone}`),
  updateChat: (phone, data) => api.put(`/api/chats/${phone}`, data),
  
  // Messages
  getMessages: (phone, params) => api.get(`/api/messages/${phone}`, { params }),
  sendMessage: (data) => api.post('/api/messages/send', data),
  sendTemplate: (data) => api.post('/api/messages/template', data),
  
  // Customers
  getCustomers: (params) => api.get('/api/customers', { params }),
  getCustomer: (phone) => api.get(`/api/customers/${phone}`),
  updateCustomer: (phone, data) => api.put(`/api/customers/${phone}`, data),
  
  // Orders
  getOrders: (params) => api.get('/api/orders', { params }),
  getOrder: (orderId) => api.get(`/api/orders/${orderId}`),
  createOrder: (data) => api.post('/api/orders', data),
  updateOrder: (orderId, data) => api.put(`/api/orders/${orderId}`, data),
  
  // Quick Replies
  getQuickReplies: () => api.get('/api/quick-replies'),
  saveQuickReply: (data) => api.post('/api/quick-replies', data),
  deleteQuickReply: (id) => api.delete(`/api/quick-replies/${id}`),
  
  // Broadcasts
  getBroadcasts: () => api.get('/api/broadcasts'),
  createBroadcast: (data) => api.post('/api/broadcasts', data),
  sendBroadcast: (id) => api.post(`/api/broadcasts/${id}/send`),
  
  // Analytics
  getAnalytics: (params) => api.get('/api/analytics', { params }),
  
  // Products
  getProducts: (params) => api.get('/api/products', { params })
};

export default api;
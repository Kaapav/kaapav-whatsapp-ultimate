import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Bell, MessageSquare, Palette, 
  Shield, Database, Zap, Save, RefreshCw 
} from 'lucide-react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [quickReplies, setQuickReplies] = useState([]);
  const [newReply, setNewReply] = useState({ keyword: '', response: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'quick-replies') {
      loadQuickReplies();
    }
  }, [activeTab]);

  async function loadQuickReplies() {
    try {
      const res = await api.get('/api/quick-replies');
      setQuickReplies(res.data || []);
    } catch (error) {
      console.error('Load quick replies error:', error);
    }
  }

  async function saveQuickReply() {
    if (!newReply.keyword || !newReply.response) {
      toast.error('Enter keyword and response');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/quick-replies', newReply);
      toast.success('Quick reply saved!');
      setNewReply({ keyword: '', response: '' });
      loadQuickReplies();
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function deleteQuickReply(id) {
    try {
      await api.delete(`/api/quick-replies/${id}`);
      toast.success('Deleted!');
      loadQuickReplies();
    } catch (error) {
      toast.error('Failed to delete');
    }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'quick-replies', label: 'Quick Replies', icon: Zap },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'integrations', label: 'Integrations', icon: Database },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-kaapav-text">Settings</h1>
        <p className="text-kaapav-muted">Manage your dashboard settings</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${
                activeTab === tab.id
                  ? 'bg-gold-50 text-gold-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 card">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h3 className="font-semibold">General Settings</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">Business Name</label>
                <input type="text" defaultValue="KAAPAV Fashion Jewellery" className="input-field" />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">WhatsApp Number</label>
                <input type="text" defaultValue="+91 91483 30016" className="input-field" disabled />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Default Language</label>
                <select className="input-field">
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="kn">Kannada</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Auto-Reply</label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-gold-500" />
                  <span className="text-sm">Enable automatic replies</span>
                </label>
              </div>
              
              <button className="btn-gold flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          )}

          {activeTab === 'quick-replies' && (
            <div className="space-y-6">
              <h3 className="font-semibold">Quick Replies</h3>
              
              {/* Add New */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <input
                  type="text"
                  value={newReply.keyword}
                  onChange={(e) => setNewReply({ ...newReply, keyword: e.target.value })}
                  placeholder="Trigger keyword (e.g., price, delivery)"
                  className="input-field"
                />
                <textarea
                  value={newReply.response}
                  onChange={(e) => setNewReply({ ...newReply, response: e.target.value })}
                  placeholder="Response message..."
                  className="input-field"
                  rows={3}
                />
                <button 
                  onClick={saveQuickReply}
                  disabled={loading}
                  className="btn-gold"
                >
                  Add Quick Reply
                </button>
              </div>
              
              {/* List */}
              <div className="space-y-3">
                {quickReplies.map((reply) => (
                  <div key={reply.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{reply.keyword}</p>
                      <p className="text-sm text-kaapav-muted">{reply.response.slice(0, 100)}...</p>
                      <p className="text-xs text-kaapav-muted mt-1">Used {reply.use_count} times</p>
                    </div>
                    <button 
                      onClick={() => deleteQuickReply(reply.id)}
                      className="text-red-500 hover:bg-red-50 px-2 py-1 rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="font-semibold">Notification Settings</h3>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">New Messages</p>
                    <p className="text-sm text-kaapav-muted">Get notified for new customer messages</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 text-gold-500" />
                </label>
                
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">New Orders</p>
                    <p className="text-sm text-kaapav-muted">Get notified for new orders</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 text-gold-500" />
                </label>
                
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Payment Received</p>
                    <p className="text-sm text-kaapav-muted">Get notified when payment is received</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 text-gold-500" />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h3 className="font-semibold">Appearance</h3>
              
              <div>
                <label className="block text-sm font-medium mb-2">Theme</label>
                <div className="flex gap-3">
                  <button className="px-4 py-2 border-2 border-gold-400 rounded-lg bg-white">
                    ☀️ Light
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg">
                    🌙 Dark
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Accent Color</label>
                <div className="flex gap-2">
                  <button className="w-8 h-8 rounded-full bg-gold-400 ring-2 ring-offset-2 ring-gold-400" />
                  <button className="w-8 h-8 rounded-full bg-blue-500" />
                  <button className="w-8 h-8 rounded-full bg-green-500" />
                  <button className="w-8 h-8 rounded-full bg-purple-500" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              <h3 className="font-semibold">Integrations</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-kaapav-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      💳
                    </div>
                    <div>
                      <p className="font-medium">Razorpay</p>
                      <p className="text-sm text-kaapav-muted">Payment processing</p>
                    </div>
                  </div>
                  <span className="badge badge-green">Connected</span>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-kaapav-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      🚚
                    </div>
                    <div>
                      <p className="font-medium">Shiprocket</p>
                      <p className="text-sm text-kaapav-muted">Shipping & tracking</p>
                    </div>
                  </div>
                  <span className="badge badge-green">Connected</span>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-kaapav-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      🤖
                    </div>
                    <div>
                      <p className="font-medium">OpenAI</p>
                      <p className="text-sm text-kaapav-muted">AI-powered replies</p>
                    </div>
                  </div>
                  <button className="btn-outline-gold text-sm py-1">Configure</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
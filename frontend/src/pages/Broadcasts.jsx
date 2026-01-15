import React, { useEffect, useState } from 'react';
import { Send, Plus, Clock, CheckCircle, XCircle, Users, Eye } from 'lucide-react';
import { api } from '../utils/api';
import { format } from 'date-fns';
import BroadcastModal from '../components/BroadcastModal';
import toast from 'react-hot-toast';

function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadBroadcasts();
  }, []);

  async function loadBroadcasts() {
    try {
      setLoading(true);
      const res = await api.get('/api/broadcasts');
      setBroadcasts(res.data || []);
    } catch (error) {
      console.error('Load broadcasts error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function sendBroadcast(broadcastId) {
    try {
      await api.post(`/api/broadcasts/${broadcastId}/send`);
      toast.success('Broadcast started!');
      loadBroadcasts();
    } catch (error) {
      toast.error('Failed to send broadcast');
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4 text-gray-400" />;
      case 'scheduled': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'sending': return <Send className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-kaapav-text">Broadcasts</h1>
          <p className="text-kaapav-muted">Send messages to multiple customers</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-gold flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Broadcast
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-kaapav-muted">Total Campaigns</p>
          <p className="text-2xl font-bold">{broadcasts.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-kaapav-muted">Messages Sent</p>
          <p className="text-2xl font-bold">
            {broadcasts.reduce((sum, b) => sum + (b.sent_count || 0), 0)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-kaapav-muted">Delivered</p>
          <p className="text-2xl font-bold text-green-500">
            {broadcasts.reduce((sum, b) => sum + (b.delivered_count || 0), 0)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-kaapav-muted">Scheduled</p>
          <p className="text-2xl font-bold text-blue-500">
            {broadcasts.filter(b => b.status === 'scheduled').length}
          </p>
        </div>
      </div>

      {/* Broadcasts List */}
      <div className="card">
        <h3 className="font-semibold mb-4">Campaigns</h3>
        
        {loading ? (
          <p className="text-center py-8 text-kaapav-muted">Loading...</p>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-8">
            <Send className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-kaapav-muted">No broadcasts yet</p>
            <button onClick={() => setShowModal(true)} className="btn-gold mt-4">
              Create First Broadcast
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((broadcast) => (
              <div 
                key={broadcast.broadcast_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(broadcast.status)}
                  <div>
                    <h4 className="font-medium">{broadcast.name}</h4>
                    <p className="text-sm text-kaapav-muted truncate max-w-md">
                      {broadcast.message?.slice(0, 50)}...
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="font-medium">{broadcast.target_count || 0}</p>
                    <p className="text-xs text-kaapav-muted">Target</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-green-500">{broadcast.sent_count || 0}</p>
                    <p className="text-xs text-kaapav-muted">Sent</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-blue-500">{broadcast.delivered_count || 0}</p>
                    <p className="text-xs text-kaapav-muted">Delivered</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {broadcast.status === 'draft' && (
                      <button 
                        onClick={() => sendBroadcast(broadcast.broadcast_id)}
                        className="btn-gold text-sm py-1"
                      >
                        Send
                      </button>
                    )}
                    <span className={`badge ${
                      broadcast.status === 'completed' ? 'badge-green' :
                      broadcast.status === 'sending' ? 'badge-gold' :
                      broadcast.status === 'scheduled' ? 'badge-blue' :
                      'badge-gray'
                    }`}>
                      {broadcast.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <BroadcastModal 
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            loadBroadcasts();
          }}
        />
      )}
    </div>
  );
}

export default Broadcasts;
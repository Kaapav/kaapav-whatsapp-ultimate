/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Chat Window Component
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, MoreVertical, Phone, User } from 'lucide-react';
import MessageBubble from './MessageBubble';
import QuickReplies from './QuickReplies';
import CustomerInfo from './CustomerInfo';
import { formatTime } from '../utils/helpers';

function ChatWindow({ 
  chat, 
  messages, 
  onSendMessage, 
  onLoadMore, 
  loading,
  hasMore 
}) {
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle scroll for loading more
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop } = messagesContainerRef.current;
      if (scrollTop === 0 && hasMore && !loading) {
        onLoadMore?.();
      }
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || sending) return;

    try {
      setSending(true);
      await onSendMessage(messageText.trim());
      setMessageText('');
    } catch (error) {
      console.error('Send failed:', error);
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (text) => {
    setMessageText(text);
    setShowQuickReplies(false);
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gold-500" />
          </div>
          <p className="text-kaapav-muted">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 px-6 border-b border-kaapav-border flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gold-100 rounded-full flex items-center justify-center">
              <span className="text-gold-600 font-medium">
                {(chat.customer_name || chat.phone)?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-kaapav-text">
                {chat.customer_name || 'Unknown'}
              </p>
              <p className="text-sm text-kaapav-muted">{chat.phone}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowCustomerInfo(!showCustomerInfo)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Customer Info"
            >
              <User className="w-5 h-5 text-gray-600" />
            </button>
            <a 
              href={`tel:${chat.phone}`}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Call"
            >
              <Phone className="w-5 h-5 text-gray-600" />
            </a>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50"
        >
          {loading && (
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <MessageBubble 
              key={msg.id || msg.message_id || index} 
              message={msg} 
            />
          ))}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies Panel */}
        {showQuickReplies && (
          <QuickReplies 
            onSelect={handleQuickReply}
            onClose={() => setShowQuickReplies(false)}
          />
        )}

        {/* Message Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-kaapav-border bg-white">
          <div className="flex items-center gap-3">
            <button 
              type="button" 
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Attach file"
            >
              <Paperclip className="w-5 h-5 text-gray-600" />
            </button>
            
            <button 
              type="button"
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              className={`p-2 rounded-lg ${showQuickReplies ? 'bg-gold-100' : 'hover:bg-gray-100'}`}
              title="Quick replies"
            >
              <Smile className="w-5 h-5 text-gray-600" />
            </button>
            
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 input-field"
              disabled={sending}
            />
            
            <button
              type="submit"
              disabled={!messageText.trim() || sending}
              className="btn-gold flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>

      {/* Customer Info Sidebar */}
      {showCustomerInfo && (
        <CustomerInfo 
          phone={chat.phone} 
          onClose={() => setShowCustomerInfo(false)}
        />
      )}
    </div>
  );
}

export default ChatWindow;
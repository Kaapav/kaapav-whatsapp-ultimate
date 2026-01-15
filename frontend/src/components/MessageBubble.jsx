/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Message Bubble Component
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle, Image, FileText, Mic } from 'lucide-react';
import { formatTime } from '../utils/helpers';

function MessageBubble({ message }) {
  const isOutgoing = message.direction === 'outgoing';
  const isIncoming = message.direction === 'incoming';

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent':
        return <Check className="w-3 h-3" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-400" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getMessageTypeIcon = () => {
    switch (message.message_type) {
      case 'image':
        return <Image className="w-4 h-4 mr-1" />;
      case 'document':
        return <FileText className="w-4 h-4 mr-1" />;
      case 'audio':
        return <Mic className="w-4 h-4 mr-1" />;
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (message.message_type) {
      case 'image':
        return (
          <div>
            {message.media_url && (
              <img 
                src={message.media_url} 
                alt="Shared image" 
                className="max-w-xs rounded-lg mb-2"
              />
            )}
            <p className="whitespace-pre-wrap">{message.text || '[Image]'}</p>
          </div>
        );
      
      case 'audio':
        return (
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            <span>Voice message</span>
          </div>
        );
      
      case 'document':
        return (
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <span>{message.text || 'Document'}</span>
          </div>
        );
      
      case 'location':
        return (
          <div>
            <span>📍 {message.text || 'Location shared'}</span>
          </div>
        );
      
      case 'interactive':
        return (
          <div>
            <p className="whitespace-pre-wrap">{message.text}</p>
            {message.button_title && (
              <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-sm">
                → {message.button_title}
              </span>
            )}
          </div>
        );
      
      default:
        return <p className="whitespace-pre-wrap">{message.text}</p>;
    }
  };

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div 
        className={`max-w-[75%] ${
          isOutgoing 
            ? 'bg-gold-400 text-white rounded-2xl rounded-tr-md' 
            : 'bg-white text-gray-800 rounded-2xl rounded-tl-md shadow-sm border border-gray-100'
        } px-4 py-2`}
      >
        {/* Message Type Indicator */}
        {message.message_type !== 'text' && (
          <div className={`flex items-center text-xs mb-1 ${isOutgoing ? 'text-gold-100' : 'text-gray-400'}`}>
            {getMessageTypeIcon()}
            <span className="capitalize">{message.message_type}</span>
          </div>
        )}

        {/* Content */}
        {renderContent()}

        {/* Footer: Time & Status */}
        <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
          isOutgoing ? 'text-gold-100' : 'text-gray-400'
        }`}>
          <span>{formatTime(message.timestamp)}</span>
          {isOutgoing && getStatusIcon()}
        </div>

        {/* Auto-reply indicator */}
        {message.is_auto_reply && (
          <div className={`text-xs mt-1 ${isOutgoing ? 'text-gold-100' : 'text-gray-400'}`}>
            🤖 Auto-reply
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
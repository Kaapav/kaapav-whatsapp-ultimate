import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  ShoppingBag, 
  Users, 
  Send, 
  BarChart3, 
  Settings,
  Sparkles
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/chats', icon: MessageSquare, label: 'Chats', badge: true },
  { path: '/orders', icon: ShoppingBag, label: 'Orders' },
  { path: '/customers', icon: Users, label: 'Customers' },
  { path: '/broadcasts', icon: Send, label: 'Broadcasts' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

function Sidebar() {
  const location = useLocation();
  const { unreadCount } = useApp();

  return (
    <aside className="w-64 bg-white border-r border-kaapav-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-kaapav-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-gold-400 to-gold-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-kaapav-text">KAAPAV</h1>
            <p className="text-xs text-kaapav-muted">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ path, icon: Icon, label, badge }) => {
          const isActive = location.pathname.startsWith(path);
          
          return (
            <NavLink
              key={path}
              to={path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5" />
              <span className="flex-1">{label}</span>
              {badge && unreadCount > 0 && (
                <span className="bg-gold-400 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-kaapav-border">
        <div className="bg-gold-50 rounded-lg p-4">
          <p className="text-sm font-medium text-gold-700">💎 KAAPAV Pro</p>
          <p className="text-xs text-gold-600 mt-1">WhatsApp Business API</p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
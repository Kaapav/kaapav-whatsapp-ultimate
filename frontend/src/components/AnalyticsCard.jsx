/**
 * ═══════════════════════════════════════════════════════════════
 * KAAPAV DASHBOARD - Analytics Card Component
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatNumber, formatCurrency } from '../utils/helpers';

function AnalyticsCard({ 
  title, 
  value, 
  change, 
  changeType = 'percent', // 'percent' | 'absolute'
  icon: Icon,
  color = 'gold',
  format = 'number', // 'number' | 'currency' | 'none'
  subtitle
}) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  const colorClasses = {
    gold: 'bg-gold-100 text-gold-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  const formatValue = (val) => {
    switch (format) {
      case 'currency':
        return formatCurrency(val);
      case 'number':
        return formatNumber(val);
      default:
        return val;
    }
  };

  const formatChange = () => {
    if (isNeutral) return '0%';
    const prefix = isPositive ? '+' : '';
    if (changeType === 'percent') {
      return `${prefix}${change}%`;
    }
    return `${prefix}${formatNumber(change)}`;
  };

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-kaapav-muted font-medium">{title}</p>
          <p className="text-3xl font-bold text-kaapav-text mt-2">
            {formatValue(value)}
          </p>
          {subtitle && (
            <p className="text-sm text-kaapav-muted mt-1">{subtitle}</p>
          )}
        </div>
        
        {Icon && (
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-2 mt-4">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
            isPositive ? 'bg-green-100 text-green-700' :
            isNegative ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            {isNeutral && <Minus className="w-3 h-3" />}
            {formatChange()}
          </div>
          <span className="text-sm text-kaapav-muted">vs last period</span>
        </div>
      )}
    </div>
  );
}

export default AnalyticsCard;
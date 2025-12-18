import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Standardized stats/metrics card component
 * 
 * @param {ReactNode} icon - Icon component
 * @param {string} iconColor - Icon background color class (e.g., 'blue', 'green', 'purple')
 * @param {string} title - Card title/label
 * @param {string|number} value - Main value to display
 * @param {string} subtitle - Secondary text below value
 * @param {Object} trend - Trend indicator {value, direction: 'up'|'down'|'neutral', label}
 * @param {Function} onClick - Click handler (makes card clickable)
 * @param {Array} actions - Array of action buttons {label, onClick}
 * @param {string} variant - 'default' | 'gradient' | 'bordered'
 */
export default function StatsCard({
  icon,
  iconColor = 'blue',
  title,
  value,
  subtitle,
  trend,
  onClick,
  actions = [],
  variant = 'default'
}) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
  };

  const gradientClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    indigo: 'from-indigo-500 to-indigo-600',
    pink: 'from-pink-500 to-pink-600',
    yellow: 'from-yellow-500 to-yellow-600'
  };

  const variantClasses = {
    default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
    gradient: `bg-gradient-to-br ${gradientClasses[iconColor]} text-white`,
    bordered: 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'
  };

  const CardWrapper = onClick ? 'button' : 'div';

  return (
    <CardWrapper
      onClick={onClick}
      className={`
        rounded-xl p-6 transition-all
        ${variantClasses[variant]}
        ${onClick ? 'cursor-pointer hover:shadow-lg transform hover:-translate-y-1' : ''}
        ${onClick ? 'text-left w-full' : ''}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Icon */}
          {icon && (
            <div className={`inline-flex p-3 rounded-lg mb-4 ${variant === 'gradient' ? 'bg-white/20' : colorClasses[iconColor]}`}>
              {React.cloneElement(icon, { className: `h-6 w-6 ${variant === 'gradient' ? 'text-white' : ''}` })}
            </div>
          )}

          {/* Title */}
          <h3 className={`text-sm font-medium mb-2 ${variant === 'gradient' ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'}`}>
            {title}
          </h3>

          {/* Value */}
          <div className={`text-3xl font-bold mb-1 ${variant === 'gradient' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            {value}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p className={`text-sm ${variant === 'gradient' ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
              {subtitle}
            </p>
          )}

          {/* Trend indicator */}
          {trend && (
            <div className="flex items-center mt-3 space-x-1">
              {trend.direction === 'up' && <TrendingUp className={`h-4 w-4 ${variant === 'gradient' ? 'text-white' : 'text-green-600'}`} />}
              {trend.direction === 'down' && <TrendingDown className={`h-4 w-4 ${variant === 'gradient' ? 'text-white' : 'text-red-600'}`} />}
              {trend.direction === 'neutral' && <Minus className={`h-4 w-4 ${variant === 'gradient' ? 'text-white' : 'text-gray-600'}`} />}
              <span className={`text-sm font-medium ${
                variant === 'gradient' ? 'text-white' : 
                trend.direction === 'up' ? 'text-green-600 dark:text-green-400' : 
                trend.direction === 'down' ? 'text-red-600 dark:text-red-400' : 
                'text-gray-600 dark:text-gray-400'
              }`}>
                {trend.value}
              </span>
              {trend.label && (
                <span className={`text-sm ${variant === 'gradient' ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                  {trend.label}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick && action.onClick();
              }}
              className={`text-sm font-medium transition-colors ${
                variant === 'gradient' 
                  ? 'text-white hover:text-white/80' 
                  : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </CardWrapper>
  );
}

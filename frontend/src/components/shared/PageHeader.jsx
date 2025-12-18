import React from 'react';
import { ChevronRight, HelpCircle } from 'lucide-react';

/**
 * Unified page header component with breadcrumbs, actions, and optional tabs
 * 
 * @param {string} title - Main page title
 * @param {string} subtitle - Optional subtitle/description
 * @param {ReactNode} icon - Optional icon component
 * @param {Array} breadcrumbs - Array of {label, to?, current?} objects
 * @param {Array} actions - Array of {label, icon?, onClick, variant?, loading?} objects
 * @param {ReactNode} filters - Optional filter panel component
 * @param {Array} tabs - Optional array of tab labels
 * @param {string} activeTab - Currently active tab
 * @param {Function} onTabChange - Tab change handler
 */
export default function PageHeader({
  title,
  subtitle,
  icon,
  breadcrumbs = [],
  actions = [],
  filters,
  tabs = [],
  activeTab,
  onTabChange
}) {
  return (
    <div className="mb-6">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="h-4 w-4" />}
              {crumb.current ? (
                <span className="font-medium text-gray-900 dark:text-white">
                  {crumb.label}
                </span>
              ) : (
                <button
                  onClick={() => crumb.to && (window.location.hash = crumb.to)}
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {crumb.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Header with title and actions */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          {icon && (
            <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              {React.cloneElement(icon, { className: 'h-6 w-6 text-blue-600 dark:text-blue-400' })}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {actions.length > 0 && (
          <div className="flex items-center space-x-2">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                disabled={action.loading}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all
                  ${action.variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  ${action.variant === 'secondary' ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white' : ''}
                  ${action.variant === 'outline' ? 'border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 text-gray-700 dark:text-gray-300' : ''}
                  ${action.variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                  ${!action.variant ? 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300' : ''}
                  ${action.loading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {action.loading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => onTabChange && onTabChange(tab)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Filter panel slot */}
      {filters && (
        <div className="mt-4">
          {filters}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X, Filter } from 'lucide-react';

/**
 * Reusable filter panel with collapsible design
 * 
 * @param {Array} filters - Array of filter configs
 * @param {Function} onReset - Reset handler
 * @param {number} appliedCount - Number of applied filters
 * @param {string} position - 'inline' | 'sticky' | 'sidebar'
 * @param {boolean} defaultOpen - Default collapsed state
 */
export default function FilterPanel({
  filters = [],
  onReset,
  appliedCount = 0,
  position = 'inline',
  defaultOpen = false
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const positionClasses = {
    inline: '',
    sticky: 'sticky top-4 z-10',
    sidebar: 'fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-lg'
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${positionClasses[position]}`}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">
            Filters
          </span>
          {appliedCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
              {appliedCount} active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {appliedCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReset && onReset();
              }}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Reset
            </button>
          )}
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          )}
        </div>
      </button>

      {/* Filter content */}
      {isOpen && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          {filters.map((filter, index) => (
            <div key={index}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {filter.label}
              </label>
              
              {/* Text/Search input */}
              {filter.type === 'text' && (
                <input
                  type="text"
                  value={filter.value || ''}
                  onChange={(e) => filter.onChange && filter.onChange(e.target.value)}
                  placeholder={filter.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              )}

              {/* Select dropdown */}
              {filter.type === 'select' && (
                <select
                  value={filter.value || ''}
                  onChange={(e) => filter.onChange && filter.onChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="">All {filter.label}</option>
                  {filter.options && filter.options.map((option, optIndex) => (
                    <option key={optIndex} value={option.value || option}>
                      {option.label || option}
                    </option>
                  ))}
                </select>
              )}

              {/* Multi-select */}
              {filter.type === 'multi-select' && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filter.options && filter.options.map((option, optIndex) => (
                    <label key={optIndex} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(filter.value || []).includes(option.value || option)}
                        onChange={(e) => {
                          const currentValues = filter.value || [];
                          const newValues = e.target.checked
                            ? [...currentValues, option.value || option]
                            : currentValues.filter(v => v !== (option.value || option));
                          filter.onChange && filter.onChange(newValues);
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {option.label || option}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Date input */}
              {filter.type === 'date' && (
                <input
                  type="date"
                  value={filter.value || ''}
                  onChange={(e) => filter.onChange && filter.onChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              )}

              {/* Date range */}
              {filter.type === 'date-range' && (
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filter.value?.from || ''}
                    onChange={(e) => filter.onChange && filter.onChange({ ...filter.value, from: e.target.value })}
                    placeholder="From"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                  <input
                    type="date"
                    value={filter.value?.to || ''}
                    onChange={(e) => filter.onChange && filter.onChange({ ...filter.value, to: e.target.value })}
                    placeholder="To"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

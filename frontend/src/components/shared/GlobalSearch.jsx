import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, Clock, TrendingUp } from 'lucide-react';

/**
 * Global search and command palette (Cmd+K / Ctrl+K)
 * 
 * @param {Array} shortcuts - Quick navigation items {label, path, icon?, keywords?}
 * @param {Array} quickActions - Quick action items {label, icon?, action, keywords?}
 * @param {Array} recentItems - Recently accessed items {label, path, timestamp}
 * @param {Function} onNavigate - Navigation handler
 */
export default function GlobalSearch({
  shortcuts = [],
  quickActions = [],
  recentItems = [],
  onNavigate
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter results based on query
  const filterResults = (items, query) => {
    if (!query) return items;
    
    const lowerQuery = query.toLowerCase();
    return items.filter(item => {
      const matchLabel = item.label.toLowerCase().includes(lowerQuery);
      const matchKeywords = item.keywords?.some(k => k.toLowerCase().includes(lowerQuery));
      return matchLabel || matchKeywords;
    });
  };

  const filteredShortcuts = filterResults(shortcuts, query);
  const filteredActions = filterResults(quickActions, query);
  const filteredRecent = query ? [] : recentItems.slice(0, 5);

  const allResults = [
    ...filteredRecent.map(item => ({ ...item, type: 'recent' })),
    ...filteredShortcuts.map(item => ({ ...item, type: 'shortcut' })),
    ...filteredActions.map(item => ({ ...item, type: 'action' }))
  ];

  // Handle result selection
  const handleSelect = (result) => {
    if (result.type === 'action') {
      result.action();
    } else if (result.path) {
      onNavigate && onNavigate(result.path);
    }
    
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(allResults[selectedIndex]);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Search</span>
        <div className="hidden sm:flex items-center space-x-1 ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
          <Command className="h-3 w-3" />
          <span>K</span>
        </div>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={() => {
          setIsOpen(false);
          setQuery('');
          setSelectedIndex(0);
        }}
      />

      {/* Command palette */}
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <Search className="h-5 w-5 text-gray-400 mr-3" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search or jump to..."
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
            />
            <div className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
              <span>ESC</span>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {allResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No results found
              </div>
            ) : (
              <div className="py-2">
                {/* Recent items */}
                {filteredRecent.length > 0 && (
                  <div className="px-2 mb-2">
                    <div className="flex items-center space-x-2 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      <Clock className="h-3 w-3" />
                      <span>Recent</span>
                    </div>
                    {filteredRecent.map((item, index) => {
                      const globalIndex = allResults.findIndex(r => r === item);
                      return (
                        <button
                          key={`recent-${index}`}
                          onClick={() => handleSelect({ ...item, type: 'recent' })}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                          <span className="flex-1">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Navigation shortcuts */}
                {filteredShortcuts.length > 0 && (
                  <div className="px-2 mb-2">
                    <div className="flex items-center space-x-2 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      <TrendingUp className="h-3 w-3" />
                      <span>Navigate to</span>
                    </div>
                    {filteredShortcuts.map((item, index) => {
                      const globalIndex = allResults.findIndex(r => r === item);
                      return (
                        <button
                          key={`shortcut-${index}`}
                          onClick={() => handleSelect({ ...item, type: 'shortcut' })}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                          <span className="flex-1">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Quick actions */}
                {filteredActions.length > 0 && (
                  <div className="px-2">
                    <div className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </div>
                    {filteredActions.map((item, index) => {
                      const globalIndex = allResults.findIndex(r => r === item);
                      return (
                        <button
                          key={`action-${index}`}
                          onClick={() => handleSelect({ ...item, type: 'action' })}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                            selectedIndex === globalIndex
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                          <span className="flex-1">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with hints */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">↑↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">↵</kbd>
                <span>Select</span>
              </div>
              <div className="flex items-center space-x-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">ESC</kbd>
                <span>Close</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

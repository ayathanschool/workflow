import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, Clock, XCircle } from 'lucide-react';
import { cacheManager } from '../utils/cacheManager';
import * as api from '../api';

/**
 * CacheDebugPanel - Developer tool to monitor and manage cache
 * Shows cache statistics and provides manual cache clearing
 */
const CacheDebugPanel = ({ show = false }) => {
  const [stats, setStats] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refreshStats = () => {
    const cacheStats = cacheManager.getStats();
    setStats(cacheStats);
  };

  useEffect(() => {
    if (show) {
      refreshStats();
      
      // Auto-refresh stats every 2 seconds
      if (autoRefresh) {
        const interval = setInterval(refreshStats, 2000);
        return () => clearInterval(interval);
      }
    }
  }, [show, autoRefresh]);

  // Listen for cache refresh events
  useEffect(() => {
    const handler = () => refreshStats();
    window.addEventListener('cache-refreshed', handler);
    return () => window.removeEventListener('cache-refreshed', handler);
  }, []);

  if (!show || !stats) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg shadow-xl p-4 z-50 max-w-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Cache Statistics</h3>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`p-1 rounded ${autoRefresh ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}
          title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
        >
          <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Memory Cache:</span>
          <span className="font-medium text-gray-900 dark:text-white">{stats.memorySize} items</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">LocalStorage:</span>
          <span className="font-medium text-gray-900 dark:text-white">{stats.localStorageSize} items</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Total Cached:</span>
          <span className="font-medium text-gray-900 dark:text-white">{stats.totalSize} items</span>
        </div>
      </div>

      {stats.keys.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cached Keys:</div>
          <div className="max-h-32 overflow-y-auto text-xs space-y-1">
            {stats.keys.slice(0, 10).map((key, idx) => (
              <div key={idx} className="text-gray-700 dark:text-gray-300 truncate" title={key}>
                {key}
              </div>
            ))}
            {stats.keys.length > 10 && (
              <div className="text-gray-500 italic">...and {stats.keys.length - 10} more</div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-2">
        <button
          onClick={() => {
            cacheManager.clearOldCache();
            refreshStats();
          }}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
        >
          <Clock className="w-3 h-3" />
          Clear Old
        </button>
        <button
          onClick={() => {
            api.clearCache();
            refreshStats();
          }}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          <XCircle className="w-3 h-3" />
          Clear All
        </button>
      </div>
    </div>
  );
};

export default CacheDebugPanel;

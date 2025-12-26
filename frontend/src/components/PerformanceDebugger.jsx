import React, { useState, useEffect } from 'react';
import { BarChart2, X } from 'lucide-react';
import { enhancedCache } from '../utils/apiCache';

export default function PerformanceDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setStats(enhancedCache.getStats());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="Show Performance Stats"
      >
        <BarChart2 className="w-5 h-5" />
      </button>
    );
  }

  const totalRequests = stats ? (stats.hits + stats.misses) : 0;
  const hitRate = totalRequests > 0 
    ? Math.round((stats.hits / totalRequests) * 100) 
    : 0;

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 w-96 max-h-[600px] overflow-auto z-50 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
          <BarChart2 className="w-5 h-5" />
          Performance Stats
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {stats && (
        <div className="space-y-4">
          {/* Cache Overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Hit Rate</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{hitRate}%</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
              <div className="text-xs text-green-600 dark:text-green-400 font-medium">Cache Size</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.size}</div>
            </div>
          </div>

          {/* Request Stats */}
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-xs">Hits</div>
              <div className="font-bold text-green-600 dark:text-green-400">{stats.hits}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-xs">Misses</div>
              <div className="font-bold text-red-600 dark:text-red-400">{stats.misses}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-xs">Deduped</div>
              <div className="font-bold text-yellow-600 dark:text-yellow-400">{stats.deduped}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-xs">Pending</div>
              <div className="font-bold text-blue-600 dark:text-blue-400">{stats.pending}</div>
            </div>
          </div>

          {/* Cache Summary */}
          <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded">
            <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Cache Performance</h4>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Total Requests:</span>
                <span className="font-mono font-semibold">{totalRequests}</span>
              </div>
              <div className="flex justify-between">
                <span>Cache Efficiency:</span>
                <span className={`font-mono font-semibold ${
                  hitRate >= 80 ? 'text-green-600 dark:text-green-400' : 
                  hitRate >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 
                  'text-red-600 dark:text-red-400'
                }`}>
                  {hitRate}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Requests Deduped:</span>
                <span className="font-mono font-semibold text-yellow-600 dark:text-yellow-400">{stats.deduped}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                enhancedCache.clear();
                setStats(enhancedCache.getStats());
              }}
              className="flex-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
            >
              Clear Cache
            </button>
            <button
              onClick={() => {
                enhancedCache.resetStats();
                setStats(enhancedCache.getStats());
              }}
              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Reset Stats
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

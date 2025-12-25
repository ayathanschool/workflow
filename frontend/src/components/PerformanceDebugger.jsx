import React, { useState, useEffect } from 'react';
import { BarChart2, RefreshCw, X } from 'lucide-react';
import { enhancedCache } from '../utils/apiCache';
import { perfMonitor } from '../utils/performanceMonitor';

const PerformanceDebugger = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const refreshStats = () => {
    const report = perfMonitor.getReport();
    setStats(report);
  };

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshStats, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    if (isOpen) {
      refreshStats();
    }
  }, [isOpen]);

  // Only show in development
  if (!import.meta.env.DEV) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all"
        title="Performance Stats"
      >
        <BarChart2 className="w-5 h-5" />
      </button>

      {/* Stats Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 bg-white rounded-lg shadow-2xl w-96 max-h-[600px] overflow-hidden border border-gray-200">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5" />
              <h3 className="font-semibold">Performance Monitor</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAutoRefresh(!autoRefresh);
                  if (!autoRefresh) refreshStats();
                }}
                className={`p-1 rounded hover:bg-blue-700 ${autoRefresh ? 'bg-blue-700' : ''}`}
                title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-blue-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[500px] text-sm">
            {stats && (
              <>
                {/* Cache Stats */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">📦 Cache Performance</h4>
                  <div className="space-y-1 text-gray-700">
                    <div className="flex justify-between">
                      <span>Hit Rate:</span>
                      <span className="font-mono font-semibold">{stats.cache.hitRate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cache Size:</span>
                      <span className="font-mono">{stats.cache.size} entries</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hits:</span>
                      <span className="font-mono text-green-600">{stats.cache.hits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Misses:</span>
                      <span className="font-mono text-orange-600">{stats.cache.misses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Deduped:</span>
                      <span className="font-mono text-blue-600">{stats.cache.deduped}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pending:</span>
                      <span className="font-mono">{stats.cache.pending}</span>
                    </div>
                  </div>
                </div>

                {/* Average Durations */}
                {Object.keys(stats.averageDurations).length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">⏱️ Average Response Times</h4>
                    <div className="space-y-1 text-xs">
                      {Object.entries(stats.averageDurations).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-gray-700">
                          <span className="truncate mr-2">{key}</span>
                          <span className="font-mono whitespace-nowrap">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Operations */}
                {stats.recentMeasures.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">🔄 Recent Operations</h4>
                    <div className="space-y-1 text-xs">
                      {stats.recentMeasures.map((measure, idx) => (
                        <div key={idx} className="flex justify-between text-gray-700">
                          <span className="truncate mr-2">{measure.name}</span>
                          <span className={`font-mono whitespace-nowrap ${
                            measure.duration > 1000 ? 'text-red-600 font-bold' :
                            measure.duration > 500 ? 'text-orange-600' :
                            'text-green-600'
                          }`}>
                            {measure.duration.toFixed(0)}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => {
                      enhancedCache.clear();
                      refreshStats();
                    }}
                    className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-medium"
                  >
                    Clear Cache
                  </button>
                  <button
                    onClick={() => {
                      enhancedCache.resetStats();
                      refreshStats();
                    }}
                    className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium"
                  >
                    Reset Stats
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PerformanceDebugger;

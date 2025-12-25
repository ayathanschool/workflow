// Performance monitoring utility
import { enhancedCache } from './apiCache.js';

class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = [];
    this.enabled = import.meta.env.DEV;
  }

  // Mark the start of an operation
  mark(name) {
    if (!this.enabled) return;
    this.marks.set(name, performance.now());
  }

  // Measure time since mark
  measure(name, label = null) {
    if (!this.enabled) return;
    
    const startTime = this.marks.get(name);
    if (!startTime) return;
    
    const duration = performance.now() - startTime;
    const measureLabel = label || name;
    
    this.measures.push({
      name: measureLabel,
      duration,
      timestamp: Date.now()
    });
    
    // Auto-cleanup old measures (keep last 100)
    if (this.measures.length > 100) {
      this.measures = this.measures.slice(-100);
    }
    
    // Warn about slow operations (>1s)
    if (duration > 1000) {
      console.warn(`⚠️ Slow operation: ${measureLabel} took ${duration.toFixed(0)}ms`);
    } else if (duration > 500) {
      console.log(`⏱️ ${measureLabel} took ${duration.toFixed(0)}ms`);
    }
    
    this.marks.delete(name);
    return duration;
  }

  // Get performance report
  getReport() {
    if (!this.enabled) return null;
    
    const cacheStats = enhancedCache.getStats();
    
    // Calculate average durations by operation type
    const avgDurations = new Map();
    this.measures.forEach(m => {
      const existing = avgDurations.get(m.name) || { total: 0, count: 0 };
      avgDurations.set(m.name, {
        total: existing.total + m.duration,
        count: existing.count + 1
      });
    });
    
    const averages = {};
    avgDurations.forEach((value, key) => {
      averages[key] = (value.total / value.count).toFixed(0) + 'ms';
    });
    
    return {
      cache: cacheStats,
      recentMeasures: this.measures.slice(-10),
      averageDurations: averages,
      totalMeasures: this.measures.length
    };
  }

  // Log performance report to console
  logReport() {
    if (!this.enabled) return;
    
    const report = this.getReport();
    console.group('📊 Performance Report');
    console.log('Cache Stats:', report.cache);
    console.log('Average Durations:', report.averageDurations);
    console.log('Recent Operations:', report.recentMeasures);
    console.groupEnd();
  }

  // Enable/disable monitoring
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

// Export singleton instance
export const perfMonitor = new PerformanceMonitor();

// Export hook for React components
export const usePerformanceMonitor = () => {
  return {
    mark: (name) => perfMonitor.mark(name),
    measure: (name, label) => perfMonitor.measure(name, label),
    getReport: () => perfMonitor.getReport(),
    logReport: () => perfMonitor.logReport()
  };
};

export default perfMonitor;

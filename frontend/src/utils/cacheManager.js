/**
 * CacheManager - Smart caching layer for Google Sheets API
 * Implements:
 * - LocalStorage persistence
 * - TTL (time-to-live) expiration
 * - Background refresh
 * - Cache invalidation strategies
 */

const CACHE_VERSION = 'v1';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default

class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.refreshTimers = new Map();
  }

  /**
   * Get cache key with version prefix
   */
  _getCacheKey(key) {
    return `${CACHE_VERSION}_${key}`;
  }

  /**
   * Set data in cache with TTL
   */
  set(key, data, ttl = DEFAULT_TTL) {
    const cacheKey = this._getCacheKey(key);
    const cacheItem = {
      data,
      timestamp: Date.now(),
      ttl,
      expiresAt: Date.now() + ttl
    };

    // Store in memory
    this.memoryCache.set(cacheKey, cacheItem);

    // Store in localStorage (with error handling for quota exceeded)
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
    } catch (e) {
      console.warn('LocalStorage quota exceeded, clearing old cache:', e);
      this.clearOldCache();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      } catch (e2) {
        console.error('Failed to cache after cleanup:', e2);
      }
    }

    return cacheItem;
  }

  /**
   * Get data from cache if not expired
   */
  get(key, acceptStale = false) {
    const cacheKey = this._getCacheKey(key);

    // Try memory cache first
    let cacheItem = this.memoryCache.get(cacheKey);

    // If not in memory, try localStorage
    if (!cacheItem) {
      try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          cacheItem = JSON.parse(stored);
          // Restore to memory
          this.memoryCache.set(cacheKey, cacheItem);
        }
      } catch (e) {
        console.warn('Failed to parse cache:', e);
        this.delete(key);
        return null;
      }
    }

    if (!cacheItem) return null;

    // Check expiration
    const isExpired = Date.now() > cacheItem.expiresAt;

    if (isExpired && !acceptStale) {
      this.delete(key);
      return null;
    }

    return {
      data: cacheItem.data,
      isStale: isExpired,
      age: Date.now() - cacheItem.timestamp
    };
  }

  /**
   * Delete cache entry
   */
  delete(key) {
    const cacheKey = this._getCacheKey(key);
    this.memoryCache.delete(cacheKey);
    try {
      localStorage.removeItem(cacheKey);
    } catch (e) {
      console.warn('Failed to remove from localStorage:', e);
    }

    // Clear any refresh timers
    if (this.refreshTimers.has(key)) {
      clearTimeout(this.refreshTimers.get(key));
      this.refreshTimers.delete(key);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  deletePattern(pattern) {
    const regex = new RegExp(pattern);
    const keysToDelete = [];

    // Check memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key.replace(`${CACHE_VERSION}_`, ''));
      }
    }

    // Check localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_VERSION) && regex.test(key)) {
          keysToDelete.push(key.replace(`${CACHE_VERSION}_`, ''));
        }
      }
    } catch (e) {
      console.warn('Failed to scan localStorage:', e);
    }

    // Delete all matching keys
    keysToDelete.forEach(key => this.delete(key));
    return keysToDelete.length;
  }

  /**
   * Clear all cache
   */
  clearAll() {
    this.memoryCache.clear();

    // Clear localStorage cache items
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_VERSION)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('Failed to clear localStorage cache:', e);
    }

    // Clear all refresh timers
    this.refreshTimers.forEach(timer => clearTimeout(timer));
    this.refreshTimers.clear();
  }

  /**
   * Clear old/expired cache entries
   */
  clearOldCache() {
    const now = Date.now();
    const keysToDelete = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_VERSION)) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.expiresAt < now) {
              keysToDelete.push(key);
            }
          } catch (e) {
            // Invalid JSON, delete it
            keysToDelete.push(key);
          }
        }
      }
      keysToDelete.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('Failed to clean old cache:', e);
    }
  }

  /**
   * Fetch with cache - core caching function
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch fresh data
   * @param {Object} options - Cache options
   * @returns {Promise} - Cached or fresh data
   */
  async fetchWithCache(key, fetchFn, options = {}) {
    const {
      ttl = DEFAULT_TTL,
      forceRefresh = false,
      acceptStale = true, // Return stale data while refreshing in background
      onRefresh = null // Callback when fresh data arrives
    } = options;

    // Force refresh - bypass cache
    if (forceRefresh) {
      this.delete(key);
      const freshData = await fetchFn();
      this.set(key, freshData, ttl);
      return freshData;
    }

    // Try to get from cache
    const cached = this.get(key, acceptStale);

    // If we have fresh cache, return it immediately
    if (cached && !cached.isStale) {
      return cached.data;
    }

    // If we have stale cache and acceptStale is true, return it and refresh in background
    if (cached && cached.isStale && acceptStale) {
      // Refresh in background
      this._refreshInBackground(key, fetchFn, ttl, onRefresh);
      return cached.data;
    }

    // No cache or not accepting stale - fetch now
    try {
      const freshData = await fetchFn();
      this.set(key, freshData, ttl);
      return freshData;
    } catch (error) {
      // If fetch fails but we have stale cache, return stale data
      if (cached) {
        console.warn(`Failed to fetch ${key}, returning stale cache:`, error);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Refresh data in background
   */
  _refreshInBackground(key, fetchFn, ttl, onRefresh) {
    // Prevent multiple simultaneous refreshes
    if (this.refreshTimers.has(key)) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const freshData = await fetchFn();
        this.set(key, freshData, ttl);
        
        // Call refresh callback if provided
        if (onRefresh) {
          onRefresh(freshData);
        }
        
        // Dispatch event for components to update
        window.dispatchEvent(new CustomEvent('cache-refreshed', { 
          detail: { key, data: freshData } 
        }));
      } catch (error) {
        console.warn(`Background refresh failed for ${key}:`, error);
      } finally {
        this.refreshTimers.delete(key);
      }
    }, 100); // Small delay to avoid blocking UI

    this.refreshTimers.set(key, timer);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {
      memorySize: this.memoryCache.size,
      localStorageSize: 0,
      totalSize: 0,
      keys: []
    };

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_VERSION)) {
          stats.localStorageSize++;
          stats.keys.push(key.replace(`${CACHE_VERSION}_`, ''));
        }
      }
    } catch (e) {
      console.warn('Failed to get cache stats:', e);
    }

    stats.totalSize = stats.localStorageSize;
    return stats;
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Cache TTL presets for different data types
export const CacheTTL = {
  SHORT: 2 * 60 * 1000,      // 2 minutes - frequently changing data
  MEDIUM: 5 * 60 * 1000,     // 5 minutes - default
  LONG: 15 * 60 * 1000,      // 15 minutes - semi-static data
  VERY_LONG: 60 * 60 * 1000, // 1 hour - rarely changing data
  SESSION: null               // Keep for entire session
};

// Invalidation strategies
export const invalidateCache = {
  // Invalidate when user submits/updates lesson plans
  onLessonPlanChange: () => {
    cacheManager.deletePattern('lessonPlans_');
    cacheManager.deletePattern('dailyReports_');
  },

  // Invalidate when schemes are updated
  onSchemeChange: () => {
    cacheManager.deletePattern('schemes_');
    cacheManager.deletePattern('lessonPlans_');
  },

  // Invalidate when timetable changes
  onTimetableChange: () => {
    cacheManager.deletePattern('timetable_');
    cacheManager.deletePattern('periods_');
  },

  // Invalidate when substitutions change
  onSubstitutionChange: () => {
    cacheManager.deletePattern('substitutions_');
    cacheManager.deletePattern('dailyReports_');
  },

  // Invalidate user-specific data
  onUserDataChange: (email) => {
    cacheManager.deletePattern(`user_${email}`);
  },

  // Invalidate all on logout
  onLogout: () => {
    cacheManager.clearAll();
  }
};

export default cacheManager;

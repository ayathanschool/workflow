/**
 * ====== BACKEND CACHING SYSTEM ======
 * Dramatically speeds up API responses by caching frequently accessed data
 * Uses Apps Script's built-in CacheService for fast in-memory storage
 */

// Cache duration constants (in seconds)
const CACHE_TTL = {
  SHORT: 60,        // 1 minute - for frequently changing data
  MEDIUM: 300,      // 5 minutes - for moderately stable data
  LONG: 900,        // 15 minutes - for rarely changing data
  VERY_LONG: 3600   // 1 hour - for static data
};

/**
 * Get cached data or fetch fresh data
 * @param {string} key - Unique cache key
 * @param {function} fetchFn - Function to fetch fresh data if cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {*} Cached or fresh data
 */
function getCachedData(key, fetchFn, ttl = CACHE_TTL.MEDIUM) {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(key);
    
    if (cached !== null) {
      appLog('DEBUG', 'Cache HIT', key);
      try {
        return JSON.parse(cached);
      } catch (parseErr) {
        appLog('WARN', 'Cache parse error', { key: key, error: parseErr.message });
        // Fall through to fetch fresh data
      }
    }
    
    appLog('DEBUG', 'Cache MISS', key);
    const fresh = fetchFn();
    
    // Store in cache (Apps Script cache has 100KB limit per entry)
    try {
      const serialized = JSON.stringify(fresh);
      // Apps Script cache has 100KB per entry limit
      if (serialized.length < 95000) { // Leave buffer
        cache.put(key, serialized, ttl);
      } else {
        appLog('WARN', 'Cache entry too large', { key: key, size: serialized.length });
      }
    } catch (cacheErr) {
      appLog('WARN', 'Cache storage error', { key: key, error: cacheErr.message });
    }
    
    return fresh;
  } catch (err) {
    appLog('ERROR', 'getCachedData error', { key: key, error: err.message });
    // On error, just return fresh data
    return fetchFn();
  }
}

/**
 * Invalidate cache entries by pattern
 * @param {string} pattern - Pattern to match cache keys
 */
function invalidateCache(pattern) {
  try {
    const cache = CacheService.getScriptCache();
    // Apps Script doesn't support pattern matching, so we track keys
    const keysJson = cache.get('_cache_keys') || '[]';
    const keys = JSON.parse(keysJson);
    
    const toRemove = keys.filter(function(k) {
      return k.indexOf(pattern) !== -1;
    });
    
    if (toRemove.length > 0) {
      cache.removeAll(toRemove);
      appLog('INFO', 'Cache invalidated', { pattern: pattern, count: toRemove.length });
      
      // Update tracked keys
      const remaining = keys.filter(function(k) {
        return k.indexOf(pattern) === -1;
      });
      cache.put('_cache_keys', JSON.stringify(remaining), CACHE_TTL.VERY_LONG);
    }
  } catch (err) {
    appLog('ERROR', 'invalidateCache error', { pattern: pattern, error: err.message });
  }
}

/**
 * Track a cache key
 * @param {string} key - Cache key to track
 */
function trackCacheKey(key) {
  try {
    const cache = CacheService.getScriptCache();
    const keysJson = cache.get('_cache_keys') || '[]';
    const keys = JSON.parse(keysJson);
    
    if (keys.indexOf(key) === -1) {
      keys.push(key);
      cache.put('_cache_keys', JSON.stringify(keys), CACHE_TTL.VERY_LONG);
    }
  } catch (err) {
    // Silent fail - tracking is optional
  }
}

/**
 * Clear all cache
 */
function clearAllCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll(JSON.parse(cache.get('_cache_keys') || '[]'));
    cache.remove('_cache_keys');
    appLog('INFO', 'All cache cleared');
    return { success: true, message: 'Cache cleared' };
  } catch (err) {
    appLog('ERROR', 'clearAllCache error', err.message);
    return { error: err.message };
  }
}

/**
 * Generate cache key with normalization
 * @param {string} prefix - Key prefix
 * @param {object} params - Parameters to include in key
 * @returns {string} Normalized cache key
 */
function generateCacheKey(prefix, params) {
  const parts = [prefix];
  
  if (params) {
    Object.keys(params).sort().forEach(function(key) {
      const value = params[key];
      if (value !== undefined && value !== null && value !== '') {
        parts.push(key + ':' + String(value).toLowerCase().trim());
      }
    });
  }
  
  return parts.join('_');
}

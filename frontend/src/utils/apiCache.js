// src/utils/apiCache.js - Enhanced API caching

// Progressive cache with smarter invalidation and persistence
const CACHE_VERSION = 1;
const LOCAL_STORAGE_KEY = 'schoolflow_api_cache_v1';

// Cache settings
const CACHE_CONFIG = {
  // Long lived data (changes rarely)
  longTerm: {
    duration: 24 * 60 * 60 * 1000, // 1 day
    endpoints: ['getAllClasses', 'getAllSubjects', 'getGradeTypes', 'getGradeBoundaries']
  },
  // Medium term (changes occasionally)
  mediumTerm: {
    duration: 60 * 60 * 1000, // 1 hour
    endpoints: ['getFullTimetable', 'getTeacherWeeklyTimetable', 'getHmInsights', 'getTeacherSchemes']
  },
  // Short term (changes frequently)
  shortTerm: {
    duration: 5 * 60 * 1000, // 5 minutes
    endpoints: ['getExams', 'getTeacherDailyTimetable', 'getSubstitutionsForDate']
  },
  // Very short (real-time data)
  realTime: {
    duration: 30 * 1000, // 30 seconds
    endpoints: ['getAssignedSubstitutions', 'getDailyTimetableWithSubstitutions']
  }
};

class EnhancedApiCache {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.loadFromLocalStorage();

    // Set up cache cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupExpiredEntries(), 5 * 60 * 1000);
  }

  // Determine cache duration based on endpoint
  getCacheDuration(url) {
    // Extract action parameter from URL
    const actionMatch = url.match(/[?&]action=([^&]+)/);
    if (!actionMatch) return CACHE_CONFIG.shortTerm.duration;
    
    const action = actionMatch[1];
    
    // Find matching cache configuration
    for (const [key, config] of Object.entries(CACHE_CONFIG)) {
      if (config.endpoints.includes(action)) {
        return config.duration;
      }
    }
    
    // Default to short term
    return CACHE_CONFIG.shortTerm.duration;
  }

  getCacheKey(url, method = 'GET', body = null) {
    // For GET requests, the URL is the key
    if (method === 'GET') return url;
    // For POST requests, include the body in the key
    return `${method}:${url}:${JSON.stringify(body)}`;
  }

  get(url, method = 'GET', body = null) {
    const key = this.getCacheKey(url, method, body);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(url, data, method = 'GET', body = null) {
    const key = this.getCacheKey(url, method, body);
    const duration = this.getCacheDuration(url);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + duration
    });
    
    // Save to localStorage for persistent caching
    this.saveToLocalStorage();
    
    return data;
  }

  // Check if a request is pending
  hasPendingRequest(url, method = 'GET', body = null) {
    return this.pendingRequests.has(this.getCacheKey(url, method, body));
  }

  // Set a pending request
  setPendingRequest(url, requestPromise, method = 'GET', body = null) {
    this.pendingRequests.set(this.getCacheKey(url, method, body), requestPromise);
    return requestPromise;
  }

  // Clear a pending request
  clearPendingRequest(url, method = 'GET', body = null) {
    this.pendingRequests.delete(this.getCacheKey(url, method, body));
  }

  // Get a pending request
  getPendingRequest(url, method = 'GET', body = null) {
    return this.pendingRequests.get(this.getCacheKey(url, method, body));
  }

  // Clear cache entries that match a pattern
  clearPattern(pattern) {
    if (!pattern) return;
    
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      // Only log in development and if significant
      if (import.meta.env.DEV && count > 5) {
        console.log(`[Cache] Cleared ${count} entries matching pattern: ${pattern}`);
      }
      this.saveToLocalStorage();
    }
  }

  // Clear related cache entries when a write operation occurs
  invalidateRelated(action) {
    const patterns = [];
    
    // Define patterns to invalidate based on the action
    if (action.includes('assignSubstitution') || action.includes('addSubstitution')) {
      patterns.push(
        'getSubstitutionsForDate',
        'getAssignedSubstitutions',
        'getDailyTimetableWithSubstitutions',
        'getTeacherDailyTimetable'
      );
    }
    else if (action.includes('submitExamMarks') || action.includes('createExam')) {
      patterns.push('getExams', 'getExamMarks');
    }
    else if (action.includes('submitAttendance')) {
      patterns.push('getAttendance');
    }
    else if (action.includes('submitPlan') || action.includes('updatePlanStatus')) {
      patterns.push('getTeacherLessonPlans', 'getPendingPlans', 'getTeacherSchemes');
    }
    
    // Invalidate matching patterns
    patterns.forEach(pattern => this.clearPattern(pattern));
  }

  // Remove expired entries from cache
  cleanupExpiredEntries() {
    let expiredCount = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      // Only log significant cleanups in development
      if (import.meta.env.DEV && expiredCount > 10) {
        console.log(`[Cache] Cleaned up ${expiredCount} expired entries`);
      }
      this.saveToLocalStorage();
    }
  }

  // Clear all cache entries
  clear() {
    this.cache.clear();
    this.saveToLocalStorage();
  }

  // Persist cache to localStorage
  saveToLocalStorage() {
    try {
      // Convert Map to serializable object
      const serializable = {};
      for (const [key, entry] of this.cache.entries()) {
        serializable[key] = entry;
      }
      
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        version: CACHE_VERSION,
        timestamp: Date.now(),
        entries: serializable
      }));
    } catch (err) {
      console.warn('[Cache] Failed to save to localStorage:', err);
    }
  }

  // Load cache from localStorage
  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) return;
      
      const parsed = JSON.parse(stored);
      
      // Skip if version mismatch
      if (parsed.version !== CACHE_VERSION) {
        // Only log version mismatches (usually happens after updates)
        if (import.meta.env.DEV) {
          console.log('[Cache] Version mismatch, clearing old cache');
        }
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return;
      }
      
      // Load entries from storage
      for (const [key, entry] of Object.entries(parsed.entries)) {
        // Skip if expired
        if (Date.now() > entry.expiry) continue;
        
        this.cache.set(key, entry);
      }
      
      // Only log in development
      if (import.meta.env.DEV) {
        console.log(`[Cache] Loaded ${this.cache.size} entries from storage`);
      }
    } catch (err) {
      console.warn('[Cache] Failed to load from localStorage:', err);
    }
  }
  
  // Clean up resources when done
  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

// Export a singleton instance
export const enhancedCache = new EnhancedApiCache();
export default enhancedCache;
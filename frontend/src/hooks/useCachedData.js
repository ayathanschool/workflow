import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheManager } from '../utils/cacheManager';

/**
 * useCachedData - React hook for cached API data with automatic refresh
 * 
 * @param {string} cacheKey - Unique cache key
 * @param {Function} fetchFn - Async function to fetch data
 * @param {Object} options - Cache options
 * @returns {Object} - { data, loading, error, refresh, isStale }
 * 
 * @example
 * const { data, loading, refresh } = useCachedData(
 *   'lessonPlans_user123',
 *   () => api.getTeacherLessonPlans(user.email),
 *   { ttl: CacheTTL.MEDIUM, refreshOnMount: true }
 * );
 */
export function useCachedData(cacheKey, fetchFn, options = {}) {
  const {
    ttl = 5 * 60 * 1000,      // 5 minutes default
    refreshOnMount = true,     // Fetch on component mount
    acceptStale = true,        // Return stale data while refreshing
    dependencies = []          // Re-fetch when these change
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const mountedRef = useRef(true);

  // Fetch function that handles caching
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      const result = await cacheManager.fetchWithCache(
        cacheKey,
        fetchFn,
        {
          ttl,
          forceRefresh,
          acceptStale,
          onRefresh: (freshData) => {
            // Update state when background refresh completes
            if (mountedRef.current) {
              setData(freshData);
              setIsStale(false);
            }
          }
        }
      );

      if (mountedRef.current) {
        setData(result);
        setLoading(false);
        
        // Check if data is stale
        const cached = cacheManager.get(cacheKey, true);
        setIsStale(cached?.isStale || false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }
    }
  }, [cacheKey, fetchFn, ttl, acceptStale]);

  // Refresh function for manual refresh
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    if (refreshOnMount) {
      fetchData();
    } else {
      // Just load from cache without network fetch
      const cached = cacheManager.get(cacheKey, true);
      if (cached) {
        setData(cached.data);
        setIsStale(cached.isStale);
        setLoading(false);
      } else {
        fetchData();
      }
    }
  }, [cacheKey, ...dependencies]);

  // Listen for cache refresh events
  useEffect(() => {
    const handler = (event) => {
      if (event.detail.key === cacheKey && mountedRef.current) {
        setData(event.detail.data);
        setIsStale(false);
      }
    };
    
    window.addEventListener('cache-refreshed', handler);
    return () => window.removeEventListener('cache-refreshed', handler);
  }, [cacheKey]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    isStale
  };
}

/**
 * useOptimisticUpdate - Hook for optimistic updates with cache
 * Updates cache immediately, then syncs with server
 * 
 * @param {string} cacheKey - Cache key to update
 * @param {Function} mutateFn - Async function to perform mutation
 * 
 * @example
 * const { mutate, loading, error } = useOptimisticUpdate(
 *   'lessonPlans_user123',
 *   (updatedPlan) => api.submitLessonPlan(updatedPlan)
 * );
 */
export function useOptimisticUpdate(cacheKey, mutateFn) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (optimisticData, rollbackData = null) => {
    try {
      setLoading(true);
      setError(null);

      // Update cache optimistically
      const cached = cacheManager.get(cacheKey, true);
      const previousData = cached?.data;
      
      cacheManager.set(cacheKey, optimisticData);

      // Perform actual mutation
      const result = await mutateFn(optimisticData);

      // Update cache with server response
      cacheManager.set(cacheKey, result);
      
      setLoading(false);
      return result;
    } catch (err) {
      // Rollback on error
      if (rollbackData) {
        cacheManager.set(cacheKey, rollbackData);
      }
      setError(err);
      setLoading(false);
      throw err;
    }
  }, [cacheKey, mutateFn]);

  return { mutate, loading, error };
}

/**
 * useCacheInvalidation - Hook to provide cache invalidation functions
 * Useful for invalidating related caches after mutations
 * 
 * @example
 * const { invalidate } = useCacheInvalidation();
 * // After submitting lesson plan:
 * invalidate.lessonPlans();
 */
export function useCacheInvalidation() {
  const invalidate = {
    lessonPlans: useCallback(() => {
      cacheManager.deletePattern('lessonPlans_');
      cacheManager.deletePattern('getPendingPreparation');
    }, []),
    
    schemes: useCallback(() => {
      cacheManager.deletePattern('schemes_');
      cacheManager.deletePattern('lessonPlans_');
    }, []),
    
    timetable: useCallback(() => {
      cacheManager.deletePattern('timetable_');
      cacheManager.deletePattern('periods_');
    }, []),
    
    substitutions: useCallback(() => {
      cacheManager.deletePattern('substitutions_');
    }, []),
    
    reports: useCallback(() => {
      cacheManager.deletePattern('dailyReports_');
      cacheManager.deletePattern('reports_');
    }, []),
    
    all: useCallback(() => {
      cacheManager.clearAll();
    }, [])
  };

  return { invalidate };
}

export default useCachedData;

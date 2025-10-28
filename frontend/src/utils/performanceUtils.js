// Performance optimization utilities

/**
 * Debounce function to limit how often a function can run
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between executions
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Lazy load images with Intersection Observer
 * @param {string} selector - CSS selector for images
 */
export function lazyLoadImages(selector = 'img[data-src]') {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    });

    document.querySelectorAll(selector).forEach(img => imageObserver.observe(img));
  }
}

/**
 * Batch multiple function calls into a single execution
 * @param {Function} func - Function to batch
 * @param {number} wait - Milliseconds to wait before execution
 * @returns {Function} Batched function
 */
export function batchCalls(func, wait = 100) {
  let calls = [];
  let timeout;

  return function(...args) {
    calls.push(args);
    
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const allCalls = [...calls];
      calls = [];
      func(allCalls);
    }, wait);
  };
}

/**
 * Memoize function results
 * @param {Function} func - Function to memoize
 * @returns {Function} Memoized function
 */
export function memoize(func) {
  const cache = new Map();
  
  return function(...args) {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func.apply(this, args);
    cache.set(key, result);
    
    return result;
  };
}

/**
 * Virtual scrolling helper for large lists
 * @param {Array} items - Full list of items
 * @param {number} containerHeight - Height of scroll container
 * @param {number} itemHeight - Height of each item
 * @param {number} scrollTop - Current scroll position
 * @returns {Object} Visible items and offsets
 */
export function virtualScroll(items, containerHeight, itemHeight, scrollTop) {
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);
  
  const visibleItems = items.slice(
    Math.max(0, startIndex - 5), // Buffer before
    Math.min(items.length, endIndex + 5) // Buffer after
  );
  
  const offsetY = Math.max(0, startIndex - 5) * itemHeight;
  
  return {
    visibleItems,
    offsetY,
    totalHeight,
    startIndex: Math.max(0, startIndex - 5),
    endIndex: Math.min(items.length, endIndex + 5)
  };
}

/**
 * Preload data in the background
 * @param {Function} loadFunc - Function that loads data
 * @param {number} delay - Delay in milliseconds
 */
export function preloadData(loadFunc, delay = 1000) {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => loadFunc(), { timeout: delay });
  } else {
    setTimeout(loadFunc, delay);
  }
}

/**
 * Optimize React re-renders by comparing props
 * @param {Object} prevProps - Previous props
 * @param {Object} nextProps - Next props
 * @returns {boolean} Should component update
 */
export function shallowCompare(prevProps, nextProps) {
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);
  
  if (prevKeys.length !== nextKeys.length) {
    return true;
  }
  
  return prevKeys.some(key => prevProps[key] !== nextProps[key]);
}

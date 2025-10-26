// apiUtils.js
// Helper functions for the API

/**
 * Get the base URL for API requests
 * This is a centralized function to get the API base URL to ensure consistency
 * across the application and handle special cases like HTTPS in development
 * @returns {string} The base URL for API requests
 */
export function getBaseUrl() {
  const PROD_BASE = import.meta.env.VITE_GAS_WEB_APP_URL || '';
  
  // In development mode:
  // - Use '/gas' for proxying in HTTP mode
  // - Use the actual URL for HTTPS mode where proxy might not work
  if (import.meta.env.DEV) {
    return (window.location.protocol === 'https:') ? PROD_BASE : '/gas';
  }
  
  // In production, always use the configured URL
  return PROD_BASE;
}

/**
 * Get the current environment
 * @returns {string} 'development' or 'production'
 */
export function getEnvironment() {
  return import.meta.env.DEV ? 'development' : 'production';
}

/**
 * Log API events (only in development)
 * @param  {...any} args Arguments to log
 */
export function logApi(...args) {
  if (import.meta.env.DEV) {
    console.log('[API]', ...args);
  }
}
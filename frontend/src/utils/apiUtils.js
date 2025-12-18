// apiUtils.js
// Helper functions for the API

/**
 * Get the base URL for API requests
 * This is a centralized function to get the API base URL to ensure consistency
 * across the application and handle special cases like HTTPS in development
 * @returns {string} The base URL for API requests
 */
export function getBaseUrl() {
  // Always prefer explicit env-configured URL when available
  const BASE = import.meta.env.VITE_API_BASE_URL
    || import.meta.env.VITE_GAS_WEB_APP_URL
    || import.meta.env.VITE_APP_SCRIPT_URL
    || '';

  if (!BASE) {
    console.warn('[api] No API base URL provided. Set VITE_API_BASE_URL in .env');
  }

  return BASE || '/gas';
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
// Removed unused dev-only logger to reduce bundle size
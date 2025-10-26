// Service Worker for AyathanWorkflow PWA
const CACHE_NAME = 'ayathan-workflow-v1.0.0';
const STATIC_CACHE = 'ayathan-static-v1.0.0';
const DYNAMIC_CACHE = 'ayathan-dynamic-v1.0.0';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add other static assets as needed
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/exec\?action=getTeacherWeeklyTimetable/,
  /\/exec\?action=getTeacherLessonPlans/,
  /\/exec\?action=getAppSettings/,
  /\/exec\?action=getAllClasses/,
  /\/exec\?action=getAllSubjects/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different types of requests
  if (request.destination === 'document') {
    // HTML documents - network first, fallback to cache
    event.respondWith(networkFirstStrategy(request));
  } else if (isApiRequest(request)) {
    // API requests - cache first for specific endpoints, network first for others
    if (shouldCacheApiRequest(request)) {
      event.respondWith(cacheFirstStrategy(request));
    } else {
      event.respondWith(networkFirstStrategy(request));
    }
  } else {
    // Static assets - cache first
    event.respondWith(cacheFirstStrategy(request));
  }
});

// Network first strategy (for HTML and dynamic content)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for HTML requests
    if (request.destination === 'document') {
      return caches.match('/offline.html') || new Response(
        '<html><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    throw error;
  }
}

// Cache first strategy (for static assets and cacheable API responses)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Update cache in background for API requests
    if (isApiRequest(request)) {
      updateCacheInBackground(request);
    }
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(
        isApiRequest(request) ? DYNAMIC_CACHE : STATIC_CACHE
      );
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network and cache failed:', error);
    throw error;
  }
}

// Update cache in background
function updateCacheInBackground(request) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(DYNAMIC_CACHE)
          .then((cache) => cache.put(request, response));
      }
    })
    .catch((error) => {
      console.log('Service Worker: Background cache update failed:', error);
    });
}

// Check if request is to API
function isApiRequest(request) {
  return request.url.includes('/exec') || request.url.includes('/api');
}

// Check if API request should be cached
function shouldCacheApiRequest(request) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(request.url));
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync-lesson-plans') {
    event.waitUntil(syncLessonPlans());
  } else if (event.tag === 'background-sync-daily-reports') {
    event.waitUntil(syncDailyReports());
  }
});

// Sync cached lesson plans when online
async function syncLessonPlans() {
  try {
    const cache = await caches.open('offline-actions');
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('submitLessonPlanDetails')) {
        try {
          await fetch(request);
          await cache.delete(request);
          console.log('Service Worker: Synced lesson plan');
        } catch (error) {
          console.log('Service Worker: Failed to sync lesson plan:', error);
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Error syncing lesson plans:', error);
  }
}

// Sync cached daily reports when online
async function syncDailyReports() {
  try {
    const cache = await caches.open('offline-actions');
    const requests = await cache.keys();
    
    for (const request of requests) {
      if (request.url.includes('submitDailyReport')) {
        try {
          await fetch(request);
          await cache.delete(request);
          console.log('Service Worker: Synced daily report');
        } catch (error) {
          console.log('Service Worker: Failed to sync daily report:', error);
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Error syncing daily reports:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    title: 'AyathanWorkflow',
    body: 'You have new updates',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icons/open-24x24.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/close-24x24.png'
      }
    ]
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      options.title = data.title || options.title;
      options.body = data.body || options.body;
      options.data.url = data.url || options.data.url;
    } catch (error) {
      console.log('Service Worker: Error parsing push data:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then((clients) => {
        // Check if app is already open
        for (const client of clients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// Message handling for communication with main app
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_OFFLINE_ACTION') {
    // Cache actions for offline sync
    cacheOfflineAction(event.data.payload);
  }
});

// Cache offline actions
async function cacheOfflineAction(action) {
  try {
    const cache = await caches.open('offline-actions');
    const request = new Request(action.url, {
      method: action.method,
      headers: action.headers,
      body: action.body
    });
    
    await cache.put(request, new Response(JSON.stringify(action.data)));
    console.log('Service Worker: Cached offline action');
  } catch (error) {
    console.error('Service Worker: Error caching offline action:', error);
  }
}
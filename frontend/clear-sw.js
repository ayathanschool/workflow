// SERVICE WORKER DEBUG AND CLEANUP SCRIPT
// Run this in your browser console to fix restart issues

console.log('🔧 Service Worker Cleanup Script');
console.log('================================');

// 1. Unregister all service workers
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log(`Found ${registrations.length} service worker(s)`);
  
  registrations.forEach((registration, index) => {
    registration.unregister().then(success => {
      if (success) {
        console.log(`✅ Unregistered service worker ${index + 1}`);
      } else {
        console.log(`❌ Failed to unregister service worker ${index + 1}`);
      }
    });
  });
  
  if (registrations.length === 0) {
    console.log('ℹ️ No service workers found');
  }
});

// 2. Clear all caches
caches.keys().then(cacheNames => {
  console.log(`Found ${cacheNames.length} cache(s)`);
  
  return Promise.all(
    cacheNames.map(cacheName => {
      return caches.delete(cacheName).then(() => {
        console.log(`✅ Deleted cache: ${cacheName}`);
      });
    })
  );
}).then(() => {
  console.log('✅ All caches cleared');
  console.log('🔄 Please refresh the page (Ctrl+Shift+R or Cmd+Shift+R)');
});

// 3. Log current state
setTimeout(() => {
  console.log('\n📊 Current State:');
  console.log('Service Worker Controller:', navigator.serviceWorker.controller);
  console.log('Service Worker Ready:', navigator.serviceWorker.ready);
}, 1000);

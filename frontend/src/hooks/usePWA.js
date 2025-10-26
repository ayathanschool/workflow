import { useState, useEffect } from 'react';

export const usePWA = () => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isStandalone, setIsStandalone] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check if app is running in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone ||
      document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);
    
    console.log('PWA: Standalone mode:', isStandaloneMode);
    console.log('PWA: Service Worker supported:', 'serviceWorker' in navigator);
    console.log('PWA: Push Manager supported:', 'PushManager' in window);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      console.log('PWA: beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('PWA: App was installed');
    };

    // Listen for online/offline status
    const handleOnline = () => {
      console.log('PWA: Online');
      setIsOnline(true);
    };
    const handleOffline = () => {
      console.log('PWA: Offline');
      setIsOnline(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Global function for service worker update notification
    window.showUpdateNotification = () => {
      console.log('PWA: Update available');
      setHasUpdate(true);
    };

    // Check if manifest is valid
    fetch('/manifest.json')
      .then(response => response.json())
      .then(manifest => {
        console.log('PWA: Manifest loaded:', manifest);
      })
      .catch(error => {
        console.error('PWA: Manifest error:', error);
      });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      delete window.showUpdateNotification;
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return false;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error installing app:', error);
      return false;
    }
  };

  const updateApp = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
  };

  const cacheOfflineAction = (action) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_OFFLINE_ACTION',
        payload: action
      });
    }
  };

  return {
    isInstallable,
    isOnline,
    isStandalone,
    hasUpdate,
    installApp,
    updateApp,
    cacheOfflineAction
  };
};

export const useOfflineStorage = () => {
  const setOfflineData = (key, data) => {
    try {
      localStorage.setItem(`offline_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error storing offline data:', error);
    }
  };

  const getOfflineData = (key, maxAge = 24 * 60 * 60 * 1000) => {
    try {
      const stored = localStorage.getItem(`offline_${key}`);
      if (!stored) return null;

      const { data, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(`offline_${key}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting offline data:', error);
      return null;
    }
  };

  const clearOfflineData = (key = null) => {
    try {
      if (key) {
        localStorage.removeItem(`offline_${key}`);
      } else {
        // Clear all offline data
        Object.keys(localStorage)
          .filter(k => k.startsWith('offline_'))
          .forEach(k => localStorage.removeItem(k));
      }
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  };

  return {
    setOfflineData,
    getOfflineData,
    clearOfflineData
  };
};
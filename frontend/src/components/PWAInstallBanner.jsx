import { Download, X, Smartphone, Monitor, AlertCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';

const PWAInstallBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installSupported, setInstallSupported] = useState(false);

  useEffect(() => {
    // Check if app is running in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone ||
      document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);

    // Don't show banner if already installed
    if (isStandaloneMode) return;

    // Check if user has dismissed banner before
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    const dismissedTime = localStorage.getItem('pwa-banner-dismissed-time');
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Reset dismissal after 24 hours
    if (dismissed && dismissedTime && parseInt(dismissedTime) < oneDayAgo) {
      localStorage.removeItem('pwa-banner-dismissed');
      localStorage.removeItem('pwa-banner-dismissed-time');
    }

    if (dismissed && dismissedTime && parseInt(dismissedTime) >= oneDayAgo) return;

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      console.log('PWA: beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallSupported(true);
      setShowBanner(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      console.log('PWA: App installed');
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa-banner-dismissed', 'true');
      localStorage.setItem('pwa-banner-dismissed-time', Date.now().toString());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show banner after 5 seconds even without install prompt (for manual instructions)
    const timer = setTimeout(() => {
      if (!isStandaloneMode && !dismissed) {
        setShowBanner(true);
        // Check if we can detect install capability
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          setInstallSupported(true);
        }
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        console.log('PWA: Attempting to show install prompt');
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        console.log('PWA: User choice:', outcome);
        if (outcome === 'accepted') {
          setShowBanner(false);
          setDeferredPrompt(null);
          localStorage.setItem('pwa-banner-dismissed', 'true');
          localStorage.setItem('pwa-banner-dismissed-time', Date.now().toString());
        }
      } catch (error) {
        console.error('PWA: Error installing app:', error);
        showManualInstructions();
      }
    } else {
      showManualInstructions();
    }
  };

  const showManualInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    let instructions = '';
    
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
      instructions = 'Chrome: Look for the install icon (⊞) in the address bar, or click the three dots menu → "Install AyathanWorkflow"';
    } else if (userAgent.includes('firefox')) {
      instructions = 'Firefox: Click the three lines menu → "Install this site as an app"';
    } else if (userAgent.includes('safari')) {
      instructions = 'Safari: Click the Share button → "Add to Home Screen"';
    } else if (userAgent.includes('edg')) {
      instructions = 'Edge: Look for the install icon in the address bar, or click the three dots → "Apps" → "Install this site as an app"';
    } else {
      instructions = 'Look for an "Install" or "Add to Home Screen" option in your browser menu';
    }
    
    alert(`To install AyathanWorkflow:\n\n${instructions}\n\nNote: Make sure you're on HTTPS and have used the app for a few minutes.`);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
    localStorage.setItem('pwa-banner-dismissed-time', Date.now().toString());
  };

  // Don't show if already installed
  if (isStandalone || !showBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg pointer-events-none">
      <div className="max-w-4xl mx-auto flex items-center justify-between pointer-events-auto">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-6 h-6" />
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center space-x-2">
              <span>Install AyathanWorkflow</span>
              {!installSupported && <AlertCircle className="w-4 h-4 text-yellow-300" />}
            </h3>
            <p className="text-sm opacity-90">
              {installSupported 
                ? "Get the full app experience with offline access" 
                : "Use this app offline - installation available in browser menu"
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleInstall}
            className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{deferredPrompt ? 'Install' : 'How to Install'}</span>
          </button>
          <button
            onClick={handleDismiss}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
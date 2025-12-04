import { Download, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { usePWA } from '../hooks/usePWA';

const PWAControls = () => {
  const { isInstallable, isOnline, isStandalone, hasUpdate, installApp, updateApp } = usePWA();
  const { info, success } = useNotifications();

  const handleInstall = async () => {
    const installed = await installApp();
    if (installed) {
      success('App Installed!', 'AyathanWorkflow has been installed to your device');
    }
  };

  const handleUpdate = () => {
    info('Updating...', 'App is updating, please wait...');
    updateApp();
  };

  // Don't show controls if running in standalone mode
  if (isStandalone) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {/* Connection Status */}
      <div className={`px-3 py-2 rounded-lg text-sm flex items-center space-x-2 ${
        isOnline 
          ? 'bg-green-100 text-green-700 border border-green-200' 
          : 'bg-red-100 text-red-700 border border-red-200'
      }`}>
        {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </div>

      {/* Install Button */}
      {isInstallable && (
        <button
          onClick={handleInstall}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Download className="w-4 h-4" />
          <span>Install App</span>
        </button>
      )}

      {/* Update Button */}
      {hasUpdate && (
        <button
          onClick={handleUpdate}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-orange-700 transition-colors shadow-lg animate-pulse"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Update Available</span>
        </button>
      )}
    </div>
  );
};

export default PWAControls;
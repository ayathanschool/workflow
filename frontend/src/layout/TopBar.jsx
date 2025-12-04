import { LogOut } from 'lucide-react';
import React from 'react';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';

export default function TopBar({ user, onLogout }) {
  const googleAuth = useGoogleAuth();
  const handleLogout = () => {
    if (googleAuth && googleAuth.user) {
      googleAuth.logout();
    }
    onLogout && onLogout();
  };
  return (
    <div className="flex items-center justify-end gap-4 p-2">
      {user && (
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          {googleAuth && googleAuth.user && (
            <img src={googleAuth.user.picture} alt="avatar" className="w-8 h-8 rounded-full object-cover" onError={(e)=>{e.target.style.display='none';}} />
          )}
          <span>{user.name || user.email}</span>
        </div>
      )}
      <button onClick={handleLogout} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors">
        <LogOut size={14} /> Logout
      </button>
    </div>
  );
}

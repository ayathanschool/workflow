// src/components/UserHeader.jsx
import { LogOut } from 'lucide-react';
import React from 'react';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from './ThemeToggle';

// This component shows the user's information in the header
function UserHeader({ user }) {
  const { theme } = useTheme();
  const googleAuth = useGoogleAuth();
  
  if (!user) {
    return <p>Not logged in</p>;
  }

  const handleLogout = () => {
    // If user is logged in with Google, use Google logout
    if (googleAuth?.user) {
      googleAuth.logout();
    }
    // Additionally, clear local storage and reload page
    localStorage.removeItem('user');
    localStorage.removeItem('sf_google_session');
    window.location.reload();
  };

  return (
    <div className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'} py-2 px-4 shadow-sm mb-6 transition-colors duration-300`}>
      <div className="flex justify-between items-center">
        <p className={`${theme === 'dark' ? 'text-gray-100' : 'text-gray-700'} transition-colors duration-300`}>
          Logged in as: <span className="font-medium">{user.name}</span> (
          <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} transition-colors duration-300`}>{user.email}</span>) - Role:{' '}
          <span className={`${theme === 'dark' ? 'bg-blue-900 text-blue-100' : 'bg-blue-100 text-blue-800'} px-2 py-0.5 rounded-full text-xs font-medium transition-colors duration-300`}>
            {Array.isArray(user.role) ? user.role.join(', ') : user.role}
          </span>
        </p>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <button 
            onClick={handleLogout} 
            className={`flex items-center px-3 py-1 rounded ${theme === 'dark' ? 'bg-red-800 hover:bg-red-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'} transition-colors duration-300`}
          >
            <LogOut className="h-4 w-4 mr-1" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserHeader;
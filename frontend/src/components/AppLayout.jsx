// src/components/AppLayout.jsx
import React from 'react';
import UserHeader from './UserHeader';
import { useTheme } from '../contexts/ThemeContext';
import { useGoogleAuth } from '../contexts/GoogleAuthContext';

// This component provides a consistent layout wrapper for all screens in the app
function AppLayout({ user, children, activeView, navigationItems }) {
  const { theme } = useTheme();
  const googleAuth = useGoogleAuth();
  
  // Function to determine if a menu item should be shown based on user's role
  const shouldShowMenuItem = (item) => {
    if (!user || !item.roles) return true;
    return item.roles.some(role => 
      Array.isArray(user.role) 
        ? user.role.includes(role) 
        : user.role === role
    );
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'} transition-colors duration-300`}>
      {/* Top Header with User Info */}
      <UserHeader user={user} />
      
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Navigation Sidebar */}
          <div className="md:col-span-1">
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-sm p-4 transition-colors duration-300`}>
              <h3 className={`text-lg font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-4 transition-colors duration-300`}>Navigation</h3>
              <nav className="space-y-1">
                {navigationItems && navigationItems.filter(shouldShowMenuItem).map(item => (
                  <a
                    key={item.id}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      item.onClick && item.onClick(item.id);
                    }}
                    className={`block px-3 py-2 rounded-md text-sm font-medium ${
                      activeView === item.id
                        ? theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-blue-50 text-blue-700'
                        : theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'
                    } transition-colors duration-300`}
                  >
                    <div className="flex items-center">
                      {item.icon && (
                        <span className="mr-3">
                          <item.icon className="h-5 w-5" />
                        </span>
                      )}
                      {item.label}
                    </div>
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="md:col-span-3">
            {children}
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} mt-12 py-6 border-t transition-colors duration-300`}>
        <div className={`container mx-auto px-4 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm transition-colors duration-300`}>
          &copy; {new Date().getFullYear()} SchoolFlow - School Management System
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;
import { Bell, LogOut, Menu, User } from 'lucide-react';
import React from 'react';
import ThemeToggle from './ThemeToggle';

const AppHeader = ({
  activeView,
  setSidebarOpen,
  setSidebarOpenedAt,
  user,
  googleAuth,
  onLogout,
  onNotification,
}) => (
  <div className="flex items-center justify-between gap-2 p-3 sm:p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
    <div className="flex min-w-0 items-center">
      <button
        onClick={() => { setSidebarOpen(true); setSidebarOpenedAt(Date.now()); }}
        className="mr-2 sm:mr-3 p-2 rounded-md transition-colors duration-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
      <h1 className="truncate text-base sm:text-xl font-semibold capitalize text-gray-900 dark:text-white">
        {activeView.replaceAll('-', ' ')}
      </h1>
    </div>

    <div className="flex flex-shrink-0 items-center gap-1 sm:gap-4">
      <ThemeToggle />
      <button
        onClick={onNotification}
        className="p-2 transition-colors duration-200 text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
        title="Send a notification"
      >
        <Bell className="h-5 w-5" />
      </button>
      <div className="flex items-center">
        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="h-5 w-5 text-blue-600" />
        </div>
        <div className="ml-2 hidden min-w-0 text-gray-700 dark:text-gray-300 sm:block">
          <div className="max-w-32 truncate text-sm font-medium">{user?.name}</div>
          <div className="hidden md:block">
            {user?.roles && user.roles.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {user.roles.join(', ')}
              </div>
            )}
            {googleAuth?.user ? (
              <div className="text-xs text-blue-600 dark:text-blue-400">Google Login</div>
            ) : (
              <div className="text-xs text-green-600 dark:text-green-400">Password Login</div>
            )}
          </div>
        </div>
        <button
          onClick={onLogout}
          className="ml-1 sm:ml-4 flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors duration-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700 sm:h-auto sm:w-auto sm:bg-transparent sm:hover:bg-transparent"
          aria-label="Logout"
          title="Logout"
        >
          <LogOut className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </div>
  </div>
);

export default AppHeader;

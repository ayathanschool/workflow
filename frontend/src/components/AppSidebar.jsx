import { ChevronDown, School, X } from 'lucide-react';
import React, { useState } from 'react';

const AppSidebar = ({
  navigationItems,
  sidebarOpen,
  sidebarOpenedAt,
  setSidebarOpen,
  setActiveView,
  activeView,
}) => {
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (groupId) =>
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

  const NavItems = () => (
    <nav className="px-2 space-y-1">
      {navigationItems.map((item) => {
        const Icon = item.icon;

        if (item.isGroup && item.children) {
          const isExpanded = expandedGroups[item.id];
          return (
            <div key={item.id} className="space-y-1">
              <button
                onClick={() => {
                  toggleGroup(item.id);
                  // If the group is the Fee Collection section, also navigate to its overview
                  if (item.id === 'fee-collection-group') {
                    setActiveView('fee-collection-new-payment');
                    setSidebarOpen(false);
                  }
                }}
                className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md w-full text-left transition-colors duration-200"
              >
                <div className="flex items-center">
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    isExpanded ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="ml-4 space-y-1">
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    return (
                      <button
                        key={child.id}
                        onClick={() => {
                          setActiveView(child.id);
                          setSidebarOpen(false);
                        }}
                        className={`${
                          activeView === child.id
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:hover:text-white'
                        } group flex items-center px-3 py-2 text-sm rounded-md w-full text-left transition-colors duration-200`}
                      >
                        <ChildIcon className="mr-3 h-4 w-4" />
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => {
              setActiveView(item.id);
              setSidebarOpen(false);
            }}
            className={`${
              activeView === item.id
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white'
            } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full text-left transition-colors duration-200`}
          >
            <Icon className="mr-3 h-5 w-5" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile drawer overlay — hidden on lg+ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity z-[65]"
            onClick={() => {
              if (Date.now() - sidebarOpenedAt < 300) return;
              setSidebarOpen(false);
            }}
          />
          <div
            className="fixed inset-y-0 left-0 flex flex-col w-72 max-w-[85vw] bg-white dark:bg-gray-800 z-[70] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <School className="h-7 w-7 text-blue-600" />
                <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">SchoolFlow</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <NavItems />
            </div>
          </div>
        </div>
      )}

      {/* Desktop persistent sidebar — visible on lg+ */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <School className="h-7 w-7 text-blue-600" />
            <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">SchoolFlow</span>
          </div>
          <div className="flex-1 overflow-y-auto py-3">
            <NavItems />
          </div>
        </div>
      </div>
    </>
  );
};

export default AppSidebar;

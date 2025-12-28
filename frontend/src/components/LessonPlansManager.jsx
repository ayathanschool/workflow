import React, { useState, useEffect } from 'react';
import { BookCheck, FileText, BookOpen } from 'lucide-react';

/**
 * Unified Lesson Plans Manager
 * Combines Scheme-Based Planning (draft/create) + Submitted Lesson Plans (view/manage)
 * Keeps Scheme of Work separate as curriculum planning
 */
const LessonPlansManager = ({ 
  user,
  SchemeLessonPlanning, 
  LessonPlansView,
  onNavigate
}) => {
  const [activeTab, setActiveTab] = useState('draft');

  // Read tab from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab === 'draft' || urlTab === 'submitted') {
      setActiveTab(urlTab);
    }
  }, []);

  // Update URL when tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const tabs = [
    { 
      id: 'draft', 
      label: 'Draft Plans', 
      icon: BookCheck,
      description: 'Create and prepare lesson plans from schemes'
    },
    { 
      id: 'submitted', 
      label: 'Submitted Plans', 
      icon: FileText,
      description: 'View and manage submitted lesson plans'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              My Lesson Plans
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Create, manage, and submit your lesson plans
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          {/* Mobile: Vertical Tabs */}
          <div className="sm:hidden space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-gray-800 shadow-md border-2 border-blue-500 dark:border-blue-400'
                      : 'bg-white/50 dark:bg-gray-800/50 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${
                    activeTab === tab.id 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium ${
                      activeTab === tab.id 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {tab.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {tab.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop: Horizontal Tabs */}
          <div className="hidden sm:flex gap-2 bg-white/50 dark:bg-gray-800/50 p-2 rounded-lg backdrop-blur-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-gray-800 shadow-md border-2 border-blue-500 dark:border-blue-400'
                      : 'border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${
                    activeTab === tab.id 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`} />
                  <span className={`font-medium ${
                    activeTab === tab.id 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {activeTab === 'draft' && (
            <SchemeLessonPlanning 
              userEmail={user?.email} 
              userName={user?.name}
            />
          )}
          {activeTab === 'submitted' && (
            <LessonPlansView />
          )}
        </div>
      </div>
    </div>
  );
};

export default LessonPlansManager;

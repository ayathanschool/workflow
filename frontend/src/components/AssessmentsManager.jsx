import { FileText, Award, ClipboardCheck } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import ExamManagement from './ExamManagement';
import ExamMarksMatrix from './ExamMarksMatrix';
import Marklist from './Marklist';
import ReportCard from './ReportCard';

/**
 * Unified Assessments Manager
 * Combines Exam Management, Report Cards, and Marklists into one cohesive module
 */
const AssessmentsManager = ({ user, hasRole, withSubmit, userRolesNorm }) => {
  // Get tab from URL or default to marks-entry
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'marks-entry';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());

  // Update URL when tab changes (without page reload)
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const url = new URL(window.location);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url);
  };

  // Tab configuration
  const tabs = useMemo(() => [
    {
      id: 'marks-entry',
      label: 'Exam Marks',
      icon: Award,
      description: 'Create exams and enter marks',
      component: ExamManagement
    },
    {
      id: 'marks-matrix',
      label: 'Marks Matrix',
      icon: Award,
      description: 'One-page marks + grade table',
      component: ExamMarksMatrix
    },
    {
      id: 'reports',
      label: 'Report Cards',
      icon: FileText,
      description: 'View student report cards',
      component: ReportCard
    },
    {
      id: 'marklists',
      label: 'Marklists',
      icon: ClipboardCheck,
      description: 'Generate class marklists',
      component: Marklist
    }
  ], []);

  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
  const CurrentComponent = currentTab.component;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Assessments</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Manage exams, marks, reports, and marklists</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex flex-col sm:flex-row border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 px-6 py-4 text-left sm:text-center transition-all ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 sm:flex-col sm:gap-2">
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${isActive ? 'text-blue-900 dark:text-blue-200' : ''}`}>
                      {tab.label}
                    </div>
                    <div className="text-xs mt-0.5 hidden sm:block text-gray-500 dark:text-gray-400">
                      {tab.description}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <CurrentComponent 
            user={user} 
            hasRole={hasRole} 
            withSubmit={withSubmit} 
            userRolesNorm={userRolesNorm}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(AssessmentsManager);

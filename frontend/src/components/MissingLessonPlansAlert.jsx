import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, Clock, X, ChevronDown, ChevronUp } from 'lucide-react';
import * as api from '../api';

// MOCK DATA for testing (remove in production)
const ENABLE_MOCK = false; // Set to true to test UI with mock data
const MOCK_DATA = {
  success: true,
  teacherEmail: 'test@teacher.com',
  dateRange: { start: '2025-12-06', end: '2025-12-13' },
  missingCount: 5,
  byCriticality: {
    critical: 2,
    high: 1,
    medium: 1,
    low: 1
  },
  missing: [
    { date: '2025-12-06', day: 'Friday', period: '5', class: 'STD 10A', subject: 'Mathematics', daysUntil: 0, urgency: 'critical' },
    { date: '2025-12-07', day: 'Saturday', period: '2', class: 'STD 9B', subject: 'Science', daysUntil: 1, urgency: 'critical' },
    { date: '2025-12-09', day: 'Monday', period: '3', class: 'STD 10A', subject: 'Physics', daysUntil: 3, urgency: 'high' },
    { date: '2025-12-10', day: 'Tuesday', period: '4', class: 'STD 8C', subject: 'Chemistry', daysUntil: 4, urgency: 'medium' },
    { date: '2025-12-12', day: 'Thursday', period: '6', class: 'STD 7A', subject: 'Biology', daysUntil: 6, urgency: 'low' }
  ]
};

/**
 * Alert component for missing lesson plans
 * Shows teachers which upcoming periods are missing lesson plans
 */
export default function MissingLessonPlansAlert({ user, onPrepareClick }) {
  const [missingData, setMissingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (user?.email) {
      loadMissingLessonPlans();
      
      // Refresh every 5 minutes
      const interval = setInterval(loadMissingLessonPlans, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user?.email]);

  const loadMissingLessonPlans = async () => {
    try {
      setLoading(true);
      
      // USE MOCK DATA in development mode
      if (ENABLE_MOCK) {
        console.log('🧪 Using MOCK data for MissingLessonPlansAlert');
        setMissingData(MOCK_DATA);
        setIsExpanded(true); // Auto-expand for testing
        setLoading(false);
        return;
      }
      
      console.log('📡 Fetching real missing lesson plans for:', user.email);
      const result = await api.getMissingLessonPlans(user.email, 7); // 7 days ahead
      console.log('📊 API Response:', result);
      
      if (result.success) {
        console.log('✅ Missing plans found:', result.missingCount);
        setMissingData(result);
        // Auto-expand if there are critical or high priority items
        if (result.byCriticality.critical > 0 || result.byCriticality.high > 0) {
          setIsExpanded(true);
        }
      } else {
        console.error('❌ API returned success=false:', result.error);
      }
    } catch (error) {
      console.error('💥 Error loading missing lesson plans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !missingData || missingData.missingCount === 0 || isDismissed) {
    return null;
  }

  const { missingCount, byCriticality, missing } = missingData;
  const hasCritical = byCriticality.critical > 0;
  const hasHigh = byCriticality.high > 0;

  // Determine alert severity
  const alertColor = hasCritical 
    ? 'red' 
    : hasHigh 
    ? 'orange' 
    : 'yellow';

  const bgColor = {
    red: 'bg-red-50 border-red-300',
    orange: 'bg-orange-50 border-orange-300',
    yellow: 'bg-yellow-50 border-yellow-300'
  }[alertColor];

  const textColor = {
    red: 'text-red-900',
    orange: 'text-orange-900',
    yellow: 'text-yellow-900'
  }[alertColor];

  const iconColor = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    yellow: 'text-yellow-600'
  }[alertColor];

  const buttonColor = {
    red: 'bg-red-600 hover:bg-red-700',
    orange: 'bg-orange-600 hover:bg-orange-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700'
  }[alertColor];

  return (
    <div className={`rounded-lg border-2 ${bgColor} p-4 mb-6 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start flex-1">
          <AlertTriangle className={`w-6 h-6 ${iconColor} mt-0.5 flex-shrink-0`} />
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-semibold ${textColor}`}>
              Missing Lesson Plans
            </h3>
            <div className="mt-1 text-sm">
              <p className={textColor}>
                You have <strong>{missingCount}</strong> upcoming period{missingCount !== 1 ? 's' : ''} without lesson plans.
              </p>
              
              {/* Criticality breakdown */}
              <div className="flex flex-wrap gap-3 mt-2">
                {byCriticality.critical > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
                    <Clock className="w-3 h-3 mr-1" />
                    {byCriticality.critical} Critical (≤1 day)
                  </span>
                )}
                {byCriticality.high > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800">
                    <Clock className="w-3 h-3 mr-1" />
                    {byCriticality.high} High (2-3 days)
                  </span>
                )}
                {byCriticality.medium > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800">
                    <Clock className="w-3 h-3 mr-1" />
                    {byCriticality.medium} Medium (4-5 days)
                  </span>
                )}
                {byCriticality.low > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                    <Clock className="w-3 h-3 mr-1" />
                    {byCriticality.low} Low (6-7 days)
                  </span>
                )}
              </div>
            </div>

            {/* Expandable details */}
            {isExpanded && (
              <div className="mt-3 space-y-2">
                {missing.slice(0, 10).map((item, index) => {
                  const urgencyColors = {
                    critical: 'border-l-red-500 bg-red-50',
                    high: 'border-l-orange-500 bg-orange-50',
                    medium: 'border-l-yellow-500 bg-yellow-50',
                    low: 'border-l-blue-500 bg-blue-50'
                  };

                  return (
                    <div 
                      key={index}
                      className={`border-l-4 ${urgencyColors[item.urgency]} p-2 rounded text-xs`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3 h-3" />
                          <span className="font-medium">
                            {new Date(item.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short'
                            })} ({item.day})
                          </span>
                          <span className="text-gray-600">•</span>
                          <span>Period {item.period}</span>
                          <span className="text-gray-600">•</span>
                          <span className="font-medium">{item.class}</span>
                          <span className="text-gray-600">•</span>
                          <span>{item.subject}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {item.daysUntil === 0 ? 'Today' : `${item.daysUntil} day${item.daysUntil !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
                
                {missing.length > 10 && (
                  <p className="text-xs text-gray-600 italic">
                    ...and {missing.length - 10} more
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => {
                  if (onPrepareClick) {
                    onPrepareClick();
                  } else {
                    // Default: navigate to lesson planning
                    window.location.hash = '#lesson-planning';
                  }
                }}
                className={`text-xs px-3 py-1.5 ${buttonColor} text-white rounded font-medium transition-colors`}
              >
                Prepare Lesson Plans
              </button>
              
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-xs px-3 py-1.5 ${textColor} hover:bg-white/50 rounded font-medium transition-colors inline-flex items-center`}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show Details
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => setIsDismissed(true)}
          className={`ml-2 ${textColor} hover:bg-white/50 rounded p-1 transition-colors`}
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

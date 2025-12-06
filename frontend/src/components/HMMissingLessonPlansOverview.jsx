import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, Clock, ChevronDown, ChevronUp, User, TrendingDown } from 'lucide-react';
import * as api from '../api';

/**
 * HM Dashboard component for system-wide missing lesson plan alerts
 * Shows all teachers with missing lesson plans, grouped by urgency
 */
export default function HMMissingLessonPlansOverview() {
  const [missingData, setMissingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTeachers, setExpandedTeachers] = useState(new Set());
  const [filterUrgency, setFilterUrgency] = useState('all'); // all, critical, high

  useEffect(() => {
    loadAllMissingLessonPlans();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadAllMissingLessonPlans, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAllMissingLessonPlans = async () => {
    try {
      setLoading(true);
      const result = await api.getAllMissingLessonPlans(7); // 7 days ahead
      
      if (result.success) {
        setMissingData(result);
      }
    } catch (error) {
      console.error('Error loading missing lesson plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTeacher = (teacherEmail) => {
    setExpandedTeachers(prev => {
      const next = new Set(prev);
      if (next.has(teacherEmail)) {
        next.delete(teacherEmail);
      } else {
        next.add(teacherEmail);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading missing lesson plans...</span>
        </div>
      </div>
    );
  }

  if (!missingData || missingData.summary.totalMissing === 0) {
    return (
      <div className="bg-green-50 rounded-xl border-2 border-green-300 p-6">
        <div className="flex items-center">
          <div className="p-3 bg-green-100 rounded-lg">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-green-900">All Lesson Plans Prepared</h3>
            <p className="text-sm text-green-700 mt-1">
              No missing lesson plans for the next 7 days. Excellent work!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { summary, byTeacher } = missingData;

  // Filter teachers based on urgency
  const filteredTeachers = byTeacher.filter(teacher => {
    if (filterUrgency === 'all') return true;
    if (filterUrgency === 'critical') return teacher.byCriticality.critical > 0;
    if (filterUrgency === 'high') return teacher.byCriticality.critical > 0 || teacher.byCriticality.high > 0;
    return true;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`p-3 rounded-lg ${
              summary.criticalMissing > 0 
                ? 'bg-red-100' 
                : summary.highMissing > 0 
                ? 'bg-orange-100' 
                : 'bg-yellow-100'
            }`}>
              <AlertTriangle className={`w-6 h-6 ${
                summary.criticalMissing > 0 
                  ? 'text-red-600' 
                  : summary.highMissing > 0 
                  ? 'text-orange-600' 
                  : 'text-yellow-600'
              }`} />
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-bold text-gray-900">Missing Lesson Plans</h2>
              <p className="text-sm text-gray-600 mt-1">
                {summary.teachersWithMissing} of {summary.totalTeachers} teachers have {summary.totalMissing} missing lesson plans
              </p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex gap-2">
            {summary.criticalMissing > 0 && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-2xl font-bold text-red-900">{summary.criticalMissing}</div>
                <div className="text-xs text-red-700">Critical</div>
              </div>
            )}
            {summary.highMissing > 0 && (
              <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="text-2xl font-bold text-orange-900">{summary.highMissing}</div>
                <div className="text-xs text-orange-700">High Priority</div>
              </div>
            )}
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setFilterUrgency('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterUrgency === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({byTeacher.length})
          </button>
          <button
            onClick={() => setFilterUrgency('critical')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterUrgency === 'critical'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Critical Only ({byTeacher.filter(t => t.byCriticality.critical > 0).length})
          </button>
          <button
            onClick={() => setFilterUrgency('high')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filterUrgency === 'high'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            High Priority ({byTeacher.filter(t => t.byCriticality.critical > 0 || t.byCriticality.high > 0).length})
          </button>
        </div>
      </div>

      {/* Teacher list */}
      <div className="divide-y divide-gray-200">
        {filteredTeachers.map((teacher) => {
          const isExpanded = expandedTeachers.has(teacher.teacherEmail);
          const hasCritical = teacher.byCriticality.critical > 0;
          const hasHigh = teacher.byCriticality.high > 0;

          return (
            <div key={teacher.teacherEmail} className="p-4 hover:bg-gray-50 transition-colors">
              <button
                onClick={() => toggleTeacher(teacher.teacherEmail)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center flex-1">
                  <User className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <h3 className="font-medium text-gray-900">{teacher.teacherName}</h3>
                    <p className="text-xs text-gray-500">{teacher.teacherEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Criticality badges */}
                  <div className="flex gap-2">
                    {teacher.byCriticality.critical > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
                        {teacher.byCriticality.critical} Critical
                      </span>
                    )}
                    {teacher.byCriticality.high > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800">
                        {teacher.byCriticality.high} High
                      </span>
                    )}
                    {teacher.byCriticality.medium > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800">
                        {teacher.byCriticality.medium} Medium
                      </span>
                    )}
                  </div>

                  {/* Total count */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{teacher.missingCount}</div>
                    <div className="text-xs text-gray-500">missing</div>
                  </div>

                  {/* Expand icon */}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-3 ml-8 space-y-2">
                  {teacher.missing.map((item, index) => {
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
                </div>
              )}
            </div>
          );
        })}

        {filteredTeachers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No teachers found with the selected urgency filter.
          </div>
        )}
      </div>
    </div>
  );
}

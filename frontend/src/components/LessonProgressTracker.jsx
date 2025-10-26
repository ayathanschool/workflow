import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, PlayCircle, Calendar, TrendingUp } from 'lucide-react';
import * as api from '../api';

const LessonProgressTracker = ({ user }) => {
  const [progressSummary, setProgressSummary] = useState(null);
  const [delays, setDelays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachersLoaded, setTeachersLoaded] = useState(false);

  const email = user?.email || '';
  
  // Helper function to check if user is HM
  const isHM = () => {
    const userRoles = user?.roles || [];
    return userRoles.some(role => {
      const normalizedRole = role.toLowerCase().replace(/[^a-z]/g, '');
      return normalizedRole === 'hm' || normalizedRole === 'headmaster';
    });
  };

  useEffect(() => {
    if (email) {
      loadProgressData();
      if (isHM()) {
        loadFilterOptions();
      }
    }
  }, [email, selectedClass, selectedSubject, selectedTeacher, selectedStatus]);

  const loadFilterOptions = async () => {
    try {
      const [teachersData, classesData, subjectsData] = await Promise.all([
        api.getAllTeachers().catch(err => {
          console.warn('Failed to load teachers:', err);
          return [];
        }),
        api.getAllClasses().catch(err => {
          console.warn('Failed to load classes:', err);
          return [];
        }),
        api.getAllSubjects().catch(err => {
          console.warn('Failed to load subjects:', err);
          return [];
        })
      ]);
      
      // Ensure we always have arrays
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
      setClasses(Array.isArray(classesData) ? classesData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setTeachersLoaded(true);
      
    } catch (err) {
      console.warn('Error loading filter options:', err);
      // Set empty arrays as fallback
      setTeachers([]);
      setClasses([]);
      setSubjects([]);
      setTeachersLoaded(true);
    }
  };

  const loadProgressData = async () => {
    try {
      setLoading(true);
      setError('');
      
      let summaryData, delaysData;
      
      if (isHM()) {
        // HM can view all teachers' progress with filters
        try {
          [summaryData, delaysData] = await Promise.all([
            api.getAllLessonProgressSummary(selectedTeacher, selectedClass, selectedSubject).catch(err => {
              console.warn('Failed to load HM progress summary:', err);
              return { summary: {}, teacherStats: [], details: [] };
            }),
            api.getAllTeacherLessonDelays(selectedTeacher, selectedClass, selectedSubject).catch(err => {
              console.warn('Failed to load HM delays:', err);
              return { delays: [] };
            })
          ]);
        } catch (err) {
          console.warn('HM API calls failed, falling back to regular teacher view:', err);
          // Fallback to regular teacher API
          [summaryData, delaysData] = await Promise.all([
            api.getLessonProgressSummary(email, selectedClass, selectedSubject).catch(() => ({ summary: {}, details: [] })),
            api.getTeacherLessonDelays(email, selectedClass, selectedSubject).catch(() => ({ delays: [] }))
          ]);
        }
      } else {
        // Regular teacher view
        [summaryData, delaysData] = await Promise.all([
          api.getLessonProgressSummary(email, selectedClass, selectedSubject).catch(err => {
            console.warn('Failed to load progress summary:', err);
            return { summary: {}, details: [] };
          }),
          api.getTeacherLessonDelays(email, selectedClass, selectedSubject).catch(err => {
            console.warn('Failed to load delays:', err);
            return { delays: [] };
          })
        ]);
      }
      
      // Handle API error responses
      if (summaryData?.error) {
        console.warn('API returned error for summary:', summaryData.error);
        summaryData = { summary: {}, details: [] };
      }
      
      if (delaysData?.error) {
        console.warn('API returned error for delays:', delaysData.error);
        delaysData = { delays: [] };
      }
      
      setProgressSummary(summaryData || { summary: {}, details: [] });
      
      // Handle delays data with better error checking
      let processedDelays = [];
      try {
        if (delaysData?.delays && Array.isArray(delaysData.delays)) {
          processedDelays = delaysData.delays.filter(d => d && typeof d === 'object');
        } else if (Array.isArray(delaysData)) {
          processedDelays = delaysData.filter(d => d && typeof d === 'object');
        } else {
          console.warn('Unexpected delays data format:', delaysData);
          processedDelays = [];
        }
      } catch (filterErr) {
        console.warn('Error processing delays data:', filterErr, delaysData);
        processedDelays = [];
      }
      
      setDelays(processedDelays);
      
    } catch (err) {
      console.error('Error loading progress data:', err);
      setError('Failed to load lesson progress data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'InProgress':
        return <PlayCircle className="w-5 h-5 text-blue-600" />;
      case 'Delayed':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'InProgress':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Delayed':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <div className="ml-3 text-gray-600">Loading lesson progress...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Lesson Progress Tracker {isHM() && <span className="text-sm text-gray-500">(HM View)</span>}
        </h2>
        <div className="flex space-x-3">
          {isHM() && (
            <div className="flex flex-col">
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={!teachersLoaded || teachers.length === 0}
              >
                <option value="">
                  {!teachersLoaded 
                    ? "Loading teachers..." 
                    : teachers.length === 0 
                      ? "Teacher filter unavailable"
                      : "All Teachers"
                  }
                </option>
                {(teachers || []).map(teacher => (
                  <option key={teacher?.email || teacher} value={teacher?.email || teacher}>
                    {teacher?.name || teacher?.email || teacher}
                  </option>
                ))}
              </select>
              {teachersLoaded && teachers.length === 0 && (
                <span className="text-xs text-amber-600 mt-1">
                  Backend update required for teacher filtering
                </span>
              )}
            </div>
          )}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Classes</option>
            {isHM() ? (
              (classes || []).map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))
            ) : (
              (user?.classes || []).map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))
            )}
          </select>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Subjects</option>
            {isHM() ? (
              (subjects || []).map(subj => (
                <option key={subj} value={subj}>{subj}</option>
              ))
            ) : (
              (user?.subjects || []).map(subj => (
                <option key={subj} value={subj}>{subj}</option>
              ))
            )}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            <option value="Planned">Planned</option>
            <option value="In Progress">In Progress</option>
            <option value="Delayed">Delayed</option>
            <option value="Completed">Completed</option>
          </select>
          <button
            onClick={loadProgressData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Progress Summary Cards */}
      {progressSummary?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progressSummary.summary.completionRate}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progressSummary.summary.completed}/{progressSummary.summary.total}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Delayed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progressSummary.summary.delayed}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Delay</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progressSummary.summary.avgDelayDays} days
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Statistics (HM View) */}
      {isHM() && progressSummary?.teacherStats && Array.isArray(progressSummary.teacherStats) && progressSummary.teacherStats.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Teacher Performance Overview</h3>
            <p className="text-sm text-gray-600 mt-1">
              Progress summary by teacher
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teacher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Lessons
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completion Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delayed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Delay (Days)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {progressSummary.teacherStats.map((teacher, index) => (
                  <tr key={teacher.teacherEmail} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{teacher.teacherName}</div>
                        <div className="text-sm text-gray-500">{teacher.teacherEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {teacher.total}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${Math.min(100, teacher.completionRate)}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm text-gray-900">{teacher.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="text-green-600 font-medium">{teacher.completed}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`font-medium ${teacher.delayed > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {teacher.delayed}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`${Number(teacher.avgDelayDays) > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {teacher.avgDelayDays}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delayed Lessons Table */}
      {Array.isArray(delays) && delays.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Delayed Lessons</h3>
            <p className="text-sm text-gray-600 mt-1">
              Lessons that are behind schedule and need attention
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isHM() && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class & Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chapter & Session
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Planned Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Delayed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(delays || [])
                  .filter(delay => delay && typeof delay === 'object')
                  .filter(delay => !selectedStatus || delay.status === selectedStatus)
                  .map((delay, index) => (
                  <tr key={delay?.progressId || `delay-${index}`} className="hover:bg-gray-50">
                    {isHM() && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {delay?.teacherName || delay?.teacherEmail || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {delay?.teacherEmail || ''}
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {delay?.class || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {delay?.subject || 'Unknown'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {delay.chapter}
                        </div>
                        <div className="text-sm text-gray-500">
                          Session {delay.session}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(delay.plannedDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {delay.delayDays} days
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(delay.status)}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(delay.status)}`}>
                          {delay.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${delay.completionPercentage}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm text-gray-600">
                          {delay.completionPercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Progress Details */}
      {progressSummary?.details && progressSummary.details.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">All Lesson Progress</h3>
            <p className="text-sm text-gray-600 mt-1">
              Complete overview of all your lesson plan progress
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class & Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chapter & Session
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Planned Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {progressSummary.details.map((progress, index) => (
                  <tr key={progress.progressId || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {progress.class}
                        </div>
                        <div className="text-sm text-gray-500">
                          {progress.subject}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {progress.chapter}
                        </div>
                        <div className="text-sm text-gray-500">
                          Session {progress.session}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(progress.plannedDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(progress.actualDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(progress.status)}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded border ${getStatusColor(progress.status)}`}>
                          {progress.status}
                        </span>
                        {progress.delayDays > 0 && (
                          <span className="ml-2 text-xs text-red-600">
                            (+{progress.delayDays}d)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${progress.completionPercentage}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-sm text-gray-600">
                          {progress.completionPercentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && (!progressSummary?.details || progressSummary.details.length === 0) && (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No lesson progress data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start submitting daily reports with lesson plans to track your progress.
          </p>
        </div>
      )}
    </div>
  );
};

export default LessonProgressTracker;
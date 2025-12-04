import { Bell, Book, BookOpen, Calendar, Users, School, FileText } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { todayIST } from '../utils/dateUtils';

const Dashboard = ({ user, hasRole, hasAnyRole }) => {
  // Insights state holds counts used to populate the summary cards.  When the
  // logged‑in user is the headmaster ("H M" role) we fetch global counts
  // from the API.  For teachers/class teachers we compute counts based on
  // their own classes and subjects and optionally fetch pending report
  // counts from the API.  All fields default to zero to avoid showing mock
  // numbers.
  const [insights, setInsights] = useState({
    planCount: 0,
    lessonCount: 0,
    teacherCount: 0,
    classCount: 0,
    subjectCount: 0,
    pendingReports: 0
  });

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        if (!user) return;
        // Headmaster view: use HM insights and classes count
        if (hasRole('h m')) {
          const hmData = await api.getHmInsights();
          const classes = await api.getAllClasses();
          setInsights(prev => ({
            ...prev,
            planCount: hmData?.planCount || 0,
            lessonCount: hmData?.lessonCount || 0,
            teacherCount: hmData?.teacherCount || 0,
            classCount: Array.isArray(classes) ? classes.length : 0
          }));
        } else if (hasAnyRole(['teacher','class teacher'])) {
          // Teacher view: compute classes and subjects from user object
          const classCount = Array.isArray(user.classes) ? user.classes.length : 0;
          const subjectCount = Array.isArray(user.subjects) ? user.subjects.length : 0;
          // Attempt to fetch daily reports for today to count pending submissions
          let pendingReports = 0;
          try {
            const todayIso = todayIST();
            const reports = await api.getTeacherDailyReportsForDate(user.email, todayIso);
            if (Array.isArray(reports)) {
              // Count reports that are not yet submitted (status != 'Submitted')
              pendingReports = reports.filter(r => String(r.status || '').toLowerCase() !== 'submitted').length;
            }
          } catch (err) {
            // If the endpoint is not implemented or fails, just leave pendingReports as 0
            console.warn('Unable to fetch teacher daily reports:', err);
          }
          setInsights(prev => ({
            ...prev,
            classCount,
            subjectCount,
            pendingReports
          }));
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      }
    }
    fetchDashboardData();
  }, [user, hasRole, hasAnyRole]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <button className="p-2 bg-blue-100 rounded-lg">
            <Bell className="w-5 h-5 text-blue-600" />
          </button>
        </div>
      </div>

      {user && hasRole('h m') ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          {/* Pending Schemes */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 mobile-p-2">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Book className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Schemes</p>
                <p className="text-2xl font-bold text-gray-900">{insights.planCount}</p>
              </div>
            </div>
          </div>
          {/* Pending Lessons */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Lessons</p>
                <p className="text-2xl font-bold text-gray-900">{insights.lessonCount}</p>
              </div>
            </div>
          </div>
          {/* Teachers */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Teachers</p>
                <p className="text-2xl font-bold text-gray-900">{insights.teacherCount}</p>
              </div>
            </div>
          </div>
          {/* Classes */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Classes</p>
                <p className="text-2xl font-bold text-gray-900">{insights.classCount}</p>
              </div>
            </div>
          </div>
        </div>
      ) : user && hasAnyRole(['teacher','class teacher']) ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Classes Teaching */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <School className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Classes Teaching</p>
                <p className="text-2xl font-bold text-gray-900">{insights.classCount}</p>
              </div>
            </div>
          </div>
          {/* Subjects */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Book className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Subjects</p>
                <p className="text-2xl font-bold text-gray-900">{insights.subjectCount}</p>
              </div>
            </div>
          </div>
          {/* Pending Reports */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Reports</p>
                <p className="text-2xl font-bold text-gray-900">{insights.pendingReports}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome, {user?.name}</h2>
          <p className="text-gray-600">Use the navigation menu to access your school workflow tools.</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(Dashboard);
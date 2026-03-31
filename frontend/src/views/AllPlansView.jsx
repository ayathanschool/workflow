import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { Search } from 'lucide-react';

const AllPlansView = ({ user }) => {
  const [plans, setPlans] = useState([]);
  const [filters, setFilters] = useState({ teacher: '', class: '', subject: '', status: '' });
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Fetch all plans when component mounts or user changes
  useEffect(() => {
    if (!user) return;
    loadPlans();
  }, [user]);

  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      const data = await api.getAllPlans(filters.teacher, filters.class, filters.subject, filters.status);
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading all plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handlePlanFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };
  // Safe no-op handler for report filter fields to satisfy lint; routes to plan filters
  const handleReportFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">All Plans</h1>
        <div className="flex space-x-3">
          <button
            onClick={loadPlans}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
          >
            <Search className="h-4 w-4 mr-2" />
            Apply Filters
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {/* Filter form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teacher (email or name)</label>
            <input
              type="text"
              value={filters.teacher}
              onChange={(e) => handleReportFilterChange('teacher', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Search teacher"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <input
              type="text"
              value={filters.class}
              onChange={(e) => handleReportFilterChange('class', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g. 10A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={filters.subject}
              onChange={(e) => handleReportFilterChange('subject', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="e.g. Mathematics"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleReportFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Ready">Ready</option>
              <option value="Needs Rework">Needs Rework</option>
            </select>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Plan Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teacher</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chapter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term/Unit/Month</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {plans.map((p, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.teacherName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.class}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.chapter}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {p.term || p.unit || p.month || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {p.noOfSessions || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {p.session || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.status}</td>
                </tr>
              ))}
              {plans.length === 0 && !loadingPlans && (
                <tr>
                  <td colSpan={9} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    No plans found.
                  </td>
                </tr>
              )}
              {loadingPlans && (
                <tr>
                  <td colSpan={9} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    Loading plans...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllPlansView;

import React, { useState, useEffect } from 'react';
import { Calendar, Users, CheckCircle, XCircle, RefreshCw, Send } from 'lucide-react';
import { callAPI } from '../api';
import LoadingSpinner from './LoadingSpinner';

const ITLabManagement = ({ user }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [freeTeachers, setFreeTeachers] = useState({});
  const [editingDraft, setEditingDraft] = useState(null);

  // Load drafts on mount and date change
  useEffect(() => {
    loadDrafts();
  }, [selectedDate]);

  const loadDrafts = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await callAPI('getITLabDrafts', { date: selectedDate });
      // Ensure result is always an array
      if (Array.isArray(result)) {
        setDrafts(result);
      } else if (result && result.error) {
        setMessage({ type: 'error', text: result.error });
        setDrafts([]);
      } else {
        setDrafts([]);
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to load drafts: ${error.message}` });
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  const generateDrafts = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const result = await callAPI('generateITLabDrafts', { date: selectedDate });
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: result.message || `Generated ${result.generated} drafts` 
        });
        loadDrafts();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to generate drafts' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setGenerating(false);
    }
  };

  const submitDrafts = async () => {
    if (!window.confirm(`Submit ${drafts.length} IT Lab substitutions for ${selectedDate}?`)) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const result = await callAPI('submitITLabDrafts', { 
        date: selectedDate,
        userName: user?.name || 'HM'
      });
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: result.message || `Submitted ${result.count} substitutions` 
        });
        loadDrafts(); // Refresh to show submitted status
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to submit' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  const loadFreeTeachers = async (period) => {
    try {
      const result = await callAPI('getFreeTeachers', { 
        date: selectedDate, 
        period: period 
      });
      setFreeTeachers(prev => ({ ...prev, [period]: result || [] }));
    } catch (error) {
      console.error('Failed to load free teachers:', error);
    }
  };

  const updateDraft = async (draftId, newTeacher) => {
    setMessage(null);
    try {
      const result = await callAPI('updateITLabDraft', { 
        draftId: draftId.toString(),
        newTeacher: newTeacher 
      });
      if (result.success) {
        setMessage({ type: 'success', text: 'Teacher updated successfully' });
        loadDrafts();
        setEditingDraft(null);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    }
  };

  const startEditingDraft = (draft) => {
    setEditingDraft(draft.id);
    if (!freeTeachers[draft.period]) {
      loadFreeTeachers(draft.period);
    }
  };

  // Only HM role can access - using same role checking logic as App.jsx
  const _normRole = (r) => (r || '').toString().toLowerCase().trim();
  const hasRole = (token) => {
    if (!user || !Array.isArray(user.roles)) return false;
    const t = (token || '').toString().toLowerCase();
    return user.roles.some(r => {
      const rr = _normRole(r);
      if (rr === t) return true;
      if (rr.includes(t)) return true;
      if (t.replace(/\s+/g,'') === rr.replace(/\s+/g,'')) return true;
      return false;
    });
  };
  
  if (!hasRole('h m')) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            Only HM role can manage IT Lab substitutions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            IT Lab Substitution Management
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Review and approve automatically generated IT Lab substitutions
          </p>
        </div>

        {/* Controls */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={generateDrafts}
              disabled={generating || loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 
                       disabled:bg-gray-400 text-white rounded-md transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating...' : 'Generate Drafts'}
            </button>

            {/* Submit Button */}
            {drafts.length > 0 && (
              <button
                onClick={submitDrafts}
                disabled={submitting || loading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 
                         disabled:bg-gray-400 text-white rounded-md transition-colors ml-auto"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : `Submit ${drafts.length} Substitutions`}
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={loadDrafts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 
                       hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 
                       rounded-md transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`mt-4 p-3 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <span>{message.text}</span>
              </div>
            </div>
          )}
        </div>

        {/* Drafts Table */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No IT Lab Drafts
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Click "Generate Drafts" to create IT Lab substitutions for {selectedDate}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      IT Teacher
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Suggested Teacher
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {drafts.map((draft) => (
                    <tr key={draft.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {draft.period}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {draft.class}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {draft.subject}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {draft.absentTeacher}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingDraft === draft.id ? (
                          <select
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 
                                     rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            defaultValue={draft.suggestedTeacher}
                            onChange={(e) => updateDraft(draft.id, e.target.value)}
                          >
                            <option value={draft.suggestedTeacher}>{draft.suggestedTeacher}</option>
                            {freeTeachers[draft.period]?.map((teacher) => (
                              teacher.name !== draft.suggestedTeacher && (
                                <option key={teacher.name} value={teacher.name}>
                                  {teacher.name}
                                </option>
                              )
                            ))}
                          </select>
                        ) : (
                          <span className={`font-medium ${
                            draft.suggestedTeacher === 'NO FREE TEACHER' 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {draft.suggestedTeacher}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {draft.notes}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {editingDraft === draft.id ? (
                          <button
                            onClick={() => setEditingDraft(null)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 
                                     dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditingDraft(draft)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 
                                     dark:hover:text-blue-300 font-medium"
                          >
                            Change Teacher
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          How it works:
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>Click "Generate Drafts" to automatically create IT Lab substitutions</li>
          <li>Review suggested teachers for each period</li>
          <li>Click "Change Teacher" if you want to assign a different teacher</li>
          <li>Click "Submit" to approve and create actual substitutions</li>
          <li>Only pending drafts will be submitted</li>
        </ul>
      </div>
    </div>
  );
};

export default ITLabManagement;

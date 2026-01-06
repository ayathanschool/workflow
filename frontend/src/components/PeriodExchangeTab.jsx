import React, { useState, useEffect } from 'react';
import { RefreshCw, Repeat, Trash2, Plus } from 'lucide-react';
import * as api from '../api';

export default function PeriodExchangeTab({ selectedDate, currentUser, onRefresh }) {
  const [exchanges, setExchanges] = useState([]);
  const [timetableData, setTimetableData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [exchangeForm, setExchangeForm] = useState({
    teacher1Email: '',
    teacher1Name: '',
    period1: '',
    class1: '',
    subject1: '',
    teacher2Email: '',
    teacher2Name: '',
    period2: '',
    class2: '',
    subject2: '',
    note: ''
  });
  const [teacher1Periods, setTeacher1Periods] = useState([]);
  const [teacher2Periods, setTeacher2Periods] = useState([]);

  // Load data
  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const [exchangesResult, fullTimetableResult] = await Promise.all([
        api.getPeriodExchangesForDate(selectedDate),
        api.getFullTimetable()
      ]);

      // Normalize API shapes defensively
      const normalizedExchanges = Array.isArray(exchangesResult?.exchanges)
        ? exchangesResult.exchanges
        : (Array.isArray(exchangesResult) ? exchangesResult : []);

      setExchanges(normalizedExchanges);
      setTimetableData(Array.isArray(fullTimetableResult) ? fullTimetableResult : []);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
      setExchanges([]);
      setTimetableData([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique teachers from timetable
  const getTeachersFromTimetable = () => {
    if (!timetableData || !Array.isArray(timetableData)) return [];
    
    // Get day name for selected date
    const dayName = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
    
    const teacherMap = {};
    timetableData.forEach(entry => {
      // Filter by day of week to match selected date
      if (entry.dayOfWeek && entry.dayOfWeek.toLowerCase() === dayName.toLowerCase()) {
        if (entry.teacherEmail) {
          teacherMap[entry.teacherEmail] = entry.teacher || entry.teacherName || entry.teacherEmail;
        }
      }
    });
    
    return Object.entries(teacherMap)
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Get periods for selected teacher
  const getPeriodsForTeacher = (teacherEmail) => {
    if (!timetableData || !Array.isArray(timetableData) || !teacherEmail) return [];
    
    // Get day name for selected date
    const dayName = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });
    
    return timetableData
      .filter(entry => 
        entry.teacherEmail === teacherEmail &&
        entry.dayOfWeek && 
        entry.dayOfWeek.toLowerCase() === dayName.toLowerCase()
      )
      .map(entry => ({
        period: entry.period,
        class: entry.class,
        subject: entry.subject
      }))
      .sort((a, b) => parseInt(a.period) - parseInt(b.period));
  };

  // Handle teacher 1 selection
  const handleTeacher1Change = (email) => {
    const teacher = getTeachersFromTimetable().find(t => t.email === email);
    const periods = getPeriodsForTeacher(email);
    
    setExchangeForm(prev => ({
      ...prev,
      teacher1Email: email,
      teacher1Name: teacher?.name || email,
      period1: '',
      class1: '',
      subject1: ''
    }));
    setTeacher1Periods(periods);
  };

  // Handle teacher 2 selection
  const handleTeacher2Change = (email) => {
    const teacher = getTeachersFromTimetable().find(t => t.email === email);
    const periods = getPeriodsForTeacher(email);
    
    setExchangeForm(prev => ({
      ...prev,
      teacher2Email: email,
      teacher2Name: teacher?.name || email,
      period2: '',
      class2: '',
      subject2: ''
    }));
    setTeacher2Periods(periods);
  };

  // Handle period 1 selection
  const handlePeriod1Change = (periodStr) => {
    const selected = teacher1Periods.find(p => 
      `${p.period}-${p.class}` === periodStr
    );
    
    if (selected) {
      setExchangeForm(prev => ({
        ...prev,
        period1: selected.period,
        class1: selected.class,
        subject1: selected.subject
      }));
    }
  };

  // Handle period 2 selection
  const handlePeriod2Change = (periodStr) => {
    const selected = teacher2Periods.find(p => 
      `${p.period}-${p.class}` === periodStr
    );
    
    if (selected) {
      setExchangeForm(prev => ({
        ...prev,
        period2: selected.period,
        class2: selected.class,
        subject2: selected.subject
      }));
    }
  };

  // Create exchange
  const handleCreateExchange = async () => {
    if (!exchangeForm.teacher1Email || !exchangeForm.teacher2Email || 
        !exchangeForm.period1 || !exchangeForm.period2) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await api.createPeriodExchange({
        date: selectedDate,
        ...exchangeForm,
        createdBy: currentUser?.email || 'unknown'
      });
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Period exchange created successfully!');
        setShowModal(false);
        setExchangeForm({
          teacher1Email: '',
          teacher1Name: '',
          period1: '',
          class1: '',
          subject1: '',
          teacher2Email: '',
          teacher2Name: '',
          period2: '',
          class2: '',
          subject2: '',
          note: ''
        });
        
        setTimeout(() => setSuccess(''), 3000);
        loadData();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      setError('Error creating exchange: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete exchange
  const handleDeleteExchange = async (exchange) => {
    if (!confirm(`Delete exchange between ${exchange.teacher1Name} and ${exchange.teacher2Name}?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.deletePeriodExchange({
        date: selectedDate,
        teacher1Email: exchange.teacher1Email,
        teacher2Email: exchange.teacher2Email,
        period1: exchange.period1,
        period2: exchange.period2
      });
      
      setSuccess('Exchange deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      loadData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setError('Error deleting exchange: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exchangesList = Array.isArray(exchanges) ? exchanges : [];
  const teacher1PeriodsList = Array.isArray(teacher1Periods) ? teacher1Periods : [];
  const teacher2PeriodsList = Array.isArray(teacher2Periods) ? teacher2Periods : [];
  const teachers = getTeachersFromTimetable();

  return (
    <div className="space-y-4">
      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Period Exchanges for {selectedDate}</h3>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Create Exchange
          </button>
        </div>
      </div>

      {/* Existing Exchanges */}
      {loading && exchangesList.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Loading exchanges...</div>
      ) : exchangesList.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border rounded bg-gray-50">
          <Repeat className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No period exchanges for this date</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exchangesList.map((ex, idx) => (
            <div key={idx} className="border rounded-lg p-4 bg-purple-50 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Teacher 1 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-purple-700">{ex.teacher1Name}</span>
                      <span className="text-xs text-gray-500">→ teaches Period {ex.period2}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Original: Period {ex.period1} • {ex.class1} • {ex.subject1}
                    </div>
                  </div>
                  
                  {/* Swap Icon */}
                  <div className="hidden md:flex items-center justify-center col-span-full md:col-span-1">
                    <Repeat className="w-6 h-6 text-purple-500" />
                  </div>
                  
                  {/* Teacher 2 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-purple-700">{ex.teacher2Name}</span>
                      <span className="text-xs text-gray-500">→ teaches Period {ex.period1}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Original: Period {ex.period2} • {ex.class2} • {ex.subject2}
                    </div>
                  </div>
                </div>
                
                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteExchange(ex)}
                  disabled={loading}
                  className="ml-4 text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 disabled:opacity-50"
                  title="Delete exchange"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {ex.note && (
                <div className="mt-3 pt-3 border-t border-purple-200 text-sm text-gray-600">
                  <span className="font-medium">Note:</span> {ex.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Exchange Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create Period Exchange</h3>
            
            <div className="space-y-4">
              {/* Teacher 1 Section */}
              <div className="border-b pb-4">
                <h4 className="font-semibold mb-3 text-purple-700">Teacher 1</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Select Teacher</label>
                    <select
                      value={exchangeForm.teacher1Email}
                      onChange={(e) => handleTeacher1Change(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">-- Select Teacher 1 --</option>
                      {teachers.map(t => (
                        <option key={t.email} value={t.email}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  
                      {teacher1PeriodsList.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Select Period to Exchange</label>
                      <select
                        value={exchangeForm.period1 ? `${exchangeForm.period1}-${exchangeForm.class1}` : ''}
                        onChange={(e) => handlePeriod1Change(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="">-- Select Period --</option>
                            {teacher1PeriodsList.map((p, idx) => (
                          <option key={idx} value={`${p.period}-${p.class}`}>
                            Period {p.period} • {p.class} • {p.subject}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Teacher 2 Section */}
              <div className="border-b pb-4">
                <h4 className="font-semibold mb-3 text-purple-700">Teacher 2</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Select Teacher</label>
                    <select
                      value={exchangeForm.teacher2Email}
                      onChange={(e) => handleTeacher2Change(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">-- Select Teacher 2 --</option>
                      {teachers.filter(t => t.email !== exchangeForm.teacher1Email).map(t => (
                        <option key={t.email} value={t.email}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {teacher2PeriodsList.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Select Period to Exchange</label>
                      <select
                        value={exchangeForm.period2 ? `${exchangeForm.period2}-${exchangeForm.class2}` : ''}
                        onChange={(e) => handlePeriod2Change(e.target.value)}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="">-- Select Period --</option>
                        {teacher2PeriodsList.map((p, idx) => (
                          <option key={idx} value={`${p.period}-${p.class}`}>
                            Period {p.period} • {p.class} • {p.subject}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium mb-1">Note (Optional)</label>
                <textarea
                  value={exchangeForm.note}
                  onChange={(e) => setExchangeForm(prev => ({ ...prev, note: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  rows={2}
                  placeholder="Reason for exchange (e.g., completing syllabus, teacher request)"
                />
              </div>

              {/* Summary */}
              {exchangeForm.period1 && exchangeForm.period2 && (
                <div className="bg-purple-100 border border-purple-300 rounded p-4 space-y-2">
                  <p className="font-semibold text-purple-900">Exchange Summary:</p>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-medium">{exchangeForm.teacher1Name}</span> will teach{' '}
                      <span className="font-medium">Period {exchangeForm.period2}</span> in{' '}
                      <span className="font-medium">{exchangeForm.class2}</span> ({exchangeForm.subject2})
                    </p>
                    <p>
                      <span className="font-medium">{exchangeForm.teacher2Name}</span> will teach{' '}
                      <span className="font-medium">Period {exchangeForm.period1}</span> in{' '}
                      <span className="font-medium">{exchangeForm.class1}</span> ({exchangeForm.subject1})
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateExchange}
                disabled={loading || !exchangeForm.period1 || !exchangeForm.period2}
                className="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Exchange'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="px-6 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// src/components/SubstitutionModule.jsx
import { Plus, Calendar, User, RefreshCw, Monitor, Share2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useTheme } from '../contexts/ThemeContext';

export default function SubstitutionModule() {
  const { theme } = useTheme();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [absentTeacher, setAbsentTeacher] = useState(''); // identifier: email or name
  const [absentTeachers, setAbsentTeachers] = useState([]); // array of { name, email }
  const [timetable, setTimetable] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [freeTeachers, setFreeTeachers] = useState({});
  const [loadingFreeTeachers, setLoadingFreeTeachers] = useState(false);
  // Track selected substitute per period-class row: { '<period>-<class>': identifierOrObject }
  const [selectedSubstitutes, setSelectedSubstitutes] = useState({});
  // Track which rows are currently being assigned: { '<period>-<class>': boolean }
  const [assigningRows, setAssigningRows] = useState({});
  const [assignError, setAssignError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // IT Lab support states
  const [itLabAssigning, setItLabAssigning] = useState({});
  const [selectedItLabSupport, setSelectedItLabSupport] = useState({});
  
  // Helper: check if a period is an IT Lab period
  function isItLabPeriod(subject) {
    if (!subject) return false;
    const subjectLower = subject.toLowerCase();
    return subjectLower.includes('computer') || 
           subjectLower.includes('it ') || 
           subjectLower.includes('information technology') ||
           subjectLower.includes('programming') ||
           subjectLower.includes('coding');
  }

  // Helper: refresh assigned substitutions for a date with robust fallbacks
  async function refreshAssigned(targetDate) {
    // 1) Direct endpoint
    try {
      const direct = await api.getAssignedSubstitutions(targetDate, { noCache: true });
      const assigned = (direct && Array.isArray(direct.assignedSubstitutions)) ? direct.assignedSubstitutions : [];
      if (assigned.length > 0) {
        setSubstitutions(assigned);
        return;
      }
    } catch (e1) {
      // continue to next fallback
      console.warn('getAssignedSubstitutions failed:', e1?.message || e1);
    }
    // 2) Vacant endpoint (compatibility)
    try {
      const allSubs = await api.getVacantSlotsForAbsent(targetDate, [], { noCache: true });
      const fromVacant = (allSubs && Array.isArray(allSubs.assignedSubstitutions)) ? allSubs.assignedSubstitutions : [];
      if (fromVacant.length > 0) {
        setSubstitutions(fromVacant);
        return;
      }
    } catch (e2) {
      console.warn('getVacantSlotsForAbsent failed:', e2?.message || e2);
    }
    // 3) Merged timetable fallback (derive substitutions)
    try {
      const merged = await api.getDailyTimetableWithSubstitutions(targetDate, { noCache: true });
      const list = (merged && Array.isArray(merged.timetable)) ? merged.timetable : [];
      const normalized = list
        .filter(item => item && item.isSubstitution)
        .map(item => ({
          date: targetDate,
          period: Number(item.period || 0),
          class: String(item.class || ''),
          absentTeacher: '',
          regularSubject: String(item.subject || ''),
          substituteTeacher: String(item.teacher || ''),
          substituteSubject: String(item.subject || ''),
          note: ''
        }));
      setSubstitutions(normalized);
    } catch (e3) {
      console.warn('getDailyTimetableWithSubstitutions failed:', e3?.message || e3);
      setSubstitutions([]);
    }
  }

  // Manual refresh handler
  async function handleRefresh() {
    if (!date) return;
    try {
      setRefreshing(true);
  await refreshAssigned(date);
    } finally {
      setRefreshing(false);
    }
  }
  
  // Generate WhatsApp message with today's substitutions
  function shareToWhatsApp() {
    if (substitutions.length === 0) {
      alert('No substitutions to share for this date');
      return;
    }
    
    // Format substitutions into a readable message
    const formattedDate = new Date(date).toLocaleDateString('en-IN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let message = `📋 *Substitution Schedule*\n📅 ${formattedDate}\n\n`;
    
    // Group by period
    const byPeriod = {};
    substitutions.forEach(sub => {
      if (!byPeriod[sub.period]) {
        byPeriod[sub.period] = [];
      }
      byPeriod[sub.period].push(sub);
    });
    
    // Sort periods
    const sortedPeriods = Object.keys(byPeriod).sort((a, b) => Number(a) - Number(b));
    
    sortedPeriods.forEach(period => {
      message += `⏰ *Period ${period}*\n`;
      byPeriod[period].forEach(sub => {
        message += `• ${sub.class} - ${sub.substituteSubject || sub.regularSubject}\n`;
        message += `  👤 ${sub.substituteTeacher}\n`;
        if (sub.note) {
          message += `  📝 ${sub.note}\n`;
        }
      });
      message += `\n`;
    });
    
    message += `_Total Substitutions: ${substitutions.length}_\n`;
    message += `\n✅ *Please check your schedule and arrive 5 minutes early*`;
    
    // Encode message for WhatsApp
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');
  }
  
  // Fetch substitutions for the date when component loads (even without absent teacher selected)
  useEffect(() => {
    if (!date) return;
    const timeoutId = setTimeout(() => refreshAssigned(date), 200);
    return () => clearTimeout(timeoutId);
  }, [date]);

  // Fetch list of potential absent teachers
  useEffect(() => {
    async function fetchAbsentTeachers() {
      try {
        const teachers = await api.getPotentialAbsentTeachers();
        // backend returns array of { name, email }
        setAbsentTeachers(Array.isArray(teachers) ? teachers : []);
      } catch (err) {
        console.error('Error fetching teachers:', err);
      }
    }
    fetchAbsentTeachers();
  }, []);

  // Fetch timetable when date changes (show full daily timetable)
  useEffect(() => {
    let mounted = true;
    async function fetchTimetable() {
      if (!date) return;
      setLoading(true);
      setLoadingFreeTeachers(true); // Set loading state immediately
      console.log('🔄 Starting to load timetable and free teachers for date:', date);
      try {
        // Fetch the full daily timetable for the selected date
        const dailyTimetable = await api.getDailyTimetableForDate(date);

        // dailyTimetable expected to be an array of slots: { period, class, subject, teacher, ... }
        const filteredTimetable = Array.isArray(dailyTimetable) ? dailyTimetable.slice() : [];

        // Sort by period and class for better organization
        filteredTimetable.sort((a, b) => {
          const periodDiff = (parseInt(a.period) || 0) - (parseInt(b.period) || 0);
          if (periodDiff !== 0) return periodDiff;
          return (a.class || '').localeCompare(b.class || '');
        });

        if (mounted) {
          setTimetable(filteredTimetable);
          console.log('✅ Timetable loaded, still loading free teachers...');
        }

        // Refresh substitutions for the date
        if (mounted) await refreshAssigned(date);

        // Fetch free teachers for each period
        console.log('🔍 Fetching free teachers for', filteredTimetable.length, 'slots');
        const teachersMap = {};
        const uniquePeriods = [...new Set(filteredTimetable.map(slot => slot.period))];
        
        // Process periods in smaller batches to avoid overwhelming the server
        const batchSize = 3;
        for (let i = 0; i < uniquePeriods.length; i += batchSize) {
          const batch = uniquePeriods.slice(i, i + batchSize);
          await Promise.all(batch.map(async (period) => {
            try {
              // Get free teachers for this period (no exclusions since we're not tied to specific absent teacher)
              const free = await api.getFreeTeachers(date, period, []);
              teachersMap[period] = Array.isArray(free) ? free : [];
            } catch (err) {
              console.error(`Error fetching free teachers for period ${period}:`, err);
              teachersMap[period] = [];
            }
          }));
          
          // Small delay between batches to be gentle on the server
          if (i + batchSize < uniquePeriods.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        if (mounted) {
          setFreeTeachers(teachersMap);
          setLoadingFreeTeachers(false);
          console.log('✅ Free teachers loaded for', Object.keys(teachersMap).length, 'periods');
        }
      } catch (err) {
        console.error('Error fetching timetable or substitutes:', err);
        if (mounted) {
          setTimetable([]);
          setSubstitutions([]);
          setFreeTeachers({});
          setLoadingFreeTeachers(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchTimetable();
    return () => { mounted = false };
  }, [date]); // Remove absentTeacher dependency
  
  // Handle substitute teacher assignment
  async function handleSubstituteAssign(period, classname, subject, substituteTeacher, originalTeacher) {
    if (!substituteTeacher || !period || !classname) {
      setAssignError('Please select a substitute teacher');
      setTimeout(() => setAssignError(null), 3000);
      return false;
    }
    
    const rowKey = `${period}-${classname}`;
    setAssignError(null);
    setSuccessMessage(null);
    setAssigningRows(prev => ({ ...prev, [rowKey]: true }));
    
    try {
      // substituteTeacher may be an object { name, email } or a string
      const substituteIdentifier = typeof substituteTeacher === 'object' ? (substituteTeacher.email || substituteTeacher.name) : substituteTeacher;
      const substituteDisplayName = typeof substituteTeacher === 'object' ? (substituteTeacher.name || substituteTeacher.email) : substituteTeacher;
      
      console.log('Assigning substitution:', { date, period, class: classname, substitute: substituteIdentifier });
      
      const result = await api.assignSubstitution({
        date,
        absentTeacher: originalTeacher || absentTeacher || 'Unknown', // Use original teacher if available
        period,
        class: classname,
        regularSubject: subject,
        substituteTeacher: substituteIdentifier,
        substituteSubject: subject // Default to same subject
      });
      
      console.log('Assignment result:', result);

      // Immediately show the assignment in UI (optimistic update)
      const newSub = {
        period: Number(period),
        class: classname,
        absentTeacher: originalTeacher || absentTeacher || 'Unknown',
        regularSubject: subject,
        substituteTeacher: substituteIdentifier,
        substituteSubject: subject,
        date: date
      };
      
      setSubstitutions(prev => {
        // Remove any existing assignment for this period/class
        const filtered = prev.filter(s => !(Number(s.period) === Number(period) && String(s.class) === String(classname)));
        return [...filtered, newSub];
      });

      // Also refresh from server to ensure list matches persisted data
      try { await refreshAssigned(date); } catch {}

      // Clear the selected substitute for this row since it's now assigned
      setSelectedSubstitutes(prev => { 
        const updated = { ...prev }; 
        delete updated[rowKey]; 
        return updated; 
      });

      // Show success message briefly
      setSuccessMessage(`✓ Assigned ${substituteDisplayName} to period ${period}, ${classname}`);
      setAssignError(null);
      
      // Clear success message after 2 seconds (shorter to avoid confusion)
      setTimeout(() => setSuccessMessage(null), 2000);
      
      return true;
    } catch (err) {
      console.error('Error assigning substitution:', err);
      const errorMsg = err?.message || String(err);
      setAssignError(`Failed to assign substitution: ${errorMsg}`);
      setSuccessMessage(null);
      return false;
    } finally {
      setAssigningRows(prev => ({ ...prev, [rowKey]: false }));
    }
  }
  
  // Handle IT Lab support assignment
  async function handleItLabSupportAssign(period, classname, supportTeacher) {
    if (!supportTeacher || !period || !classname) return false;
    
    const rowKey = `${period}-${classname}`;
    setAssignError(null);
    setSuccessMessage(null);
    setItLabAssigning(prev => ({ ...prev, [rowKey]: true }));
    
    try {
      // supportTeacher may be an object { name, email } or a string
      const supportIdentifier = typeof supportTeacher === 'object' ? (supportTeacher.email || supportTeacher.name) : supportTeacher;
      const supportDisplayName = typeof supportTeacher === 'object' ? (supportTeacher.name || supportTeacher.email) : supportTeacher;
      
      console.log('Assigning IT Lab support:', { date, period, class: classname, support: supportIdentifier });
      
      // Use regular substitution assignment but with special note for IT Lab support
      await api.assignSubstitution({
        date,
        absentTeacher: 'IT Lab Support', // Special designation
        period,
        class: classname,
        regularSubject: 'IT Lab Support',
        substituteTeacher: supportIdentifier,
        substituteSubject: 'IT Lab Support',
        note: `IT Lab Support for ${classname} period ${period}`
      });

      // Immediately show the assignment in UI (optimistic update)
      const newSub = {
        period: Number(period),
        class: classname,
        absentTeacher: 'IT Lab Support',
        regularSubject: 'IT Lab Support',
        substituteTeacher: supportIdentifier,
        substituteSubject: 'IT Lab Support',
        date: date,
        note: `IT Lab Support for ${classname} period ${period}`
      };
      
      setSubstitutions(prev => {
        // Remove any existing IT Lab support assignment for this period/class
        const filtered = prev.filter(s => !(Number(s.period) === Number(period) && String(s.class) === String(classname) && s.absentTeacher === 'IT Lab Support'));
        return [...filtered, newSub];
      });

      // Also refresh from server to ensure list matches persisted data
      try { await refreshAssigned(date); } catch {}

      // Clear the selected IT Lab support for this row since it's now assigned
      setSelectedItLabSupport(prev => { 
        const updated = { ...prev }; 
        delete updated[rowKey]; 
        return updated; 
      });

      // Show success message briefly
      setSuccessMessage(`✓ Assigned ${supportDisplayName} as IT Lab support for period ${period}, ${classname}`);
      setAssignError(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
      
      return true;
    } catch (err) {
      console.error('Error assigning IT Lab support:', err);
      const errorMsg = err?.message || String(err);
      setAssignError(`Failed to assign IT Lab support: ${errorMsg}`);
      setSuccessMessage(null);
      return false;
    } finally {
      setItLabAssigning(prev => ({ ...prev, [rowKey]: false }));
    }
  }
  
  // Check if a period already has a substitution assigned
  function getAssignedSubstitute(period, classname) {
    const substitution = substitutions.find(sub => 
      Number(sub.period) === Number(period) && 
      String(sub.class) === String(classname) &&
      sub.absentTeacher !== 'IT Lab Support' // Exclude IT Lab support entries
    );
    return substitution ? (substitution.substituteTeacher || substitution.teacher) : null;
  }
  
  // Check if a period already has IT Lab support assigned
  function getAssignedItLabSupport(period, classname) {
    const substitution = substitutions.find(sub => 
      Number(sub.period) === Number(period) && 
      String(sub.class) === String(classname) &&
      sub.absentTeacher === 'IT Lab Support'
    );
    return substitution ? (substitution.substituteTeacher || substitution.teacher) : null;
  }
  
  // Show appropriate status message for a period
  function getStatusForPeriod(period) {
    if (loading) return null;
    
    const availableTeachers = freeTeachers[period] || [];
    if (availableTeachers.length === 0) {
      return (
        <div className="text-red-600 text-sm">
          No available teachers
        </div>
      );
    }
    return null;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} transition-colors duration-300`}>Substitutions</h1>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button 
            onClick={shareToWhatsApp}
            className="bg-green-600 dark:bg-green-700 text-white rounded-lg px-4 py-2 flex items-center hover:bg-green-700 dark:hover:bg-green-800 transition-colors duration-300 btn-animate shadow-lg font-semibold"
            title="Share substitutions via WhatsApp"
            disabled={substitutions.length === 0}
            style={{ minWidth: '160px' }}
          >
            <Share2 className="h-5 w-5 mr-2" />
            Share WhatsApp
          </button>
          <button 
            onClick={handleRefresh}
            className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 flex items-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-300 btn-animate"
            title="Refresh substitutions list"
            disabled={refreshing}
          >
            {refreshing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </button>
          <button 
            className="bg-blue-600 dark:bg-blue-700 text-white rounded-lg px-4 py-2 flex items-center hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors duration-300 btn-animate"
          >
            <Plus className="h-5 w-5 mr-2" /> 
            Assign Substitution
          </button>
        </div>
      </div>
      
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <span className="text-green-600 mr-2">✓</span>
            {successMessage}
          </div>
        </div>
      )}
      
      {assignError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">✗</span>
            {assignError}
          </div>
        </div>
      )}
      
      {/* Selection controls */}
      <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 md:p-6 rounded-lg shadow-sm transition-colors duration-300`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div>
            <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-1 transition-colors duration-300`}>
              <Calendar className="inline h-4 w-4 mr-1 -mt-1" /> Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full px-3 py-2 border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded focus:ring-2 focus:ring-blue-500 transition-colors duration-300`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-1 transition-colors duration-300`}>
              <User className="inline h-4 w-4 mr-1 -mt-1" /> Filter by Teacher (Optional)
            </label>
            <select
              value={absentTeacher}
              onChange={(e) => {
                const val = e.target.value;
                const found = absentTeachers.find(t => (t.email === val || t.name === val));
                // prefer email identifier when available
                setAbsentTeacher(found ? (found.email || found.name) : val);
              }}
              className={`w-full px-3 py-2 border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} rounded focus:ring-2 focus:ring-blue-500 transition-colors duration-300`}
            >
              <option value="">All Teachers</option>
              {absentTeachers.map((teacher, idx) => (
                <option
                  key={`${(teacher && (teacher.email || teacher.name)) || String(teacher) || 'teacher'}-${idx}`}
                  value={(teacher && (teacher.email || teacher.name)) || String(teacher)}
                >
                  { (teacher && (teacher.name || teacher.email)) || String(teacher) }
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Existing Substitutions for the Day */}
      {substitutions.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4 text-green-700 border-b pb-2">
            Substitutions Assigned for {date}
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Substitute Teacher</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {substitutions.map((sub, index) => (
                  <tr key={`existing-${sub.period}-${sub.class}-${sub.substituteTeacher || sub.teacher || index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sub.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.class}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.absentTeacher}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.regularSubject || sub.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="text-green-600 font-medium flex items-center">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        {sub.substituteTeacher || sub.teacher}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Daily timetable */}
      {timetable.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-blue-400 border-gray-700' : 'text-blue-700 border-gray-200'} border-b pb-2 transition-colors duration-300`}>
            Daily Timetable {absentTeacher ? `for ${(absentTeachers.find(t => (t.email === absentTeacher || t.name === absentTeacher))?.name || absentTeacher)}` : `for ${new Date(date).toLocaleDateString()}`}
          </h2>
          
          {loading && (
            <div className="flex justify-center p-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          {!loading && timetable.length > 0 && (
            <table className={`min-w-full border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} shadow-sm rounded-lg overflow-hidden responsive-table transition-colors duration-300`}>
              <thead className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} transition-colors duration-300`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Period</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Class</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Subject</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Teacher</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Substitute Teacher</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>IT Lab Support</th>
                  <th className={`px-6 py-3 text-left text-xs font-semibold ${theme === 'dark' ? 'text-gray-300 border-gray-600' : 'text-gray-700 border-gray-200'} uppercase tracking-wider border-b transition-colors duration-300`}>Status</th>
                </tr>
              </thead>
              <tbody className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'} transition-colors duration-300`}>
                {timetable.map((slot, index) => {
                  const assignedTeacher = getAssignedSubstitute(slot.period, slot.class);
                  const assignedItLabSupport = getAssignedItLabSupport(slot.period, slot.class);
                  const availableTeachers = freeTeachers[slot.period] || [];
                  const rowKey = `${slot.period}-${slot.class}`;
                  const isAssigning = assigningRows[rowKey] || false;
                  const isItLab = isItLabPeriod(slot.subject);
                  const isItLabAssigning = itLabAssigning[rowKey] || false;
                  
                  // Debug log for first row only
                  if (index === 0) {
                    console.log('🎯 First row render:', {
                      loadingFreeTeachers,
                      availableTeachersCount: availableTeachers.length,
                      freeTeachersKeys: Object.keys(freeTeachers),
                      period: slot.period
                    });
                  }
                  
                  return (
                    <tr key={rowKey} className={`${theme === 'dark' ? 
                      (index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750') :
                      (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')} transition-colors duration-300 ${isItLab ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''}`}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'} border-b transition-colors duration-300`}>
                        <div className="flex items-center">
                          {isItLab && <Monitor className="h-4 w-4 text-blue-500 mr-2" />}
                          {slot.period}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'} border-b transition-colors duration-300`}>{slot.class}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'} border-b transition-colors duration-300`}>
                        <div className="flex items-center">
                          {slot.subject}
                          {isItLab && <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full">IT Lab</span>}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'} border-b transition-colors duration-300`}>
                        {slot.teacher || 'Not assigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm border-b">
                        {assignedTeacher ? (
                          <div className="text-green-600 font-medium flex items-center">
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            {assignedTeacher}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <div className="flex-1">
                              {loadingFreeTeachers ? (
                                <div className="flex items-center text-gray-500 text-sm">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                  Loading teachers...
                                </div>
                              ) : (
                                <>
                                  <select
                                    className={`w-full border rounded px-2 py-1 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} transition-colors duration-300`}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const found = availableTeachers.find(t => (t.email === val || t.name === val));
                                      setSelectedSubstitutes(prev => ({ ...prev, [rowKey]: found || val }));
                                    }}
                                    value={selectedSubstitutes[rowKey] ? (selectedSubstitutes[rowKey].email || selectedSubstitutes[rowKey].name || selectedSubstitutes[rowKey]) : ''}
                                    disabled={loading || isAssigning || availableTeachers.length === 0}
                                  >
                                    <option value="">Select teacher</option>
                                    {availableTeachers.map((teacher, idx) => (
                                      <option
                                        key={`${(teacher && (teacher.email || teacher.name)) || String(teacher) || 'free'}-${idx}`}
                                        value={(teacher && (teacher.email || teacher.name)) || String(teacher)}
                                      >
                                        {(teacher && (teacher.name || teacher.email)) || String(teacher)}
                                      </option>
                                    ))}
                                  </select>
                                  {availableTeachers.length > 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      Note: Absent teachers may also appear if needed
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                            <div>
                              <button
                                className="ml-2 bg-green-600 dark:bg-green-700 text-white rounded px-3 py-1 text-sm flex items-center hover:bg-green-700 dark:hover:bg-green-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors duration-300 btn-animate"
                                onClick={async () => {
                                  const sel = selectedSubstitutes[rowKey];
                                  await handleSubstituteAssign(slot.period, slot.class, slot.subject, sel, slot.teacher);
                                  // Note: handleSubstituteAssign now clears the selection automatically
                                }}
                                disabled={loading || isAssigning || !selectedSubstitutes[rowKey] || loadingFreeTeachers}
                              >
                                {isAssigning ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : null}
                                Assign
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm border-b">
                        {isItLab ? (
                          assignedItLabSupport ? (
                            <div className="text-blue-600 font-medium flex items-center">
                              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                              <Monitor className="h-4 w-4 mr-1" />
                              {assignedItLabSupport}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <div className="flex-1">
                                {loadingFreeTeachers ? (
                                  <div className="flex items-center text-gray-500 text-sm">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                    Loading teachers...
                                  </div>
                                ) : (
                                  <>
                                    <select
                                      className={`w-full border rounded px-2 py-1 ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} transition-colors duration-300`}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const found = availableTeachers.find(t => (t.email === val || t.name === val));
                                        setSelectedItLabSupport(prev => ({ ...prev, [rowKey]: found || val }));
                                      }}
                                      value={selectedItLabSupport[rowKey] ? (selectedItLabSupport[rowKey].email || selectedItLabSupport[rowKey].name || selectedItLabSupport[rowKey]) : ''}
                                      disabled={loading || isItLabAssigning || availableTeachers.length === 0}
                                    >
                                      <option value="">Select IT support</option>
                                      {availableTeachers.map((teacher, idx) => (
                                        <option
                                          key={`itlab-${(teacher && (teacher.email || teacher.name)) || String(teacher) || 'free'}-${idx}`}
                                          value={(teacher && (teacher.email || teacher.name)) || String(teacher)}
                                        >
                                          {(teacher && (teacher.name || teacher.email)) || String(teacher)}
                                        </option>
                                      ))}
                                    </select>
                                    {availableTeachers.length > 0 && (
                                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                                        Note: Absent teachers may also appear if needed
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                              <div>
                                <button
                                  className="ml-2 bg-blue-600 dark:bg-blue-700 text-white rounded px-3 py-1 text-sm flex items-center hover:bg-blue-700 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors duration-300 btn-animate"
                                  onClick={async () => {
                                    const sel = selectedItLabSupport[rowKey];
                                    await handleItLabSupportAssign(slot.period, slot.class, sel);
                                  }}
                                  disabled={loading || isItLabAssigning || !selectedItLabSupport[rowKey] || loadingFreeTeachers}
                                >
                                  {isItLabAssigning ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : null}
                                  <Monitor className="h-4 w-4 mr-1" />
                                  Support
                                </button>
                              </div>
                            </div>
                          )
                        ) : (
                          <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} transition-colors duration-300`}>
                            Not an IT Lab period
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm border-b">
                        {assignedTeacher ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Assigned
                          </span>
                        ) : (
                          getStatusForPeriod(slot.period)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          {!loading && timetable.length === 0 && (
            <div className={`text-center py-10 rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} transition-colors duration-300`}>
              <div className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} transition-colors duration-300`}>
                <p className="text-xl font-medium mb-2">No timetable entries found</p>
                <p className="mb-4">There are no classes scheduled for {absentTeacher} on {new Date(date).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Substitutions list */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'} transition-colors duration-300`}>
            Substitutions for {new Date(date).toLocaleDateString()}
          </h2>
          <button 
            onClick={handleRefresh}
            className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-3 py-1.5 flex items-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-300"
            disabled={refreshing}
          >
            {refreshing ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </button>
        </div>
        
        {substitutions.length > 0 ? (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regular Teacher</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Substitute</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {substitutions.map((sub, index) => (
                <tr key={`${sub.period}-${sub.class}-${sub.substituteTeacher || sub.teacher || index}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.period}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.class}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sub.absentTeacher || (absentTeachers.find(t => (t.email === absentTeacher || t.name === absentTeacher))?.name) || absentTeacher}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.regularSubject || sub.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-medium">{sub.substituteTeacher || sub.teacher}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-6 text-gray-500">
            No substitutions assigned for this date.
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { RefreshCw, Plus } from 'lucide-react';
import { todayIST } from '../utils/dateUtils';

const SubstitutionsView = ({ withSubmit, stripStdPrefix }) => {
  const [substitutions, setSubstitutions] = useState([]);
  const [dailyTimetable, setDailyTimetable] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Enhanced form state for better UX
  const [selectedTeacherTimetable, setSelectedTeacherTimetable] = useState([]);
  const [availableSubstitutes, setAvailableSubstitutes] = useState([]);
  const [loadingTeacherTimetable, setLoadingTeacherTimetable] = useState(false);
  
  // Subject dropdown state for substitute teacher
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [customSubject, setCustomSubject] = useState('');
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  
  // Data fetched from the API; initially empty
  const [absentTeachers, setAbsentTeachers] = useState([]);
  const [freeTeachers, setFreeTeachers] = useState([]);
  const [vacantSlots, setVacantSlots] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [allClasses, setAllClasses] = useState([]);

  // Filters for timetable view
  const [filters, setFilters] = useState({
    teacher: '',
    class: '',
    date: todayIST()
  });

  const [formData, setFormData] = useState({
    date: todayIST(),
    absentTeacher: '',
    period: '',
    class: '',
    regularSubject: '',
    substituteTeacher: '',
    substituteSubject: ''
  });

  // Helper function to refresh substitutions
  const refreshSubstitutions = async (targetDate = null) => {
    const dateToUse = targetDate || formData.date;
    setRefreshing(true);
    try {
      // Try multiple endpoints for robustness
      let subs = [];
      
      // Method 1: Direct substitutions endpoint
      try {
        // console.log('🔍 Fetching substitutions for date:', dateToUse);
        const direct = await api.getAssignedSubstitutions(dateToUse, { noCache: true });
        // console.log('🔍 API Response:', direct);
        
        if (direct && Array.isArray(direct.assignedSubstitutions)) {
          subs = direct.assignedSubstitutions;
          // console.log('✅ Found', subs.length, 'substitutions:', subs);
        } else {
          // console.log('⚠️ No assignedSubstitutions array in response');
        }
      } catch (e1) {
        console.warn('getAssignedSubstitutions failed:', e1?.message || e1);
      }
      
      // Method 2: Fallback to merged timetable if no direct results
      if (subs.length === 0) {
        try {
          // console.log('🔄 Trying fallback method...');
          const merged = await api.getDailyTimetableWithSubstitutions(dateToUse, { noCache: true });
          // console.log('🔍 Merged timetable response:', merged);
          
          if (merged && Array.isArray(merged.timetable)) {
            subs = merged.timetable.filter(item => item && item.isSubstitution);
            // console.log('✅ Found', subs.length, 'substitutions from timetable');
          }
        } catch (e2) {
          console.warn('getDailyTimetableWithSubstitutions failed:', e2?.message || e2);
        }
      }
      
      // console.log('🎯 Final substitutions to display:', subs);
      setSubstitutions(subs);
      return subs;
    } catch (err) {
      console.error('Error refreshing substitutions:', err);
      return [];
    } finally {
      setRefreshing(false);
    }
  };

  // Load daily timetable with substitutions for the filtered date
  const loadDailyTimetable = async () => {
    setLoading(true);
    try {
      // Get full timetable with filters
      const timetableData = await api.getFullTimetableFiltered(
        filters.class, 
        '', 
        filters.teacher, 
        filters.date
      );
      
      if (Array.isArray(timetableData)) {
        setDailyTimetable(timetableData);
      } else {
        // Fallback to daily timetable with substitutions
        const merged = await api.getDailyTimetableWithSubstitutions(filters.date);
        if (merged && Array.isArray(merged.timetable)) {
          let filtered = merged.timetable;
          
          // Apply client-side filters if needed
          if (filters.teacher) {
            filtered = filtered.filter(item => 
              (item.teacher || '').toLowerCase().includes(filters.teacher.toLowerCase()) ||
              (item.substituteTeacher || '').toLowerCase().includes(filters.teacher.toLowerCase())
            );
          }
          
          if (filters.class) {
            filtered = filtered.filter(item => 
              (item.class || '').toLowerCase().includes(filters.class.toLowerCase())
            );
          }
          
          setDailyTimetable(filtered);
        } else {
          setDailyTimetable([]);
        }
      }
    } catch (err) {
      console.error('Error loading daily timetable:', err);
      setDailyTimetable([]);
    } finally {
      setLoading(false);
    }
  };

  // Load teacher's timetable when teacher is selected in form
  const loadTeacherTimetable = async (teacherEmail, date) => {
    if (!teacherEmail || !date) {
      setSelectedTeacherTimetable([]);
      return;
    }
    
    setLoadingTeacherTimetable(true);
    try {
      // console.log('🔍 Loading teacher timetable for:', teacherEmail, 'on date:', date);
      const timetable = await api.getTeacherDailyTimetable(teacherEmail, date);
      // console.log('🔍 Teacher timetable response:', timetable);
      
      if (timetable && Array.isArray(timetable.periods)) {
        // console.log('✅ Found', timetable.periods.length, 'periods for teacher');
        setSelectedTeacherTimetable(timetable.periods);
      } else {
        // console.log('⚠️ No periods found in response structure');
        setSelectedTeacherTimetable([]);
      }
    } catch (err) {
      console.error('❌ Error loading teacher timetable:', err);
      setSelectedTeacherTimetable([]);
    } finally {
      setLoadingTeacherTimetable(false);
    }
  };

  // Load available substitutes for a specific period
  const loadAvailableSubstitutes = async (date, period) => {
    if (!date || !period) {
      setAvailableSubstitutes([]);
      return;
    }
    
    try {
      const free = await api.getFreeTeachers(date, period, [formData.absentTeacher]);
      setAvailableSubstitutes(Array.isArray(free) ? free : []);
    } catch (err) {
      console.error('Error loading available substitutes:', err);
      setAvailableSubstitutes([]);
    }
  };

  // Initial data load when component mounts
  useEffect(() => {
    async function initializeData() {
      try {
        // Load basic data
        const [absents, teachers, classes] = await Promise.all([
          api.getPotentialAbsentTeachers().catch(() => []),
          api.getPotentialAbsentTeachers().catch(() => []), // Reuse for all teachers
          api.getAllClasses().catch(() => [])
        ]);
        
        setAbsentTeachers(Array.isArray(absents) ? absents : []);
        setAllTeachers(Array.isArray(teachers) ? teachers : []);
        setAllClasses(Array.isArray(classes) ? classes : []);
        
        // Load substitutions immediately
        await refreshSubstitutions();
        
        // Load daily timetable
        await loadDailyTimetable();
        
      } catch (err) {
        console.error('Error initializing substitution data:', err);
      }
    }
    
    initializeData();
  }, []); // Only run on mount

  // Fetch data when form date changes
  useEffect(() => {
    async function fetchSubstitutionData() {
      try {
        // Build identifier list (prefer email when available)
        const absentIds = absentTeachers.map(a => (a && (a.email || a.name)) || '').filter(Boolean);
        
        // Vacant slots for the current date and absent teachers
        const vacantRes = await api.getVacantSlotsForAbsent(formData.date, absentIds);
        const vacSlots = vacantRes && Array.isArray(vacantRes.vacantSlots) ? vacantRes.vacantSlots : [];
        setVacantSlots(vacSlots);
        
        // Free teachers for the selected date/period and current absent list
        const free = await api.getFreeTeachers(formData.date, formData.period || '', absentIds);
        setFreeTeachers(Array.isArray(free) ? free : []);
        
        // Refresh substitutions for the new date
        await refreshSubstitutions(formData.date);
        
      } catch (err) {
        console.error('Error fetching substitution data:', err);
      }
    }
    
    if (absentTeachers.length > 0) {
      fetchSubstitutionData();
    }
  }, [formData.date, formData.period, absentTeachers]);

  // Load timetable when filters change
  useEffect(() => {
    loadDailyTimetable();
  }, [filters.date, filters.teacher, filters.class]);

  // Load teacher timetable when absent teacher is selected
  useEffect(() => {
    if (formData.absentTeacher && formData.date) {
      loadTeacherTimetable(formData.absentTeacher, formData.date);
    }
  }, [formData.absentTeacher, formData.date]);

  // Load available substitutes when period is selected
  useEffect(() => {
    if (formData.date && formData.period && formData.absentTeacher) {
      loadAvailableSubstitutes(formData.date, formData.period);
    }
  }, [formData.date, formData.period, formData.absentTeacher]);

  // Fetch subjects that the substitute teacher teaches in the selected class
  useEffect(() => {
    const fetchSubjects = async () => {
      if (formData.substituteTeacher && formData.class) {
        setLoadingSubjects(true);
        try {
          console.log('🔍 Fetching subjects for:', {
            teacher: formData.substituteTeacher,
            class: formData.class
          });
          
          const response = await api.getTeacherSubjectsForClass(
            formData.substituteTeacher, 
            formData.class,
            { noCache: true }
          );
          
          console.log('📚 Subjects response:', response);
          
          if (response && response.success && Array.isArray(response.subjects)) {
            setAvailableSubjects(response.subjects);
            
            // Auto-select subject intelligently
            if (!formData.substituteSubject) {
              // Priority 1: Use regularSubject if it's in the list
              if (formData.regularSubject && response.subjects.includes(formData.regularSubject)) {
                setFormData(prev => ({ ...prev, substituteSubject: formData.regularSubject }));
                console.log('✅ Auto-selected regular subject:', formData.regularSubject);
              } else {
                // Priority 2: Use first non-Other subject
                const firstNonOther = response.subjects.find(s => s !== 'Other');
                if (firstNonOther) {
                  setFormData(prev => ({ ...prev, substituteSubject: firstNonOther }));
                  console.log('✅ Auto-selected first subject:', firstNonOther);
                } else {
                  // Priority 3: Only "Other" available, select it
                  setFormData(prev => ({ ...prev, substituteSubject: 'Other' }));
                  console.log('✅ Auto-selected Other (no subjects in timetable)');
                }
              }
            }
          } else {
            console.warn('⚠️ No subjects found, using Other only');
            setAvailableSubjects(['Other']);
            setFormData(prev => ({ ...prev, substituteSubject: 'Other' }));
          }
        } catch (err) {
          console.error('❌ Error fetching teacher subjects:', err);
          setAvailableSubjects(['Other']);
          setFormData(prev => ({ ...prev, substituteSubject: 'Other' }));
        } finally {
          setLoadingSubjects(false);
        }
      } else {
        setAvailableSubjects([]);
        setCustomSubject('');
      }
    };
    
    fetchSubjects();
  }, [formData.substituteTeacher, formData.class]);

  const handleSubmitSubstitution = async (e) => {
    e.preventDefault();
    try {
      // If "Other" is selected, use the custom subject value
      const finalFormData = {
        ...formData,
        substituteSubject: formData.substituteSubject === 'Other' && customSubject 
          ? customSubject 
          : formData.substituteSubject
      };
      
      // Persist the substitution using the global submit helper for
      // consistent UX.
      await withSubmit('Assigning substitution...', () => api.assignSubstitution(finalFormData));
      
      // Immediately refresh the substitution list for the selected date
      await refreshSubstitutions(formData.date);
      
      // Also reload the daily timetable to show updates
      await loadDailyTimetable();
      
      // Close the form and reset inputs
      setShowForm(false);
      setFormData({
        date: todayIST(),
        absentTeacher: '',
        period: '',
        class: '',
        regularSubject: '',
        substituteTeacher: '',
        substituteSubject: ''
      });
      setAvailableSubjects([]);
      setCustomSubject('');
    } catch (err) {
      console.error('Failed to assign substitution:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Substitutions Management</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshSubstitutions()}
            className="bg-gray-100 text-gray-900 rounded-lg px-3 py-2 flex items-center hover:bg-gray-200 transition-colors duration-300"
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
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Assign Substitution
          </button>
        </div>
      </div>

      {/* Filters for Timetable View */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Daily Timetable with Substitutions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({...filters, date: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Teacher</label>
            <select
              value={filters.teacher}
              onChange={(e) => setFilters({...filters, teacher: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Teachers</option>
              {allTeachers.map((teacher, idx) => (
                <option key={`teacher-${idx}`} value={teacher.name}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Class</label>
            <select
              value={filters.class}
              onChange={(e) => setFilters({...filters, class: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Classes</option>
              {allClasses.map((cls, idx) => (
                <option key={`class-${idx}`} value={cls}>
                  {stripStdPrefix(cls)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Daily Timetable Display */}
        {loading ? (
          <div className="flex justify-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regular Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Substitute Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dailyTimetable.map((slot, index) => (
                  <tr key={`timetable-${slot.period}-${slot.class}-${index}`} 
                      className={slot.isSubstitution ? 'bg-yellow-50' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{slot.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stripStdPrefix(slot.class)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{slot.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {slot.isSubstitution ? (
                        <span className="text-red-600 line-through">{slot.originalTeacher || slot.absentTeacher}</span>
                      ) : (
                        slot.teacher
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {slot.isSubstitution ? (
                        <span className="text-green-600 font-medium">{slot.substituteTeacher || slot.teacher}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {slot.isSubstitution ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Substitution
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Regular
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {dailyTimetable.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No timetable data found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Current Substitutions Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">
            Active Substitutions for {new Date(formData.date).toLocaleDateString()}
          </h2>
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
            {substitutions.length} substitution{substitutions.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {substitutions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regular Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Substitute Teacher</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {substitutions.map((sub, index) => (
                  <tr key={`sub-${sub.period}-${sub.class}-${sub.substituteTeacher || sub.teacher || index}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.class}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="text-red-600">{sub.absentTeacher || sub.originalTeacher}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sub.regularSubject || sub.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="text-green-600 font-medium">{sub.substituteTeacher || sub.teacher}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            No substitutions assigned for this date.
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Assign Substitution</h2>
          <form onSubmit={handleSubmitSubstitution} className="space-y-6">
            {/* Basic Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Absent Teacher</label>
                <select
                  value={formData.absentTeacher}
                  onChange={(e) => setFormData({...formData, absentTeacher: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select Teacher</option>
                  {absentTeachers.map(teacher => (
                    <option key={(teacher.email||teacher.name)} value={(teacher.name)}>{teacher.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Teacher Timetable */}
            {formData.absentTeacher && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-md font-medium text-gray-900 mb-3">
                  {formData.absentTeacher.split('@')[0]}'s Timetable for {formData.date}
                </h3>
                {loadingTeacherTimetable ? (
                  <div className="flex justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : selectedTeacherTimetable.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    {selectedTeacherTimetable.map((period, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded border cursor-pointer transition-colors ${
                          formData.period === String(period.period) 
                            ? 'bg-blue-100 border-blue-300' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => setFormData({
                          ...formData, 
                          period: String(period.period),
                          class: period.class || '',
                          regularSubject: period.subject || ''
                        })}
                      >
                        <div className="text-sm font-medium">Period {period.period}</div>
                        <div className="text-xs text-gray-600">{period.class}</div>
                        <div className="text-xs text-gray-600">{period.subject}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No timetable available for this teacher</p>
                )}
              </div>
            )}

            {/* Period Selection and Subject Details */}
            {formData.absentTeacher && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                  <select
                    value={formData.period}
                    onChange={(e) => setFormData({...formData, period: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select Period</option>
                    <option value="1">Period 1</option>
                    <option value="2">Period 2</option>
                    <option value="3">Period 3</option>
                    <option value="4">Period 4</option>
                    <option value="5">Period 5</option>
                    <option value="6">Period 6</option>
                    <option value="7">Period 7</option>
                    <option value="8">Period 8</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select
                    value={formData.class}
                    onChange={(e) => setFormData({...formData, class: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select Class</option>
                    {allClasses.map((cls, idx) => (
                      <option key={`form-class-${idx}`} value={cls}>{stripStdPrefix(cls)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Regular Subject</label>
                  <input
                    type="text"
                    value={formData.regularSubject}
                    onChange={(e) => setFormData({...formData, regularSubject: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>
            )}

            {/* Available Substitutes */}
            {formData.period && formData.absentTeacher && (
              <div className="border rounded-lg p-4 bg-green-50">
                <h3 className="text-md font-medium text-gray-900 mb-3">
                  Available Teachers for Period {formData.period}
                </h3>
                {availableSubstitutes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {availableSubstitutes.map((teacher, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded border cursor-pointer transition-colors ${
                          formData.substituteTeacher === (teacher.email || teacher.name) 
                            ? 'bg-green-200 border-green-400' 
                            : 'bg-white border-gray-200 hover:bg-green-100'
                        }`}
                        onClick={() => {
                          // Set teacher and clear subject - let useEffect fetch and set subjects
                          setFormData({
                            ...formData, 
                            substituteTeacher: teacher.email || teacher.name,
                            substituteSubject: '' // Clear subject, will be auto-filled after fetch
                          });
                          setCustomSubject(''); // Clear custom subject
                        }}
                      >
                        <div className="text-sm font-medium">{teacher.name}</div>
                        <div className="text-xs text-gray-600">
                          {teacher.email ? teacher.email : 'Available'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No teachers available for this period</p>
                )}
              </div>
            )}

            {/* Substitute Details */}
            {formData.substituteTeacher && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Substitute Teacher</label>
                  <input
                    type="text"
                    value={formData.substituteTeacher}
                    onChange={(e) => setFormData({...formData, substituteTeacher: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    readOnly
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Substitute Subject
                    {loadingSubjects && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                  </label>
                  {availableSubjects.length > 0 ? (
                    <>
                      {availableSubjects.length > 1 && availableSubjects[0] !== 'Other' && (
                        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                          <span className="font-medium text-blue-900">📚 Subjects this teacher teaches in {formData.class}:</span>
                          <span className="text-blue-700 ml-1">
                            {availableSubjects.filter(s => s !== 'Other').join(', ')}
                          </span>
                        </div>
                      )}
                      <select
                        value={formData.substituteSubject}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData({...formData, substituteSubject: value});
                          if (value !== 'Other') {
                            setCustomSubject(''); // Clear custom input if not "Other"
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                        disabled={loadingSubjects}
                      >
                        <option value="">Select Subject</option>
                        {availableSubjects.map((subject, idx) => (
                          <option key={`subject-${idx}`} value={subject}>
                            {subject === 'Other' ? '➕ Other (Custom Subject)' : subject}
                          </option>
                        ))}
                      </select>
                      {availableSubjects.length === 1 && availableSubjects[0] === 'Other' && (
                        <p className="text-xs text-amber-600 mt-1">
                          💡 This teacher doesn't teach any subjects in this class. Enter a custom subject below.
                        </p>
                      )}
                      {formData.substituteSubject === 'Other' && (
                        <input
                          type="text"
                          value={customSubject}
                          onChange={(e) => setCustomSubject(e.target.value)}
                          placeholder="Enter custom subject (e.g., Activity, Library)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      )}
                    </>
                  ) : (
                    <input
                      type="text"
                      value={formData.substituteSubject}
                      onChange={(e) => setFormData({...formData, substituteSubject: e.target.value})}
                      placeholder="Enter subject"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  )}
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    date: todayIST(),
                    absentTeacher: '',
                    period: '',
                    class: '',
                    regularSubject: '',
                    substituteTeacher: '',
                    substituteSubject: ''
                  });
                  setSelectedTeacherTimetable([]);
                  setAvailableSubstitutes([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={!formData.absentTeacher || !formData.period || !formData.substituteTeacher}
              >
                Assign Substitution
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};


export default SubstitutionsView;

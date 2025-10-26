import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import addHours from 'date-fns/addHours';
import isSameDay from 'date-fns/isSameDay';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import * as api from '../../api';
import { Plus, X, Save, Trash2, Edit } from 'lucide-react';

// Import calendar utilities and components
import { 
  filterEvents, 
  formatDate, 
  downloadCalendarAsICS 
} from '../../utils/calendar/helpers';
import { CustomEvent, EventModal } from '../../utils/calendar/components';
import { CalendarReminder, CalendarFilter } from '../../utils/calendar/features';
import '../../utils/calendar/styles.css';

// Setup localizer for react-big-calendar
const locales = {
  'en-US': enUS
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const CalendarView = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [calendarView, setCalendarView] = useState('week'); // 'week', 'month', 'day'
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [newEvent, setNewEvent] = useState({
    title: '',
    class: '',
    subject: '',
    notes: '',
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // Helper to check for HM role
  const isHM = Array.isArray(user?.roles)
    ? user.roles.some(r => (r || '').toString().toLowerCase().replace(/\s+/g,'') === 'hm')
    : false;

  useEffect(() => {
    if (!user) return;
    loadCalendarEvents();
  }, [user]);
  
  // Extract available classes and subjects when events change
  useEffect(() => {
    // Extract classes and subjects from events
    const classSet = new Set();
    const subjectSet = new Set();
    
    // Add user's classes and subjects if available
    if (user?.classes && Array.isArray(user.classes)) {
      user.classes.forEach(cls => classSet.add(cls));
    }
    
    if (user?.subjects && Array.isArray(user.subjects)) {
      user.subjects.forEach(subj => subjectSet.add(subj));
    }
    
    // Add classes and subjects from events
    events.forEach(event => {
      if (event.resource?.class) {
        classSet.add(event.resource.class);
      }
      if (event.resource?.subject) {
        subjectSet.add(event.resource.subject);
      }
    });
    
    // Convert sets to sorted arrays
    const classesArr = Array.from(classSet).sort();
    const subjectsArr = Array.from(subjectSet).sort();
    setAvailableClasses(classesArr);
    setAvailableSubjects(subjectsArr);

    // If HM and we still have no classes/subjects from user/events, fetch full lists
    async function maybeLoadGlobals() {
      try {
        if (!isHM) return;
        const needClasses = classesArr.length === 0;
        const needSubjects = subjectsArr.length === 0;
        if (!needClasses && !needSubjects) return;
        const [allClasses, allSubjects] = await Promise.all([
          needClasses ? api.getAllClasses().catch(() => []) : Promise.resolve([]),
          needSubjects ? api.getAllSubjects().catch(() => []) : Promise.resolve([])
        ]);
        if (needClasses && Array.isArray(allClasses) && allClasses.length) {
          setAvailableClasses(allClasses);
        }
        if (needSubjects && Array.isArray(allSubjects) && allSubjects.length) {
          setAvailableSubjects(allSubjects);
        }
      } catch (e) {
        // ignore
      }
    }
    maybeLoadGlobals();
  }, [events, user]);

  const loadCalendarEvents = async () => {
    if (!user?.email) return;
    
    setIsLoading(true);
    setLoadError('');
    
    try {
      // Use the enhanced API endpoint to get calendar events
      const calendarData = await api.getCalendarEvents(user.email);
      
      // Handle error responses from the API
      if (calendarData && calendarData.error) {
        console.error('Calendar API error:', calendarData.error);
        setLoadError(`Failed to load calendar: ${calendarData.error}`);
        // Keep existing events but mark them as potentially stale
        setIsLoading(false);
        return;
      }
      
      if (!calendarData || !Array.isArray(calendarData)) {
        console.error('Invalid calendar data format:', calendarData);
        setLoadError('Failed to load calendar: Invalid data format');
        // Set empty events array and return to prevent further processing
        setEvents(prev => prev.filter(e => e.isPersonalEvent));
        setIsLoading(false);
        return;
      }
      
      // Transform API calendar events into calendar component events
      const calendarEvents = calendarData.map(item => {
        // Parse dates from the API response
        const parseEventDate = (dateStr, periodNum = 1) => {
          if (!dateStr) return new Date();
          
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              console.warn('Invalid date string:', dateStr);
              return { start: new Date(), end: new Date() };
            }
            
            // Default period hours (1-based): period 1 = 8:00 AM, period 2 = 9:00 AM, etc.
            const startHour = 7 + Number(periodNum || 1);
            const endHour = startHour + 1;
            
            const start = new Date(date);
            start.setHours(startHour, 0, 0);
            
            const end = new Date(date);
            end.setHours(endHour, 0, 0);
            
            return { start, end };
          } catch (e) {
            console.warn('Error parsing date:', e);
            return { start: new Date(), end: new Date() };
          }
        };
        
        const { start, end } = parseEventDate(item.date, item.period);
        
        // Determine color based on event type and status
        let color = '#3174ad'; // Default blue
        
        if (item.type === 'substitution') {
          color = '#f87171'; // Red for substitutions
        } else if (item.lessonPlan) {
          // Color based on lesson plan status
          if (item.status === 'Ready') {
            color = '#4ade80'; // Green for approved lesson plans
          } else if (item.status === 'Pending Review') {
            color = '#facc15'; // Yellow for pending review
          } else {
            color = '#93c5fd'; // Blue for other lesson plan statuses
          }
        }
        
        return {
          id: item.id || `${item.date}-${item.period}-${item.class}-${item.subject}`,
          title: item.title || `${item.class || ''} - ${item.subject || ''}`,
          start,
          end,
          type: item.type || 'timetable',
          resource: {
            class: item.class || '',
            subject: item.subject || '',
            period: item.period
          },
          color,
          lessonPlan: item.lessonPlan,
          lpId: item.lpId,
          status: item.status,
          objectives: item.objectives,
          activities: item.activities,
          notes: item.notes
        };
      });
      
      // Filter out any invalid events (those with invalid dates)
      const validCalendarEvents = calendarEvents.filter(e => 
        e.start && e.end && 
        !isNaN(e.start.getTime()) && 
        !isNaN(e.end.getTime())
      );
      
      if (validCalendarEvents.length < calendarEvents.length) {
        console.warn(`Filtered out ${calendarEvents.length - validCalendarEvents.length} events with invalid dates`);
      }
      
      // Load existing personal events too
      const personalEvents = events.filter(e => e.isPersonalEvent);
      
      setEvents([...validCalendarEvents, ...personalEvents]);
      setIsLoading(false);
      
      // Debug log - check what data we received
      console.log('Calendar data loaded:', {
        user,
        timetableEvents: validCalendarEvents.filter(e => e.type === 'timetable').length,
        personalEvents: personalEvents.length,
        userClasses: user?.classes,
        userSubjects: user?.subjects
      });
      
    } catch (error) {
      console.error('Failed to load calendar events:', error);
      setLoadError('Failed to load calendar events. Please try again later.');
      
      // Keep any personal events if there are any
      setEvents(prev => prev.filter(e => e.isPersonalEvent));
      setIsLoading(false);
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
  };
  
  const handleSlotSelect = useCallback((slotInfo) => {
    setSelectedSlot(slotInfo);
    
    // Default values with fallbacks
    const defaultClass = user?.classTeacherFor || availableClasses[0] || '';
    const defaultSubject = user?.subjects?.[0] || availableSubjects[0] || '';
    
    setNewEvent({
      title: '',
      class: defaultClass,
      subject: defaultSubject,
      notes: '',
    });
    setIsEditMode(false);
    setShowCreateModal(true);
  }, [user, availableClasses, availableSubjects]);
  
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedSlot(null);
    setNewEvent({
      title: '',
      class: '',
      subject: '',
      notes: '',
    });
  };
  
  const handleEditEvent = (event) => {
    setSelectedEvent(null);
    setShowEventModal(false);
    
    // Only allow editing personal events (not timetable/lesson plan events)
    if (event.isPersonalEvent) {
      setSelectedSlot({
        start: event.start,
        end: event.end
      });
      setNewEvent({
        id: event.id,
        title: event.title,
        class: event.resource?.class || '',
        subject: event.resource?.subject || '',
        notes: event.notes || '',
      });
      setIsEditMode(true);
      setShowCreateModal(true);
    }
  };
  
  const handleSaveEvent = async () => {
    if (!selectedSlot) return;
    
    try {
      // Format dates for API
      const startTime = selectedSlot.start.toISOString();
      const endTime = selectedSlot.end.toISOString();
      const eventId = isEditMode ? newEvent.id : null;
      
      // Prepare data for API
      const eventData = {
        eventId,
        userEmail: user.email,
        title: newEvent.title || 'Untitled Event',
        startTime,
        endTime,
        class: newEvent.class || '',
        subject: newEvent.subject || '',
        notes: newEvent.notes || '',
        type: 'personal',
        color: '#8b5cf6', // Purple for personal events
        allDay: false // Could add UI control for all-day events later
      };
      
      // Save to backend
      const result = await api.saveCalendarEvent(eventData);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Create event object for local state
      const eventToSave = {
        id: result.eventId,
        title: newEvent.title || 'Untitled Event',
        start: selectedSlot.start,
        end: selectedSlot.end,
        resource: {
          class: newEvent.class || '',
          subject: newEvent.subject || '',
          isPersonalEvent: true
        },
        notes: newEvent.notes,
        color: '#8b5cf6', // Purple for personal events
        type: 'personal',
        isPersonalEvent: true
      };
      
      // Update local state
      if (isEditMode) {
        // Remove old event and add updated one
        setEvents(prev => prev.filter(e => e.id !== eventToSave.id).concat(eventToSave));
      } else {
        // Add new event
        setEvents(prev => [...prev, eventToSave]);
      }
      
      closeCreateModal();
      
      // Show notification
      alert(`Event "${eventToSave.title}" has been ${isEditMode ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Failed to save event:', error);
      alert('Failed to save event. Please try again.');
    }
  };
  
  const handleDeleteEvent = async () => {
    if (isEditMode && newEvent.id) {
      try {
        // Delete from backend
        const result = await api.deleteCalendarEvent(newEvent.id);
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        // Remove from local state
        setEvents(prev => prev.filter(e => e.id !== newEvent.id));
        closeCreateModal();
        alert('Event deleted successfully!');
      } catch (error) {
        console.error('Failed to delete event:', error);
        alert('Failed to delete event. Please try again.');
      }
    }
  };

  const eventStyleGetter = (event) => {
    const style = {
      backgroundColor: event.color || '#3174ad',
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block'
    };
    return { style };
  };

  // Extract unique classes and subjects for filters
  const classes = [...new Set(events.filter(e => e.resource?.class).map(e => e.resource.class))].sort();
  const subjects = [...new Set(events.filter(e => e.resource?.subject).map(e => e.resource.subject))].sort();
  
  // State for filters
  const [filters, setFilters] = useState({
    types: ['timetable', 'personal', 'substitution'],
    class: '',
    subject: '',
    startDate: '',
    endDate: ''
  });
  
  // Apply filters to events
  const filteredEvents = filterEvents(events, filters);
  
  // Handle export calendar
  const handleExportCalendar = () => {
    const filename = `schoolflow-calendar-${format(new Date(), 'yyyy-MM-dd')}.ics`;
    downloadCalendarAsICS(filteredEvents, filename);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">School Calendar</h1>
        <div className="flex space-x-2">
          <button 
            onClick={() => setCalendarView('day')}
            className={`px-3 py-1 rounded-md ${calendarView === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            Day
          </button>
          <button 
            onClick={() => setCalendarView('week')}
            className={`px-3 py-1 rounded-md ${calendarView === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            Week
          </button>
          <button 
            onClick={() => setCalendarView('month')}
            className={`px-3 py-1 rounded-md ${calendarView === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            Month
          </button>
          <button 
            onClick={() => {
              const now = new Date();
              const oneHourLater = addHours(now, 1);
              setSelectedSlot({ start: now, end: oneHourLater });
              
              // Default values with fallbacks
              const defaultClass = user?.classTeacherFor || availableClasses[0] || '';
              const defaultSubject = user?.subjects?.[0] || availableSubjects[0] || '';
              
              setNewEvent({
                title: '',
                class: defaultClass,
                subject: defaultSubject,
                notes: '',
              });
              setIsEditMode(false);
              setShowCreateModal(true);
            }}
            className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" />
            Create
          </button>
          <button 
            onClick={loadCalendarEvents}
            className="px-3 py-1 rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            Refresh
          </button>
          <button 
            onClick={handleExportCalendar}
            className="px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700"
          >
            Export
          </button>
        </div>
      </div>
      
      {/* Calendar Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <CalendarFilter 
          filters={filters}
          onFilterChange={setFilters}
          classes={classes}
          subjects={subjects}
        />
      </div>
      
      {/* Calendar Reminders */}
      <CalendarReminder events={events} daysThreshold={3} />
      
      {/* Error Message */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
          <p className="font-medium">Error loading calendar</p>
          <p className="text-sm">{loadError}</p>
          <button 
            onClick={loadCalendarEvents}
            className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 h-[600px] relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-2 text-gray-700">Loading calendar events...</p>
            </div>
          </div>
        )}
        
        <Calendar
          localizer={localizer}
          events={filteredEvents}
          startAccessor="start"
          endAccessor="end"
          view={calendarView}
          onView={setCalendarView}
          onSelectEvent={handleEventClick}
          onSelectSlot={handleSlotSelect}
          selectable={true}
          eventPropGetter={eventStyleGetter}
          defaultDate={new Date()}
          components={{
            event: CustomEvent
          }}
        />
      </div>

      {/* Event Detail Modal */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 mx-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold text-gray-900">{selectedEvent.title}</h3>
              <button onClick={closeEventModal} className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-gray-500">Time</div>
                <div className="text-gray-900">
                  {format(selectedEvent.start, 'h:mm a')} - {format(selectedEvent.end, 'h:mm a')}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Date</div>
                <div className="text-gray-900">{format(selectedEvent.start, 'EEEE, MMMM d, yyyy')}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Class</div>
                <div className="text-gray-900">{selectedEvent.resource.class}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Subject</div>
                <div className="text-gray-900">{selectedEvent.resource.subject}</div>
              </div>
              {selectedEvent.resource.isSubstitution && (
                <div className="bg-red-50 p-2 rounded-md text-red-700 text-sm">
                  This is a substitution class
                </div>
              )}
              {selectedEvent.lessonPlan && (
                <>
                  <div className="bg-blue-50 p-2 rounded-md text-blue-700 text-sm">
                    Lesson Plan Status: {selectedEvent.status}
                  </div>
                  {selectedEvent.objectives && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500">Objectives</div>
                      <div className="text-gray-900 text-sm whitespace-pre-wrap">{selectedEvent.objectives}</div>
                    </div>
                  )}
                  {selectedEvent.activities && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500">Activities</div>
                      <div className="text-gray-900 text-sm whitespace-pre-wrap">{selectedEvent.activities}</div>
                    </div>
                  )}
                </>
              )}
              {selectedEvent.isPersonalEvent && selectedEvent.notes && (
                <div className="mt-2">
                  <div className="text-xs text-gray-500">Notes</div>
                  <div className="text-gray-900 text-sm whitespace-pre-wrap">{selectedEvent.notes}</div>
                </div>
              )}
              <div className="mt-2 flex justify-end space-x-2">
                {selectedEvent?.isPersonalEvent && (
                  <button
                    onClick={() => handleEditEvent(selectedEvent)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Edit className="h-4 w-4 inline-block mr-1" />
                    Edit
                  </button>
                )}
                <button
                  onClick={closeEventModal}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Event Modal */}
      {showCreateModal && selectedSlot && (
        <div className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 mx-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditMode ? 'Edit Event' : 'Create Event'}
              </h3>
              <button onClick={closeCreateModal} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Event title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <div className="text-gray-900">
                  {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')}
                  <br />
                  {format(selectedSlot.start, 'h:mm a')} - {format(selectedSlot.end, 'h:mm a')}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class (Optional)</label>
                <select
                  value={newEvent.class}
                  onChange={(e) => setNewEvent({...newEvent, class: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Class</option>
                  {availableClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject (Optional)</label>
                <select
                  value={newEvent.subject}
                  onChange={(e) => setNewEvent({...newEvent, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Subject</option>
                  {availableSubjects.map(subj => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newEvent.notes}
                  onChange={(e) => setNewEvent({...newEvent, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                {isEditMode && (
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4 inline-block mr-1" />
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvent}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 inline-block mr-1" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-4">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-[#3174ad] rounded-sm mr-2"></div>
          <span className="text-sm">Regular Class</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-[#4ade80] rounded-sm mr-2"></div>
          <span className="text-sm">Ready Lesson Plan</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-[#facc15] rounded-sm mr-2"></div>
          <span className="text-sm">Pending Review</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-[#93c5fd] rounded-sm mr-2"></div>
          <span className="text-sm">In Progress</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-[#f87171] rounded-sm mr-2"></div>
          <span className="text-sm">Substitution</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-[#8b5cf6] rounded-sm mr-2"></div>
          <span className="text-sm">Personal Event</span>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  isSameDay,
  isBefore,
} from 'date-fns';

/**
 * Format a date to a readable string
 * @param {Date} date - The date to format
 * @param {String} formatString - Optional format string
 * @returns {String} Formatted date string
 */
export const formatDate = (date, formatString = 'PPP') => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Get the date range for a week containing the specified date
 * @param {Date} date - The reference date
 * @returns {Object} An object with start and end dates
 */
export const getWeekRange = (date) => {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Week starts on Monday
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
};

/**
 * Get the date range for a month containing the specified date
 * @param {Date} date - The reference date
 * @returns {Object} An object with start and end dates
 */
export const getMonthRange = (date) => {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start, end };
};

/**
 * Convert timetable data to calendar events
 * @param {Array} timetableData - The timetable data from API
 * @returns {Array} Calendar events
 */
export const convertTimetableToEvents = (timetableData) => {
  if (!Array.isArray(timetableData)) return [];
  
  const events = [];
  
  timetableData.forEach(day => {
    if (!day.date || !Array.isArray(day.periods)) return;
    
    const dayDate = new Date(day.date);
    
    day.periods.forEach(period => {
      // Create event for each period
      const startHour = 7 + Number(period.period);
      const endHour = startHour + 1;
      
      const start = new Date(dayDate);
      start.setHours(startHour, 0, 0);
      
      const end = new Date(dayDate);
      end.setHours(endHour, 0, 0);
      
      events.push({
        id: `${day.date}-${period.period}`,
        title: `${period.class} - ${period.subject}`,
        start,
        end,
        resource: {
          class: period.class,
          subject: period.subject,
          period: period.period
        },
        color: '#3174ad', // Default blue
        type: 'timetable'
      });
    });
  });
  
  return events;
};

/**
 * Add lesson plan information to existing calendar events
 * @param {Array} events - Calendar events
 * @param {Array} lessonPlans - Lesson plans data from API
 * @returns {Array} Updated calendar events
 */
export const addLessonPlansToEvents = (events, lessonPlans) => {
  if (!Array.isArray(events) || !Array.isArray(lessonPlans)) return events;
  
  const updatedEvents = [...events];
  
  lessonPlans.forEach(plan => {
    const matchingEvent = updatedEvents.find(event => 
      event.resource?.class === plan.class && 
      event.resource?.subject === plan.subject && 
      Number(event.resource?.period) === Number(plan.session)
    );
    
    if (matchingEvent) {
      // Update the matching event with lesson plan info
      matchingEvent.lessonPlan = true;
      matchingEvent.lpId = plan.lpId;
      matchingEvent.status = plan.status;
      matchingEvent.objectives = plan.objectives;
      matchingEvent.activities = plan.activities;
      
      // Add color based on status
      if (plan.status === 'Ready') {
        matchingEvent.color = '#4ade80'; // Green for approved lesson plans
      } else if (plan.status === 'Pending Review') {
        matchingEvent.color = '#facc15'; // Yellow for pending review
      } else {
        matchingEvent.color = '#93c5fd'; // Blue for other statuses
      }
    }
  });
  
  return updatedEvents;
};

/**
 * Add substitution information to calendar events
 * @param {Array} events - Calendar events
 * @param {Object} substitutions - Substitution data from API
 * @param {String} teacherName - Name of the current teacher
 * @returns {Array} Updated calendar events
 */
export const addSubstitutionsToEvents = (events, substitutions, teacherName) => {
  if (!Array.isArray(events) || !substitutions || !Array.isArray(substitutions.timetable)) {
    return events;
  }
  
  const updatedEvents = [...events];
  const substitutionEvents = [];
  
  substitutions.timetable.forEach(sub => {
    if (sub.isSubstitution && sub.teacher === teacherName) {
      const dayDate = new Date(substitutions.date);
      const startHour = 7 + Number(sub.period);
      const endHour = startHour + 1;
      
      const start = new Date(dayDate);
      start.setHours(startHour, 0, 0);
      
      const end = new Date(dayDate);
      end.setHours(endHour, 0, 0);
      
      substitutionEvents.push({
        id: `substitution-${substitutions.date}-${sub.period}-${sub.class}`,
        title: `${sub.class} - ${sub.subject} (Substitution)`,
        start,
        end,
        resource: {
          class: sub.class,
          subject: sub.subject,
          period: sub.period,
          isSubstitution: true
        },
        color: '#f87171', // Red for substitution
        type: 'substitution'
      });
    }
  });
  
  return [...updatedEvents, ...substitutionEvents];
};

/**
 * Generate iCalendar (.ics) file content for events
 * @param {Array} events - Calendar events to export
 * @returns {String} iCalendar file content
 */
export const generateICalContent = (events) => {
  if (!Array.isArray(events) || events.length === 0) return '';
  
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SchoolFlow//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  
  events.forEach(event => {
    if (!event.start || !event.end) return;
    
    const startDate = format(event.start, "yyyyMMdd'T'HHmmss'Z'");
    const endDate = format(event.end, "yyyyMMdd'T'HHmmss'Z'");
    const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
    const uid = `${event.id || Date.now()}@schoolflow.app`;
    
    let description = '';
    if (event.resource) {
      description += `Class: ${event.resource.class || 'N/A'}\n`;
      description += `Subject: ${event.resource.subject || 'N/A'}\n`;
      
      if (event.resource.isSubstitution) {
        description += 'This is a substitution class\n';
      }
    }
    
    if (event.objectives) {
      description += `\nObjectives:\n${event.objectives}\n`;
    }
    
    if (event.activities) {
      description += `\nActivities:\n${event.activities}\n`;
    }
    
    if (event.notes) {
      description += `\nNotes:\n${event.notes}\n`;
    }
    
    // Clean description for iCalendar format
    description = description.replace(/\n/g, '\\n');
    
    icsContent = icsContent.concat([
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${description}`,
      'END:VEVENT'
    ]);
  });
  
  icsContent.push('END:VCALENDAR');
  return icsContent.join('\r\n');
};

/**
 * Download calendar events as an iCalendar file
 * @param {Array} events - Calendar events to export
 * @param {String} filename - Name for the downloaded file
 */
export const downloadCalendarAsICS = (events, filename = 'school-calendar.ics') => {
  const icsContent = generateICalContent(events);
  if (!icsContent) return;
  
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
};

/**
 * Filter events based on criteria
 * @param {Array} events - Calendar events
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered events
 */
export const filterEvents = (events, filters) => {
  if (!Array.isArray(events)) return [];
  if (!filters) return events;
  
  return events.filter(event => {
    // Filter by event type
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(event.type)) {
        return false;
      }
    }
    
    // Filter by class
    if (filters.class && event.resource?.class !== filters.class) {
      return false;
    }
    
    // Filter by subject
    if (filters.subject && event.resource?.subject !== filters.subject) {
      return false;
    }
    
    // Filter by date range
    if (filters.startDate && isBefore(event.start, new Date(filters.startDate))) {
      return false;
    }
    
    if (filters.endDate && isBefore(new Date(filters.endDate), event.start)) {
      return false;
    }
    
    return true;
  });
};
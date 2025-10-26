import React from 'react';
import { formatDate } from './helpers';

/**
 * Calendar reminder component for notifications about upcoming events
 * @param {Object} props - Component props
 * @returns {JSX.Element} Reminder component
 */
export const CalendarReminder = ({ events, daysThreshold = 3 }) => {
  // Filter events that are coming up within the threshold
  const now = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(now.getDate() + daysThreshold);
  
  const upcomingEvents = events.filter(event => {
    const eventDate = new Date(event.start);
    return eventDate > now && eventDate <= thresholdDate;
  });
  
  // Sort by date (closest first)
  upcomingEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
  
  if (upcomingEvents.length === 0) {
    return null;
  }
  
  return (
    <div className="calendar-reminders">
      <h3 className="reminders-title">Upcoming Events</h3>
      <div className="reminders-list">
        {upcomingEvents.map(event => (
          <div key={event.id} className="reminder-item" style={{ borderLeft: `4px solid ${event.color || '#3174ad'}` }}>
            <div className="reminder-title">{event.title}</div>
            <div className="reminder-date">{formatDate(event.start, 'PPpp')}</div>
            {event.type === 'timetable' && event.lessonPlan && (
              <div className="reminder-badge lesson-plan-badge">{event.status || 'Lesson Plan'}</div>
            )}
            {event.type === 'substitution' && (
              <div className="reminder-badge substitution-badge">Substitution</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Calendar export button with format options
 * @param {Object} props - Component props
 * @returns {JSX.Element} Export button component
 */
export const CalendarExport = ({ events, onExport }) => {
  const [showMenu, setShowMenu] = React.useState(false);
  
  const handleExport = (format) => {
    setShowMenu(false);
    if (onExport) {
      onExport(events, format);
    }
  };
  
  return (
    <div className="calendar-export">
      <button 
        className="export-button"
        onClick={() => setShowMenu(!showMenu)}
      >
        Export Calendar
      </button>
      
      {showMenu && (
        <div className="export-menu">
          <button onClick={() => handleExport('ics')} className="export-option">
            iCalendar (.ics)
          </button>
          <button onClick={() => handleExport('json')} className="export-option">
            JSON
          </button>
          <button onClick={() => handleExport('csv')} className="export-option">
            CSV
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Calendar search and filter component
 * @param {Object} props - Component props
 * @returns {JSX.Element} Search and filter component
 */
export const CalendarFilter = ({ filters, onFilterChange, classes = [], subjects = [] }) => {
  const handleTypeToggle = (type) => {
    const newTypes = [...(filters.types || [])];
    const index = newTypes.indexOf(type);
    
    if (index === -1) {
      newTypes.push(type);
    } else {
      newTypes.splice(index, 1);
    }
    
    onFilterChange({ ...filters, types: newTypes });
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };
  
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };
  
  const handleReset = () => {
    onFilterChange({
      types: ['timetable', 'personal', 'substitution'],
      class: '',
      subject: '',
      startDate: '',
      endDate: ''
    });
  };
  
  const isTypeActive = (type) => {
    return filters?.types?.includes(type) || false;
  };
  
  return (
    <div className="calendar-filter">
      <div className="filter-section type-filters">
        <div className="filter-label">Event Types:</div>
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${isTypeActive('timetable') ? 'active' : ''}`}
            onClick={() => handleTypeToggle('timetable')}
          >
            <div className="color-dot timetable-color"></div>
            Timetable
          </button>
          
          <button 
            className={`filter-btn ${isTypeActive('substitution') ? 'active' : ''}`}
            onClick={() => handleTypeToggle('substitution')}
          >
            <div className="color-dot substitution-color"></div>
            Substitutions
          </button>
          
          <button 
            className={`filter-btn ${isTypeActive('personal') ? 'active' : ''}`}
            onClick={() => handleTypeToggle('personal')}
          >
            <div className="color-dot personal-color"></div>
            Personal
          </button>
        </div>
      </div>
      
      <div className="filter-section advanced-filters">
        <div className="filter-row">
          <div className="filter-field">
            <label htmlFor="class-filter">Class:</label>
            <select 
              id="class-filter"
              name="class"
              value={filters.class || ''}
              onChange={handleInputChange}
            >
              <option value="">All Classes</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-field">
            <label htmlFor="subject-filter">Subject:</label>
            <select 
              id="subject-filter"
              name="subject"
              value={filters.subject || ''}
              onChange={handleInputChange}
            >
              <option value="">All Subjects</option>
              {subjects.map((subj) => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="filter-row">
          <div className="filter-field">
            <label htmlFor="start-date-filter">From:</label>
            <input 
              type="date"
              id="start-date-filter"
              name="startDate"
              value={filters.startDate || ''}
              onChange={handleDateChange}
            />
          </div>
          
          <div className="filter-field">
            <label htmlFor="end-date-filter">To:</label>
            <input 
              type="date"
              id="end-date-filter"
              name="endDate"
              value={filters.endDate || ''}
              onChange={handleDateChange}
            />
          </div>
          
          <button className="reset-filters-btn" onClick={handleReset}>
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
};
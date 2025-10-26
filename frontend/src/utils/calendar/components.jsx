import React from 'react';
import { format } from 'date-fns';
import { downloadCalendarAsICS } from './helpers';
import './styles.css';

/**
 * Calendar toolbar component with navigation and view controls
 * @param {Object} props - Component props from react-big-calendar
 * @returns {JSX.Element} Toolbar component
 */
export const CustomToolbar = ({ 
  date, 
  view, 
  onView, 
  onNavigate, 
  views,
  events,
  filters,
  onFilter
}) => {
  // Format the current date based on the view
  const getFormattedDate = () => {
    switch (view) {
      case 'month':
        return format(date, 'MMMM yyyy');
      case 'week':
        return `Week of ${format(date, 'PPP')}`;
      case 'day':
        return format(date, 'PPPP');
      default:
        return format(date, 'MMMM yyyy');
    }
  };
  
  // Handle download calendar as ICS
  const handleDownload = () => {
    // Filter events based on current filters
    const filteredEvents = events.filter(event => {
      if (filters.types && !filters.types.includes(event.type)) return false;
      if (filters.class && event.resource?.class !== filters.class) return false;
      if (filters.subject && event.resource?.subject !== filters.subject) return false;
      return true;
    });
    
    // Generate filename based on current view and date
    const filename = `schoolflow-calendar-${format(date, 'yyyy-MM-dd')}.ics`;
    
    // Download as ICS
    downloadCalendarAsICS(filteredEvents, filename);
  };
  
  // Toggle event type filter
  const toggleEventType = (type) => {
    if (!onFilter) return;
    
    const newTypes = [...(filters?.types || [])];
    const index = newTypes.indexOf(type);
    
    if (index === -1) {
      newTypes.push(type);
    } else {
      newTypes.splice(index, 1);
    }
    
    onFilter({ ...filters, types: newTypes });
  };
  
  // Check if a filter type is active
  const isFilterActive = (type) => {
    return filters?.types?.includes(type) || false;
  };
  
  return (
    <div className="custom-calendar-toolbar">
      <div className="toolbar-nav">
        <button
          onClick={() => onNavigate('TODAY')}
          className="toolbar-btn today-btn"
        >
          Today
        </button>
        <div className="nav-buttons">
          <button
            onClick={() => onNavigate('PREV')}
            className="toolbar-btn nav-btn"
          >
            &lt;
          </button>
          <span className="current-date">{getFormattedDate()}</span>
          <button
            onClick={() => onNavigate('NEXT')}
            className="toolbar-btn nav-btn"
          >
            &gt;
          </button>
        </div>
      </div>
      
      <div className="toolbar-views">
        {views.map(name => (
          <button
            key={name}
            onClick={() => onView(name)}
            className={`toolbar-btn view-btn ${view === name ? 'active' : ''}`}
          >
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>
      
      <div className="toolbar-filters">
        <div className="filter-buttons">
          <button
            onClick={() => toggleEventType('timetable')}
            className={`filter-btn timetable-filter ${isFilterActive('timetable') ? 'active' : ''}`}
          >
            Timetable
          </button>
          <button
            onClick={() => toggleEventType('substitution')}
            className={`filter-btn substitution-filter ${isFilterActive('substitution') ? 'active' : ''}`}
          >
            Substitutions
          </button>
          <button
            onClick={() => toggleEventType('personal')}
            className={`filter-btn personal-filter ${isFilterActive('personal') ? 'active' : ''}`}
          >
            Personal
          </button>
        </div>
        
        <button onClick={handleDownload} className="toolbar-btn export-btn">
          Export Calendar
        </button>
      </div>
    </div>
  );
};

/**
 * Component for displaying event details in the calendar
 * @param {Object} props - Component props
 * @returns {JSX.Element} Event component
 */
export const CustomEvent = ({ event }) => {
  // Display details based on event type
  const renderEventContent = () => {
    switch (event.type) {
      case 'timetable':
        return (
          <>
            <div className="event-title">{event.title}</div>
            {event.resource && (
              <div className="event-meta">
                <span>Period: {event.resource.period}</span>
              </div>
            )}
            {event.lessonPlan && (
              <div className="event-status">
                <span>{event.status || 'No Status'}</span>
              </div>
            )}
          </>
        );
      case 'substitution':
        return (
          <>
            <div className="event-title">{event.title}</div>
            {event.resource && (
              <div className="event-meta">
                <span>Period: {event.resource.period}</span>
                <span className="substitution-label">Substitution</span>
              </div>
            )}
          </>
        );
      case 'personal':
        return (
          <>
            <div className="event-title">{event.title}</div>
            {event.notes && (
              <div className="event-meta">
                <span className="notes-preview">
                  {event.notes.length > 30 ? `${event.notes.substring(0, 30)}...` : event.notes}
                </span>
              </div>
            )}
          </>
        );
      default:
        return <div className="event-title">{event.title}</div>;
    }
  };
  
  // Style based on event properties
  const eventStyle = {
    backgroundColor: event.color || '#3174ad',
    borderLeft: event.type === 'substitution' ? '4px solid #ef4444' : 'none'
  };
  
  return (
    <div className={`custom-calendar-event event-type-${event.type}`} style={eventStyle}>
      {renderEventContent()}
    </div>
  );
};

/**
 * Component for displaying event details in a modal
 * @param {Object} props - Component props
 * @returns {JSX.Element} Modal component
 */
export const EventModal = ({ 
  isOpen, 
  onClose, 
  event, 
  mode,
  onSave,
  onDelete
}) => {
  // Early return if modal is not open or event is not provided
  if (!isOpen || !event) return null;
  
  const [formData, setFormData] = React.useState({
    title: event.title || '',
    start: event.start,
    end: event.end,
    notes: event.notes || '',
    color: event.color || '#8b5cf6'
  });
  
  // Update form data when event changes
  React.useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        start: event.start,
        end: event.end,
        notes: event.notes || '',
        color: event.color || '#8b5cf6'
      });
    }
  }, [event]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    
    onSave({
      ...event,
      ...formData,
      title: formData.title.trim(),
      type: event.type || 'personal'
    });
  };
  
  // Format date based on event type
  const formatEventDate = (date) => {
    if (!date) return '';
    return format(date, 'PPpp'); // Example: "Apr 30, 2023, 12:00 PM"
  };
  
  // Render view mode
  const renderViewMode = () => {
    return (
      <div className="event-modal-content view-mode">
        <h3>{event.title}</h3>
        
        <div className="event-details">
          <div className="event-time">
            <div className="time-label">Start:</div>
            <div className="time-value">{formatEventDate(event.start)}</div>
          </div>
          
          <div className="event-time">
            <div className="time-label">End:</div>
            <div className="time-value">{formatEventDate(event.end)}</div>
          </div>
          
          {event.resource && (
            <div className="event-resource">
              <div className="resource-item">
                <div className="resource-label">Class:</div>
                <div className="resource-value">{event.resource.class || 'N/A'}</div>
              </div>
              
              <div className="resource-item">
                <div className="resource-label">Subject:</div>
                <div className="resource-value">{event.resource.subject || 'N/A'}</div>
              </div>
              
              <div className="resource-item">
                <div className="resource-label">Period:</div>
                <div className="resource-value">{event.resource.period || 'N/A'}</div>
              </div>
            </div>
          )}
          
          {event.lessonPlan && (
            <div className="event-lesson-plan">
              <h4>Lesson Plan Details</h4>
              <div className="lesson-plan-item">
                <div className="lesson-plan-label">Status:</div>
                <div className="lesson-plan-value">{event.status || 'No Status'}</div>
              </div>
              
              {event.objectives && (
                <div className="lesson-plan-item">
                  <div className="lesson-plan-label">Objectives:</div>
                  <div className="lesson-plan-value">{event.objectives}</div>
                </div>
              )}
              
              {event.activities && (
                <div className="lesson-plan-item">
                  <div className="lesson-plan-label">Activities:</div>
                  <div className="lesson-plan-value">{event.activities}</div>
                </div>
              )}
            </div>
          )}
          
          {event.notes && (
            <div className="event-notes">
              <h4>Notes</h4>
              <p>{event.notes}</p>
            </div>
          )}
        </div>
        
        <div className="event-modal-footer view-mode-footer">
          {(event.type === 'personal') && (
            <button onClick={() => onDelete(event.id)} className="delete-btn">
              Delete
            </button>
          )}
          
          {(event.type === 'personal') && (
            <button onClick={() => onClose('edit')} className="edit-btn">
              Edit
            </button>
          )}
          
          <button onClick={onClose} className="close-btn">
            Close
          </button>
        </div>
      </div>
    );
  };
  
  // Render edit/create mode
  const renderEditMode = () => {
    return (
      <div className="event-modal-content edit-mode">
        <h3>{mode === 'create' ? 'Create New Event' : 'Edit Event'}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter event title"
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start">Start Time</label>
              <input
                type="datetime-local"
                id="start"
                name="start"
                value={format(formData.start, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => {
                  const newStart = new Date(e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    start: newStart,
                    // If end is before new start, update end too
                    end: newStart > formData.end ? new Date(newStart.getTime() + 3600000) : formData.end
                  }));
                }}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="end">End Time</label>
              <input
                type="datetime-local"
                id="end"
                name="end"
                value={format(formData.end, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => {
                  const newEnd = new Date(e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    end: newEnd
                  }));
                }}
                min={format(formData.start, "yyyy-MM-dd'T'HH:mm")}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="color">Color</label>
            <input
              type="color"
              id="color"
              name="color"
              value={formData.color}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Add any notes or details about this event"
            />
          </div>
          
          <div className="event-modal-footer edit-mode-footer">
            {mode === 'edit' && (
              <button 
                type="button"
                onClick={() => onDelete(event.id)} 
                className="delete-btn"
              >
                Delete
              </button>
            )}
            
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            
            <button type="submit" className="save-btn">
              Save
            </button>
          </div>
        </form>
      </div>
    );
  };
  
  return (
    <div className={`event-modal ${isOpen ? 'open' : ''}`}>
      <div className="event-modal-overlay" onClick={onClose}></div>
      <div className="event-modal-container">
        {mode === 'view' ? renderViewMode() : renderEditMode()}
      </div>
    </div>
  );
};
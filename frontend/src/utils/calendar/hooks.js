import { useState } from 'react';

/**
 * Custom hook for managing calendar events
 * @param {Array} initialEvents - Initial events data
 * @returns {Object} Event management methods and state
 */
export const useCalendarEvents = (initialEvents = []) => {
  const [events, setEvents] = useState(initialEvents);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // 'view', 'create', 'edit'
  
  // Open the modal for viewing event details
  const viewEvent = (event) => {
    setSelectedEvent(event);
    setModalMode('view');
    setIsModalOpen(true);
  };
  
  // Open the modal for creating a new event
  const openCreateModal = (slotInfo) => {
    // slotInfo comes from react-big-calendar's onSelectSlot
    setSelectedEvent({
      start: slotInfo.start,
      end: slotInfo.end,
      title: '',
      type: 'personal',
      color: '#8b5cf6', // Default purple for personal events
      notes: ''
    });
    setModalMode('create');
    setIsModalOpen(true);
  };
  
  // Open the modal for editing an existing event
  const openEditModal = (event) => {
    setSelectedEvent(event);
    setModalMode('edit');
    setIsModalOpen(true);
  };
  
  // Close the modal
  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedEvent(null);
    }, 200); // Reset after animation completes
  };
  
  // Add a new event
  const addEvent = (newEvent) => {
    const eventWithId = {
      ...newEvent,
      id: `personal-${Date.now()}`
    };
    setEvents([...events, eventWithId]);
    closeModal();
    return eventWithId;
  };
  
  // Update an existing event
  const updateEvent = (updatedEvent) => {
    setEvents(events.map(event => 
      event.id === updatedEvent.id ? updatedEvent : event
    ));
    closeModal();
  };
  
  // Delete an event
  const deleteEvent = (eventId) => {
    setEvents(events.filter(event => event.id !== eventId));
    closeModal();
  };
  
  // Merge new events with existing ones
  const mergeEvents = (newEvents) => {
    // Create a map of existing events by ID for quick lookup
    const eventMap = new Map();
    events.forEach(event => {
      eventMap.set(event.id, event);
    });
    
    // Update existing events and add new ones
    const mergedEvents = [...events];
    newEvents.forEach(newEvent => {
      if (eventMap.has(newEvent.id)) {
        // Update existing event
        const index = mergedEvents.findIndex(e => e.id === newEvent.id);
        if (index !== -1) {
          mergedEvents[index] = { ...mergedEvents[index], ...newEvent };
        }
      } else {
        // Add new event
        mergedEvents.push(newEvent);
      }
    });
    
    setEvents(mergedEvents);
  };
  
  return {
    events,
    selectedEvent,
    isModalOpen,
    modalMode,
    viewEvent,
    openCreateModal,
    openEditModal,
    closeModal,
    addEvent,
    updateEvent,
    deleteEvent,
    mergeEvents,
    setEvents
  };
};

/**
 * Custom hook for calendar view state management
 * @param {String} initialView - Initial calendar view
 * @returns {Object} View management methods and state
 */
export const useCalendarView = (initialView = 'month') => {
  const [view, setView] = useState(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState({
    types: ['timetable', 'personal', 'substitution'],
    class: '',
    subject: ''
  });
  
  // Navigate to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Navigate to previous period
  const goToPrev = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      default:
        break;
    }
    setCurrentDate(newDate);
  };
  
  // Navigate to next period
  const goToNext = () => {
    const newDate = new Date(currentDate);
    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      default:
        break;
    }
    setCurrentDate(newDate);
  };
  
  // Update filters
  const updateFilters = (newFilters) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      ...newFilters
    }));
  };
  
  // Toggle a specific filter type
  const toggleFilterType = (type) => {
    setFilters(prevFilters => {
      const types = [...prevFilters.types];
      const index = types.indexOf(type);
      
      if (index === -1) {
        types.push(type);
      } else {
        types.splice(index, 1);
      }
      
      return {
        ...prevFilters,
        types
      };
    });
  };
  
  return {
    view,
    setView,
    currentDate,
    setCurrentDate,
    filters,
    updateFilters,
    toggleFilterType,
    goToToday,
    goToPrev,
    goToNext
  };
};
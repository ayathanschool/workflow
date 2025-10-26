import React from 'react';
import CalendarView from '../components/calendar/CalendarView';

const CalendarPage = ({ user }) => {
  return (
    <div>
      <CalendarView user={user} />
    </div>
  );
};

export default CalendarPage;
// DailyReportTimetable.jsx (Deprecated Stub)
// This legacy timetable-driven daily report view has been deprecated.
// It now delegates entirely to DailyReportModern to avoid duplicated logic.
// Original implementation archived at: archive/frontend-backups/DailyReportTimetable.original.jsx
import React from 'react';
import DailyReportModern from './DailyReportModern';

export default function DailyReportTimetable(props) {
  if (import.meta.env.DEV) {
    console.warn('[DailyReportTimetable] Deprecated. Rendering DailyReportModern instead.');
  }
  return <DailyReportModern {...props} />;
}
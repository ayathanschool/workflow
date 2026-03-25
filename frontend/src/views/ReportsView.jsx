import React from 'react';
import DailyReportModern from '../DailyReportModern';

const ReportsView = ({ memoizedUser, memoizedSettings }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Daily Reports</h1>
        <div className="text-sm text-gray-600">
          Complete your daily reports based on your timetable
        </div>
      </div>

      {/* Modern daily reporting with smooth UX - NO PAGE REFRESH */}
      <div className="bg-transparent">
        <DailyReportModern user={memoizedUser} settings={memoizedSettings} />
      </div>
    </div>
  );
};

export default ReportsView;

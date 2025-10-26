import React from 'react';

export default function LoadingSplash({ message = 'Loading...' }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-50 transition-colors">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-700 dark:text-gray-200 font-medium">{message}</p>
      </div>
    </div>
  );
}

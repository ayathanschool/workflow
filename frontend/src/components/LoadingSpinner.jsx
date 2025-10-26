import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const LoadingSpinner = ({ size = 'md', text = 'Loading...' }) => {
  const { theme } = useTheme();
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-b-2 ${theme === 'dark' ? 'border-blue-400' : 'border-blue-600'} transition-colors duration-300`}></div>
      {text && <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} transition-colors duration-300`}>{text}</p>}
    </div>
  );
};

export default React.memo(LoadingSpinner);
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Check if user has a saved preference in localStorage or use system preference
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;
    
    // If user has no preference, check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'light'; // Default to light theme
  };
  
  const [theme, setTheme] = useState(getInitialTheme);
  
  // Apply theme to HTML element ONLY (don't trigger re-renders)
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Use a single class toggle instead of removing/adding
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Save theme preference to localStorage (sync, no re-render)
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };
  
  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);
  
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
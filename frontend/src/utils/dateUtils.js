// dateUtils.js - Utility functions for date handling with IST support

/**
 * Get current date in IST timezone in ISO format (YYYY-MM-DD)
 * @returns {string} Today's date in YYYY-MM-DD format in IST
 */
export function todayIST() {
  const now = new Date();
  
  // Get the date in IST (Asia/Kolkata timezone)
  // Use toLocaleString to properly handle timezone conversion
  const istDateString = now.toLocaleString('en-CA', { 
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split(',')[0]; // Format: YYYY-MM-DD
  
  return istDateString;
}

/**
 * Get yesterday's date in IST timezone in ISO format (YYYY-MM-DD)
 * @returns {string} Yesterday's date in YYYY-MM-DD format in IST
 */
export function yesterdayIST() {
  const t = todayIST();
  // Interpret YYYY-MM-DD as a UTC day boundary to avoid local timezone skew.
  const d = new Date(`${t}T00:00:00Z`);
  if (isNaN(d.getTime())) return t;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 * Adjusted for timezone to ensure the correct local date
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function todayLocalISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(Date.now() - off).toISOString().slice(0, 10);
}

/**
 * Convert any date to IST and return ISO format
 * @param {Date|string|null} date - Date to convert (defaults to now)
 * @returns {string} Date in YYYY-MM-DD format in IST
 */
export function toISTDateString(date = null) {
  const inputDate = date ? new Date(date) : new Date();
  if (isNaN(inputDate.getTime())) {
    return todayIST();
  }
  
  // Convert to IST (UTC+5:30)
  const istTime = new Date(inputDate.getTime() + (5.5 * 60 * 60 * 1000));
  return istTime.toISOString().slice(0, 10);
}

/**
 * Get current date and time in IST
 * @returns {Date} Current date/time in IST
 */
export function nowIST() {
  const now = new Date();
  return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
}

/**
 * Format date for form inputs (YYYY-MM-DD) ensuring IST handling
 * @param {Date|string|null} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format
 */
export function formatDateForInput(date = null) {
  if (!date) return todayIST();
  
  if (typeof date === 'string') {
    // If it's already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // Parse and convert to IST
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? todayIST() : toISTDateString(parsed);
  }
  
  if (date instanceof Date) {
    return toISTDateString(date);
  }
  
  return todayIST();
}

/**
 * Get date range for current week in IST (Monday to Friday)
 * @returns {Object} Object with start and end dates in YYYY-MM-DD format
 */
export function getCurrentWeekIST() {
  const today = new Date();
  const istToday = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
  
  const dayOfWeek = istToday.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate Monday of current week
  const monday = new Date(istToday);
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
  monday.setDate(istToday.getDate() + daysToMonday);
  
  // Calculate Friday of current week
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  return {
    start: monday.toISOString().slice(0, 10),
    end: friday.toISOString().slice(0, 10)
  };
}

/**
 * Check if a date is a Friday
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if the date is a Friday
 */
export function isFriday(date) {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate.getDay() === 5; // 0 = Sunday, 5 = Friday
}

/**
 * Get next week's date range (Monday-Friday) in IST
 * @returns {Object} Object with start and end dates in ISO format
 */
export function getNextWeekDates() {
  const today = new Date();
  const istToday = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
  
  const nextMonday = new Date(istToday);
  const dayOfWeek = istToday.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Calculate days until next Monday
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  nextMonday.setDate(istToday.getDate() + daysUntilMonday);
  
  const nextFriday = new Date(nextMonday);
  nextFriday.setDate(nextMonday.getDate() + 4);
  
  return {
    start: nextMonday.toISOString().slice(0, 10),
    end: nextFriday.toISOString().slice(0, 10)
  };
}

/**
 * Check if date is between start and end dates (inclusive)
 * @param {string} dateToCheck - Date to check in ISO format
 * @param {string} startDate - Start date in ISO format
 * @param {string} endDate - End date in ISO format
 * @returns {boolean} True if date is in range
 */
export function isDateInRange(dateToCheck, startDate, endDate) {
  const date = new Date(dateToCheck).getTime();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return date >= start && date <= end;
}

/**
 * Returns true if the date is for the next week
 * @param {string} date - Date to check in ISO format
 * @returns {boolean} True if the date is in the next week
 */
export function isDateForNextWeek(date) {
  const nextWeek = getNextWeekDates();
  return isDateInRange(date, nextWeek.start, nextWeek.end);
}

/**
 * Format a date object or ISO string into a localized date string
 * @param {Date|string} date - Date object or ISO string
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatLocalDate(date, options = { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  weekday: 'long'
}) {
  if (typeof date === 'string') {
    date = new Date(date + 'T00:00:00');
  }
  return date.toLocaleDateString('en-IN', options);
}

/**
 * Format a date object or ISO string into a short date format for IST
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Short formatted date string (e.g., "20 Aug 2025")
 */
export function formatShortDate(date) {
  if (!date) return '';
  
  // Handle problematic date placeholders
  if (typeof date === 'string') {
    // Handle special cases
    if (date.includes('31 Dec 99') || date === '31 Dec 1999' || date === '12/31/99' || date === '12/31/1999') {
      // Use today instead of placeholder date
      return formatShortDate(new Date());
    }
    
    if (date.includes('1 Jan 1950') || date === '01 Jan 1950' || date === '1/1/1950' || date === '01/01/1950') {
      // Use today instead of placeholder date
      return formatShortDate(new Date());
    }
    
    // Handle old format like "9 Apr 1900" - convert it first
    const dayMonthYearRegex = /^(\d{1,2})\s+([a-zA-Z]{3})\s+(\d{4})$/;
    const match = date.match(dayMonthYearRegex);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2];
      const year = match[3];
      
      // Convert month name to number
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      
      if (monthMap[month]) {
        // If year is older than 2000, it's likely a placeholder
        const currentYear = new Date().getFullYear();
        const correctedYear = (parseInt(year) < 2000) ? currentYear.toString() : year;
        date = `${correctedYear}-${monthMap[month]}-${day}`;
      }
    }
    
    // Now parse the date
    let parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      parsed = new Date(date + 'T00:00:00');
    }
    
    // If parsing fails or date is very old (before 2000), use current date
    if (isNaN(parsed.getTime()) || parsed.getFullYear() < 2000) {
      return new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    date = parsed;
  } else if (date instanceof Date) {
    // If date is very old (before 2000), use current date
    if (date.getFullYear() < 2000) {
      return new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }
  
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format date for display in Indian format
 * @param {Date|string} date - Date to format
 * @returns {string} Date in DD-MM-YYYY format
 */
export function formatIndianDate(date) {
  if (!date) return '';
  
  const checkDate = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  if (isNaN(checkDate.getTime())) return 'Invalid date';
  
  return checkDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Convert period number to time string (e.g., "09:00 - 09:45")
 * Can use custom period times from app settings if provided
 * @param {number|string} period - Period number (1-8)
 * @param {Array} [customPeriodTimes] - Optional custom period times from settings
 * @returns {string} Time range string
 */
export function periodToTimeString(period, customPeriodTimes = null) {
  // Convert string to number if needed
  period = parseInt(period, 10);
  
  // Use custom period times if provided
  if (customPeriodTimes && Array.isArray(customPeriodTimes)) {
    const customPeriod = customPeriodTimes.find(p => p.period === period);
    if (customPeriod && customPeriod.start && customPeriod.end) {
      return `${customPeriod.start} - ${customPeriod.end}`;
    }
  }
  
  // Default period map (updated to match school settings)
  const periodMap = {
    1: "08:50 - 09:35",
    2: "09:35 - 10:20",
    3: "10:30 - 11:15",
    4: "11:15 - 12:00",
    5: "12:00 - 12:45",
    6: "13:15 - 14:00",
    7: "14:00 - 14:40",
    8: "14:45 - 15:25"
  };
  
  return periodMap[period] || `Period ${period}`;
}

/**
 * Parse date string and ensure it's in correct format for API calls
 * @param {string|Date} date - Input date
 * @returns {string} Date in YYYY-MM-DD format
 */
export function parseApiDate(date) {
  if (!date) return todayIST();
  
  // Handle problematic dates
  if (typeof date === 'string') {
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // Special handling for common problematic dates
    if (date.includes('31 Dec 99') || date === '31 Dec 1999' || date === '12/31/99' || date === '12/31/1999') {
      // Replace with today's date
      return todayIST();
    }
    
    if (date.includes('1 Jan 1950') || date === '01 Jan 1950' || date === '1/1/1950' || date === '01/01/1950') {
      // Replace with today's date
      return todayIST();
    }
    
    // Special handling for day month year format like "9 Apr 1900"
    const dayMonthYearRegex = /^(\d{1,2})\s+([a-zA-Z]{3})\s+(\d{4})$/;
    const match = date.match(dayMonthYearRegex);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2];
      const year = match[3];
      
      // Convert month name to number
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      
      if (monthMap[month]) {
        // If year is older than 2000, it's likely a placeholder or incorrect date
        // Replace with current year
        const currentYear = new Date().getFullYear();
        const correctedYear = (year < 2000) ? currentYear.toString() : year;
        return `${correctedYear}-${monthMap[month]}-${day}`;
      }
    }
    
    // Try to parse various formats
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      // If date is very old (before 2000), it's likely a placeholder
      // Replace with current date
      if (parsed.getFullYear() < 2000) {
        return todayIST();
      }
      return toISTDateString(parsed);
    }
  }
  
  if (date instanceof Date && !isNaN(date.getTime())) {
    // If date is very old (before 2000), it's likely a placeholder
    // Replace with current date
    if (date.getFullYear() < 2000) {
      return todayIST();
    }
    return toISTDateString(date);
  }
  
  // Fallback to today
  return todayIST();
}

/**
 * Create a timestamp in IST for database storage
 * @returns {string} ISO timestamp in IST
 */
export function createISTTimestamp() {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return istTime.toISOString();
}

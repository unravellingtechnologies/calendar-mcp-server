/**
 * Utility functions for handling date ranges in event queries
 */

/**
 * Validates a date range
 */
export function validateDateRange(startDate: Date, endDate: Date): { isValid: boolean; error?: string } {
  if (isNaN(startDate.getTime())) {
    return { isValid: false, error: 'Invalid start date' };
  }
  
  if (isNaN(endDate.getTime())) {
    return { isValid: false, error: 'Invalid end date' };
  }
  
  if (startDate >= endDate) {
    return { isValid: false, error: 'Start date must be before end date' };
  }
  
  return { isValid: true };
}

/**
 * Checks if two date ranges overlap
 */
export function dateRangesOverlap(
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Checks if a date falls within a date range
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Gets the intersection of two date ranges
 */
export function getDateRangeIntersection(
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): { start: Date; end: Date } | null {
  if (!dateRangesOverlap(start1, end1, start2, end2)) {
    return null;
  }
  
  return {
    start: new Date(Math.max(start1.getTime(), start2.getTime())),
    end: new Date(Math.min(end1.getTime(), end2.getTime()))
  };
}

/**
 * Formats a date range for display
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  const startStr = startDate.toLocaleDateString();
  const endStr = endDate.toLocaleDateString();
  
  if (startStr === endStr) {
    return startStr;
  }
  
  return `${startStr} - ${endStr}`;
}

/**
 * Gets the duration of a date range in milliseconds
 */
export function getDateRangeDuration(startDate: Date, endDate: Date): number {
  return endDate.getTime() - startDate.getTime();
}

/**
 * Gets the duration of a date range in days
 */
export function getDateRangeDurationInDays(startDate: Date, endDate: Date): number {
  const duration = getDateRangeDuration(startDate, endDate);
  return Math.ceil(duration / (1000 * 60 * 60 * 24));
}

/**
 * Checks if a date range is within reasonable bounds
 */
export function isDateRangeReasonable(startDate: Date, endDate: Date, maxDays: number = 365): boolean {
  const durationInDays = getDateRangeDurationInDays(startDate, endDate);
  return durationInDays <= maxDays;
}

/**
 * Expands a date range by a specified number of days
 */
export function expandDateRange(startDate: Date, endDate: Date, days: number): { start: Date; end: Date } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  start.setDate(start.getDate() - days);
  end.setDate(end.getDate() + days);
  
  return { start, end };
}

/**
 * Gets the start of day for a given date
 */
export function getStartOfDay(date: Date): Date {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
}

/**
 * Gets the end of day for a given date
 */
export function getEndOfDay(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

/**
 * Checks if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Checks if a date is tomorrow
 */
export function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
}

/**
 * Checks if a date is yesterday
 */
export function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

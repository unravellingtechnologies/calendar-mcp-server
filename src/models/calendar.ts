/**
 * Data models for calendars
 */

/**
 * Represents a calendar
 */
export interface Calendar {
  /** The unique identifier of the calendar */
  id: string;
  /** The title of the calendar */
  title: string;
  /** The color of the calendar (hex string) */
  color?: string;
  /** The type of the calendar */
  type: 'local' | 'subscribed' | 'caldav' | 'exchange';
  /** Whether the calendar is visible */
  isVisible: boolean;
  /** Whether the calendar allows modifications */
  allowsModifications: boolean;
}

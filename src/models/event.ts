/**
 * Data models for calendar events
 */

/**
 * Represents an attendee of a calendar event
 */
export interface Attendee {
  /** The name of the attendee */
  name: string;
  /** The email address of the attendee */
  email: string;
  /** The response status of the attendee */
  status: 'pending' | 'accepted' | 'declined';
}

/**
 * Represents a recurrence rule for a calendar event
 */
export interface RecurrenceRule {
  /** The frequency of recurrence */
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** The interval between occurrences */
  interval: number;
  /** The end date for the recurrence (optional) */
  endDate?: Date;
  /** The number of occurrences (optional) */
  occurrences?: number;
}

/**
 * Represents a calendar event
 */
export interface CalendarEvent {
  /** The unique identifier of the event */
  id?: string;
  /** The title of the event */
  title: string;
  /** The description of the event */
  description?: string;
  /** The start date and time of the event */
  startDate: Date;
  /** The end date and time of the event */
  endDate: Date;
  /** Whether the event is all-day */
  isAllDay: boolean;
  /** The location of the event */
  location?: string;
  /** The attendees of the event */
  attendees?: Attendee[];
  /** The ID of the calendar this event belongs to */
  calendarId: string;
  /** The recurrence rule for the event (optional) */
  recurrenceRule?: RecurrenceRule;
  /** The URL associated with the event */
  url?: string;
  /** Additional notes for the event */
  notes?: string;
  /** The creation date of the event */
  createdAt?: Date;
  /** The last update date of the event */
  updatedAt?: Date;
}

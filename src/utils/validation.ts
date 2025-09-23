/**
 * Validation functions for data models
 */

import { CalendarEvent, Attendee, RecurrenceRule } from '../models/event';
import { Calendar } from '../models/calendar';

/**
 * Validates a CalendarEvent object
 */
export function validateCalendarEvent(event: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!event.title || typeof event.title !== 'string') {
    errors.push('Event title is required and must be a string');
  }

  if (!event.startDate || !(event.startDate instanceof Date)) {
    errors.push('Event startDate is required and must be a Date object');
  }

  if (!event.endDate || !(event.endDate instanceof Date)) {
    errors.push('Event endDate is required and must be a Date object');
  }

  if (event.startDate && event.endDate && event.startDate >= event.endDate) {
    errors.push('Event startDate must be before endDate');
  }

  if (event.attendees) {
    for (const attendee of event.attendees) {
      const attendeeValidation = validateAttendee(attendee);
      if (!attendeeValidation.isValid) {
        errors.push(...attendeeValidation.errors.map(e => `Attendee validation error: ${e}`));
      }
    }
  }

  if (event.recurrenceRule) {
    const recurrenceValidation = validateRecurrenceRule(event.recurrenceRule);
    if (!recurrenceValidation.isValid) {
      errors.push(...recurrenceValidation.errors.map(e => `Recurrence rule validation error: ${e}`));
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates an Attendee object
 */
export function validateAttendee(attendee: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!attendee.name || typeof attendee.name !== 'string') {
    errors.push('Attendee name is required and must be a string');
  }

  if (!attendee.email || typeof attendee.email !== 'string') {
    errors.push('Attendee email is required and must be a string');
  }

  if (attendee.status && !['pending', 'accepted', 'declined'].includes(attendee.status)) {
    errors.push('Attendee status must be one of: pending, accepted, declined');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a RecurrenceRule object
 */
export function validateRecurrenceRule(rule: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rule.frequency || !['daily', 'weekly', 'monthly', 'yearly'].includes(rule.frequency)) {
    errors.push('Recurrence frequency must be one of: daily, weekly, monthly, yearly');
  }

  if (!rule.interval || typeof rule.interval !== 'number' || rule.interval < 1) {
    errors.push('Recurrence interval must be a positive number');
  }

  if (rule.endDate && !(rule.endDate instanceof Date)) {
    errors.push('Recurrence endDate must be a Date object');
  }

  if (rule.occurrences && (typeof rule.occurrences !== 'number' || rule.occurrences < 1)) {
    errors.push('Recurrence occurrences must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a Calendar object
 */
export function validateCalendar(calendar: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!calendar.id || typeof calendar.id !== 'string') {
    errors.push('Calendar id is required and must be a string');
  }

  if (!calendar.title || typeof calendar.title !== 'string') {
    errors.push('Calendar title is required and must be a string');
  }

  if (calendar.color && typeof calendar.color !== 'string') {
    errors.push('Calendar color must be a string');
  }

  if (calendar.type && !['local', 'subscribed', 'caldav', 'exchange'].includes(calendar.type)) {
    errors.push('Calendar type must be one of: local, subscribed, caldav, exchange');
  }

  if (typeof calendar.isVisible !== 'boolean') {
    errors.push('Calendar isVisible must be a boolean');
  }

  if (typeof calendar.allowsModifications !== 'boolean') {
    errors.push('Calendar allowsModifications must be a boolean');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

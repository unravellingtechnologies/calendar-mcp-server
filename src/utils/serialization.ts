/**
 * Serialization utilities for converting between EventKit objects and data models
 */

import { CalendarEvent, Attendee, RecurrenceRule } from '../models/event';
import { Calendar as CalendarModel } from '../models/calendar';

/**
 * Converts an EventKit event object to our CalendarEvent model
 */
export function eventKitEventToCalendarEvent(eventKitEvent: any): CalendarEvent {
  return {
    id: eventKitEvent.id,
    title: eventKitEvent.title,
    description: eventKitEvent.notes,
    startDate: new Date(eventKitEvent.startDate),
    endDate: new Date(eventKitEvent.endDate),
    isAllDay: eventKitEvent.isAllDay || false,
    location: eventKitEvent.location,
    attendees: eventKitEvent.attendees?.map((a: any) => ({
      name: a.name,
      email: a.email,
      status: a.status
    })),
    calendarId: eventKitEvent.calendarId,
    recurrenceRule: eventKitEvent.recurrenceRule ? {
      frequency: eventKitEvent.recurrenceRule.frequency,
      interval: eventKitEvent.recurrenceRule.interval,
      endDate: eventKitEvent.recurrenceRule.endDate ? new Date(eventKitEvent.recurrenceRule.endDate) : undefined,
      occurrences: eventKitEvent.recurrenceRule.occurrences
    } : undefined,
    url: eventKitEvent.url,
    notes: eventKitEvent.notes,
    createdAt: eventKitEvent.createdAt ? new Date(eventKitEvent.createdAt) : undefined,
    updatedAt: eventKitEvent.updatedAt ? new Date(eventKitEvent.updatedAt) : undefined
  };
}

/**
 * Converts our CalendarEvent model to an EventKit event object
 */
export function calendarEventToEventKitEvent(calendarEvent: CalendarEvent): any {
  return {
    id: calendarEvent.id,
    title: calendarEvent.title,
    notes: calendarEvent.description,
    startDate: calendarEvent.startDate.getTime(),
    endDate: calendarEvent.endDate.getTime(),
    isAllDay: calendarEvent.isAllDay,
    location: calendarEvent.location,
    attendees: calendarEvent.attendees?.map(a => ({
      name: a.name,
      email: a.email,
      status: a.status
    })),
    calendarId: calendarEvent.calendarId,
    recurrenceRule: calendarEvent.recurrenceRule ? {
      frequency: calendarEvent.recurrenceRule.frequency,
      interval: calendarEvent.recurrenceRule.interval,
      endDate: calendarEvent.recurrenceRule.endDate?.getTime(),
      occurrences: calendarEvent.recurrenceRule.occurrences
    } : undefined,
    url: calendarEvent.url,
    createdAt: calendarEvent.createdAt?.getTime(),
    updatedAt: calendarEvent.updatedAt?.getTime()
  };
}

/**
 * Converts an EventKit calendar object to our Calendar model
 */
export function eventKitCalendarToCalendar(eventKitCalendar: any): CalendarModel {
  return {
    id: eventKitCalendar.id,
    title: eventKitCalendar.title,
    color: eventKitCalendar.color,
    type: eventKitCalendar.type || 'local',
    isVisible: eventKitCalendar.isVisible !== false,
    allowsModifications: !eventKitCalendar.isReadOnly
  };
}

/**
 * Converts our Calendar model to an EventKit calendar object
 */
export function calendarToEventKitCalendar(calendar: CalendarModel): any {
  return {
    id: calendar.id,
    title: calendar.title,
    color: calendar.color,
    type: calendar.type,
    isVisible: calendar.isVisible,
    isReadOnly: !calendar.allowsModifications
  };
}

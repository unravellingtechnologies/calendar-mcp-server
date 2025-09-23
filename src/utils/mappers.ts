/**
 * Mapper functions to convert between MCP tool parameters and data models
 */

import { CalendarEvent, Attendee, RecurrenceRule } from '../models/event';
import { Calendar } from '../models/calendar';

/**
 * Maps MCP tool parameters to a CalendarEvent object
 */
export function mapMCPParamsToCalendarEvent(params: any): CalendarEvent {
  return {
    id: params.id,
    title: params.title,
    description: params.description,
    startDate: params.startDate ? new Date(params.startDate) : new Date(),
    endDate: params.endDate ? new Date(params.endDate) : new Date(),
    isAllDay: params.isAllDay || false,
    location: params.location,
    attendees: params.attendees?.map((a: any) => ({
      name: a.name,
      email: a.email,
      status: a.status || 'pending'
    })),
    calendarId: params.calendarId,
    recurrenceRule: params.recurrenceRule ? {
      frequency: params.recurrenceRule.frequency,
      interval: params.recurrenceRule.interval,
      endDate: params.recurrenceRule.endDate ? new Date(params.recurrenceRule.endDate) : undefined,
      occurrences: params.recurrenceRule.occurrences
    } : undefined,
    url: params.url,
    notes: params.notes,
    createdAt: params.createdAt ? new Date(params.createdAt) : undefined,
    updatedAt: params.updatedAt ? new Date(params.updatedAt) : undefined
  };
}

/**
 * Maps a CalendarEvent object to MCP tool parameters
 */
export function mapCalendarEventToMCPParams(event: CalendarEvent): any {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    isAllDay: event.isAllDay,
    location: event.location,
    attendees: event.attendees?.map(a => ({
      name: a.name,
      email: a.email,
      status: a.status
    })),
    calendarId: event.calendarId,
    recurrenceRule: event.recurrenceRule ? {
      frequency: event.recurrenceRule.frequency,
      interval: event.recurrenceRule.interval,
      endDate: event.recurrenceRule.endDate?.toISOString(),
      occurrences: event.recurrenceRule.occurrences
    } : undefined,
    url: event.url,
    notes: event.notes,
    createdAt: event.createdAt?.toISOString(),
    updatedAt: event.updatedAt?.toISOString()
  };
}

/**
 * Maps MCP tool parameters to a Calendar object
 */
export function mapMCPParamsToCalendar(params: any): Calendar {
  return {
    id: params.id,
    title: params.title,
    color: params.color,
    type: params.type || 'local',
    isVisible: params.isVisible !== false,
    allowsModifications: params.allowsModifications !== false
  };
}

/**
 * Maps a Calendar object to MCP tool parameters
 */
export function mapCalendarToMCPParams(calendar: Calendar): any {
  return {
    id: calendar.id,
    title: calendar.title,
    color: calendar.color,
    type: calendar.type,
    isVisible: calendar.isVisible,
    allowsModifications: calendar.allowsModifications
  };
}

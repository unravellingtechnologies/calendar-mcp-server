import { CalendarProvider, Calendar, CalendarEvent, EventInput, CalendarProviderInfo, CalendarProviderError } from './CalendarProvider.js';
import { logger } from '../utils/logger.js';

import bindings from 'bindings';
const eventkit = bindings('eventkit');

export class EventKitProvider extends CalendarProvider {
  private initialized = false;

  getProviderInfo(): CalendarProviderInfo {
    return {
      name: 'eventkit',
      displayName: 'Apple EventKit',
      version: '1.0.0',
      capabilities: {
        canCreateEvents: true,
        canUpdateEvents: true,
        canDeleteEvents: true,
        canCreateCalendars: false,
        canDeleteCalendars: false,
        supportsRecurrence: true,
        supportsAttendees: true,
        supportsReminders: true,
        requiresAuthentication: false, // Uses system permissions
      }
    };
  }

  async initialize(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new CalendarProviderError('EventKit is only available on macOS', this.getProviderInfo().name);
    }
    this.initialized = true;
    logger.info('EventKitProvider initialized');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async requestAccess(): Promise<boolean> {
    try {
      return await eventkit.requestAccess();
    } catch (error) {
      throw new CalendarProviderError('Failed to request access', this.getProviderInfo().name, 'ACCESS_ERROR', error instanceof Error ? error : undefined);
    }
  }

  async hasAccess(): Promise<boolean> {
    return eventkit.hasAccess();
  }

  async getAuthorizationStatus(): Promise<{
    status: number;
    statusString: string;
    hasAccess: boolean;
  }> {
    return eventkit.getAuthorizationStatus();
  }

  async getCalendars(): Promise<Calendar[]> {
    if (!this.hasAccess()) {
      throw new CalendarProviderError('No access to calendars', this.getProviderInfo().name, 'ACCESS_DENIED');
    }
    return eventkit.getCalendars();
  }

  async getEvents(startDate: Date, endDate: Date, calendarIds?: string[]): Promise<CalendarEvent[]> {
    if (!await this.hasAccess()) {
      throw new CalendarProviderError('No access to events', this.getProviderInfo().name, 'ACCESS_DENIED');
    }
    logger.info('Calling native getEvents', { start: startDate.toISOString(), end: endDate.toISOString(), calendarIds });
    const rawEvents = await eventkit.getEvents(startDate.getTime(), endDate.getTime());
    logger.info(`Native module returned ${rawEvents.length} events.`);
    logger.debug('Raw events from native module:', JSON.stringify(rawEvents, null, 2));

    const allEvents: CalendarEvent[] = rawEvents.map((ev: any) => ({
        ...ev,
        startDate: new Date(ev.startDate),
        endDate: new Date(ev.endDate)
    }));

    if (calendarIds && calendarIds.length > 0) {
      const filteredEvents = allEvents.filter((ev: CalendarEvent) => calendarIds.includes(ev.calendarId));
       logger.info(`Filtered down to ${filteredEvents.length} events for the specified calendars.`);
      return filteredEvents;
    }
    return allEvents;
  }

  async createEvent(calendarId: string, event: EventInput): Promise<CalendarEvent> {
    if (!await this.hasAccess()) {
      throw new CalendarProviderError('No access to create events', this.getProviderInfo().name, 'ACCESS_DENIED');
    }
    
    const eventDataForNative = {
        title: event.title,
        startDate: event.startDate.getTime(),
        endDate: event.endDate.getTime(),
        location: event.location,
        notes: event.notes,
        isAllDay: event.isAllDay
    };

    const rawEvent = await eventkit.createEvent(calendarId, eventDataForNative);
    
    return {
        ...rawEvent,
        startDate: new Date(rawEvent.startDate),
        endDate: new Date(rawEvent.endDate)
    };
  }

  async updateEvent(_eventId: string, _event: Partial<EventInput>): Promise<CalendarEvent> {
    throw new CalendarProviderError('Updating events is not yet implemented for EventKit', this.getProviderInfo().name, 'NOT_IMPLEMENTED');
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    if (!this.hasAccess()) {
      throw new CalendarProviderError('No access to delete events', this.getProviderInfo().name, 'ACCESS_DENIED');
    }
    return eventkit.deleteEvent(eventId);
  }

  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    if (!this.hasAccess()) {
      throw new CalendarProviderError('No access to events', this.getProviderInfo().name, 'ACCESS_DENIED');
    }
    return eventkit.getEvent(eventId);
  }

  async searchEvents(query: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    if (!this.hasAccess()) {
      throw new CalendarProviderError('No access to search events', this.getProviderInfo().name, 'ACCESS_DENIED');
    }
    // Implement search logic, possibly filtering getEvents results
    const events = await this.getEvents(startDate || new Date(), endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    return events.filter(ev => ev.title.toLowerCase().includes(query.toLowerCase()) || ev.notes?.toLowerCase().includes(query.toLowerCase()));
  }

  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('EventKitProvider disposed');
  }
}

/**
 * MCP Tool for creating a new calendar event
 */

// MCP types - will be defined locally until package is available
interface MCPTool {
  name: string;
  description: string;
  schema: any;
  execute: (request: MCPRequest) => Promise<MCPResponse>;
}

interface MCPRequest {
  params: any;
}

interface MCPResponse {
  status: 'success' | 'error';
  result?: any;
  error?: string;
}

import { CalendarProviderManager } from '../providers/CalendarProviderManager.js';
import { logger } from '../utils/logger.js';
import { validateCalendarEvent } from '../utils/validation.js';
import { mapMCPParamsToCalendarEvent, mapCalendarEventToMCPParams } from '../utils/mappers.js';
import { EventInput } from '../providers/CalendarProvider.js';

const providerManager = new CalendarProviderManager();

const createEventSchema = {
  type: 'object',
  properties: {
    calendarId: { 
      type: 'string',
      description: 'The ID of the calendar to create the event in'
    },
    title: { 
      type: 'string',
      description: 'The title of the event'
    },
    startDate: { 
      type: 'string', 
      format: 'date-time',
      description: 'Start date of the event (ISO 8601 format)'
    },
    endDate: { 
      type: 'string', 
      format: 'date-time',
      description: 'End date of the event (ISO 8601 format)'
    },
    description: { 
      type: 'string',
      description: 'Optional description or notes for the event'
    },
    location: { 
      type: 'string',
      description: 'Optional location of the event'
    },
    isAllDay: { 
      type: 'boolean',
      description: 'Optional flag for all-day events'
    }
  },
  required: ['calendarId', 'title', 'startDate', 'endDate']
};

const createEventTool: MCPTool = {
  name: 'create_event',
  description: 'Create a new calendar event in a specified calendar',
  schema: createEventSchema,
  execute: async (request: MCPRequest): Promise<MCPResponse> => {
    try {
      const { calendarId, ...eventParams } = request.params;
      
      const eventToCreate = mapMCPParamsToCalendarEvent({ calendarId, ...eventParams });

      const { isValid, errors } = validateCalendarEvent(eventToCreate);
      if (!isValid) {
        return {
          status: 'error',
          error: `Invalid event data: ${errors.join(', ')}`
        };
      }
      
      const provider = providerManager.getDefaultProvider();
      if (!provider) {
        return {
          status: 'error',
          error: 'No calendar provider available. Please ensure a provider is configured.'
        };
      }
      
      if (!await provider.hasAccess()) {
        return {
          status: 'error',
          error: 'No access to calendar data. Please grant calendar permissions.'
        };
      }
      
      const eventInput: EventInput = {
        title: eventToCreate.title,
        startDate: eventToCreate.startDate,
        endDate: eventToCreate.endDate,
        notes: eventToCreate.description,
        location: eventToCreate.location,
        isAllDay: eventToCreate.isAllDay || false,
        attendees: eventToCreate.attendees
      };
      
      const createdEvent = await provider.createEvent(calendarId, eventInput);
      
      const mcpEvent = mapCalendarEventToMCPParams({
        ...createdEvent,
        isAllDay: createdEvent.isAllDay || false,
      });
      
      logger.info('Successfully created event', { eventId: mcpEvent.id, title: mcpEvent.title });
      
      return {
        status: 'success',
        result: mcpEvent
      };
      
    } catch (error) {
      logger.error('Error creating event:', error);
      return {
        status: 'error',
        error: `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

export default createEventTool;

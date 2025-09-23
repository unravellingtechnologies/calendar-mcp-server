/**
 * MCP Tool for reading and fetching calendar events
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
import { getCachedEvents, setCachedEvents, CacheKey, isCacheEnabled } from '../utils/cache.js';

const providerManager = new CalendarProviderManager();

const getEventsSchema = {
  type: 'object',
  properties: {
    startDate: { 
      type: 'string', 
      format: 'date-time',
      description: 'Start date for the event query (ISO 8601 format)'
    },
    endDate: { 
      type: 'string', 
      format: 'date-time',
      description: 'End date for the event query (ISO 8601 format)'
    },
    calendarIds: { 
      type: 'array', 
      items: { type: 'string' },
      description: 'Optional array of calendar IDs to filter events by'
    },
    limit: { 
      type: 'number',
      description: 'Optional limit on the number of events to return'
    },
    page: {
      type: 'number',
      description: 'Optional page number for pagination (1-based)'
    },
    pageSize: {
      type: 'number',
      description: 'Optional page size for pagination (default: 50)'
    },
    title: {
      type: 'string',
      description: 'Optional filter by event title (partial match)'
    },
    location: {
      type: 'string',
      description: 'Optional filter by event location (partial match)'
    },
    sortBy: {
      type: 'string',
      enum: ['startDate', 'endDate', 'title'],
      description: 'Optional sorting field (default: startDate)'
    },
    sortOrder: {
      type: 'string',
      enum: ['asc', 'desc'],
      description: 'Optional sort order (default: asc)'
    }
  },
  required: ['startDate', 'endDate']
};

const getEventsTool: MCPTool = {
  name: 'get_events',
  description: 'Fetch calendar events within a specified date range with optional filtering and sorting',
  schema: getEventsSchema,
  execute: async (request: MCPRequest): Promise<MCPResponse> => {
    try {
      const { startDate, endDate, calendarIds, limit, title, location, sortBy, sortOrder, page, pageSize } = request.params;
      
      // Parse and validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          status: 'error',
          error: 'Invalid date format. Please use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)'
        };
      }
      
      if (start >= end) {
        return {
          status: 'error',
          error: 'Start date must be before end date'
        };
      }
      
      // Get the default provider
      const provider = providerManager.getDefaultProvider();
      if (!provider) {
        return {
          status: 'error',
          error: 'No calendar provider available. Please ensure a provider is configured.'
        };
      }
      
      // Check if provider has access
      if (!(await provider.hasAccess())) {
        return {
          status: 'error',
          error: 'No access to calendar data. Please grant calendar permissions.'
        };
      }
      
      // Check cache first
      let events;
      const cacheKey: CacheKey = {
        provider: provider.getProviderInfo().name,
        startDate: startDate,
        endDate: endDate,
        calendarIds,
        filters: { title, location }
      };
      
      if (isCacheEnabled()) {
        const cachedEvents = getCachedEvents(cacheKey);
        if (cachedEvents) {
          logger.info('Using cached events', { count: cachedEvents.length });
          events = cachedEvents;
        }
      }
      
      // Fetch from provider if not cached
      if (!events) {
        events = await provider.getEvents(start, end, calendarIds);
        
        // Cache the results
        if (isCacheEnabled()) {
          setCachedEvents(cacheKey, events);
          logger.info('Cached events', { count: events.length });
        }
      }
      
      // Apply filters
      let filteredEvents = events;
      
      if (title) {
        filteredEvents = filteredEvents.filter(event => 
          event.title.toLowerCase().includes(title.toLowerCase())
        );
      }
      
      if (location) {
        filteredEvents = filteredEvents.filter(event => 
          event.location && event.location.toLowerCase().includes(location.toLowerCase())
        );
      }
      
      // Apply sorting
      const sortField = sortBy || 'startDate';
      const order = sortOrder || 'asc';
      
      filteredEvents.sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortField) {
          case 'startDate':
            aValue = new Date(a.startDate).getTime();
            bValue = new Date(b.startDate).getTime();
            break;
          case 'endDate':
            aValue = new Date(a.endDate).getTime();
            bValue = new Date(b.endDate).getTime();
            break;
          case 'title':
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          default:
            aValue = new Date(a.startDate).getTime();
            bValue = new Date(b.startDate).getTime();
        }
        
        if (order === 'desc') {
          return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
        } else {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        }
      });
      
      // Apply pagination or limit
      let finalEvents = filteredEvents;
      
      if (page && pageSize) {
        // Pagination
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        finalEvents = filteredEvents.slice(startIndex, endIndex);
      } else if (limit) {
        // Simple limit
        finalEvents = filteredEvents.slice(0, limit);
      }
      
      // Convert to MCP format
      const mcpEvents = finalEvents.map(event => mapCalendarEventToMCPParams(event));
      
      logger.info('Successfully fetched events', { 
        count: mcpEvents.length,
        dateRange: { start: startDate, end: endDate },
        filters: { title, location, calendarIds }
      });
      
      return {
        status: 'success',
        result: {
          events: mcpEvents,
          totalCount: filteredEvents.length,
          returnedCount: mcpEvents.length,
          dateRange: { start: startDate, end: endDate },
          appliedFilters: { title, location, calendarIds },
          sortBy: sortField,
          sortOrder: order,
          pagination: page && pageSize ? {
            page,
            pageSize,
            totalPages: Math.ceil(filteredEvents.length / pageSize),
            hasNextPage: page * pageSize < filteredEvents.length,
            hasPreviousPage: page > 1
          } : undefined
        }
      };
      
    } catch (error) {
      logger.error('Error fetching events:', error);
      return {
        status: 'error',
        error: `Failed to fetch events: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

export default getEventsTool;

/**
 * Calendar Tools Unit Tests
 * Tests the calendar tools functionality without requiring real credentials
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarProviderManager } from '../src/providers/CalendarProviderManager.js';
import { createCalendarTools } from '../src/tools/calendar-tools.js';
import { Logger } from '../src/utils/logger.js';

// Mock the CalDAV provider to avoid real network calls
vi.mock('../src/providers/CalDAVProvider.js', () => ({
  CalDAVProvider: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getProviderInfo: vi.fn().mockReturnValue({
      displayName: 'Mock CalDAV Provider',
      version: '1.0.0',
      capabilities: ['read', 'write']
    }),
    getCalendars: vi.fn().mockResolvedValue([
      {
        id: 'calendar-1',
        name: 'Personal',
        description: 'Personal calendar',
        color: '#007AFF'
      },
      {
        id: 'calendar-2', 
        name: 'Work',
        description: 'Work calendar',
        color: '#FF3B30'
      }
    ]),
    getEvents: vi.fn().mockResolvedValue([
      {
        id: 'event-1',
        title: 'Team Meeting',
        description: 'Weekly team sync',
        startDate: '2024-09-22T10:00:00Z',
        endDate: '2024-09-22T11:00:00Z',
        location: 'Conference Room A',
        attendees: ['john@example.com', 'jane@example.com']
      },
      {
        id: 'event-2',
        title: 'Lunch Break',
        description: 'Time for lunch',
        startDate: '2024-09-22T12:00:00Z',
        endDate: '2024-09-22T13:00:00Z',
        location: 'Cafeteria'
      }
    ]),
    requestAccess: vi.fn().mockResolvedValue(true),
    hasAccess: vi.fn().mockResolvedValue(true),
    dispose: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('Calendar Tools Tests', () => {
  let providerManager: CalendarProviderManager;
  let logger: Logger;

  beforeEach(() => {
    // Create a mock logger that doesn't output to console during tests
    logger = new Logger({ 
      level: 3, // ERROR level to reduce noise
      enableColors: false,
      enableTimestamp: false 
    });

    // Create provider manager
    providerManager = new CalendarProviderManager();
  });

  it('should create all required calendar tools', () => {
    const tools = createCalendarTools({
      providerManager,
      logger
    });

    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(7); // Should have 7 tools

    // Check that all expected tools are present
    const toolNames = tools.map(tool => tool.name);
    const expectedTools = [
      'request_calendar_access',
      'check_calendar_authorization', 
      'get_calendars',
      'get_calendar_events',
      'list_calendar_providers',
      'switch_calendar_provider',
      'health_check'
    ];

    expectedTools.forEach(expectedTool => {
      expect(toolNames).toContain(expectedTool);
    });
  });

  it('should handle health check without providers', async () => {
    const tools = createCalendarTools({
      providerManager,
      logger
    });

    const healthTool = tools.find(tool => tool.name === 'health_check');
    expect(healthTool).toBeDefined();

    if (healthTool) {
      const result = await healthTool.handler({});
      
      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(Array.isArray(result.providers)).toBe(true);
      expect(result.providers.length).toBe(0); // No providers registered
    }
  });

  it('should handle calendar access request without providers', async () => {
    const tools = createCalendarTools({
      providerManager,
      logger
    });

    const accessTool = tools.find(tool => tool.name === 'request_calendar_access');
    expect(accessTool).toBeDefined();

    if (accessTool) {
      const result = await accessTool.handler({});
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('granted');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('provider');
      
      // Without providers, access should be denied
      expect(result.granted).toBe(false);
      expect(result.message).toContain('denied');
    }
  });

  it('should handle authorization check without providers', async () => {
    const tools = createCalendarTools({
      providerManager,
      logger
    });

    const authTool = tools.find(tool => tool.name === 'check_calendar_authorization');
    expect(authTool).toBeDefined();

    if (authTool) {
      const result = await authTool.handler({});
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('hasAccess');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('message');
      
      // Without providers, access should be false
      expect(result.hasAccess).toBe(false);
    }
  });

  it('should handle provider listing without providers', async () => {
    const tools = createCalendarTools({
      providerManager,
      logger
    });

    const providersTool = tools.find(tool => tool.name === 'list_calendar_providers');
    expect(providersTool).toBeDefined();

    if (providersTool) {
      const result = await providersTool.handler({});
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('providers');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('defaultProvider');
      
      expect(Array.isArray(result.providers)).toBe(true);
      expect(result.count).toBe(0);
      expect(result.defaultProvider).toBeNull();
    }
  });

  it('should demonstrate how to get today\'s events with mock data', async () => {
    // Import the mocked CalDAV provider
    const { CalDAVProvider } = await import('../src/providers/CalDAVProvider.js');
    
    // Register a mock provider
    const mockProvider = new CalDAVProvider({
      credentials: {
        serverUrl: 'https://mock.example.com',
        username: 'test@example.com',
        password: 'mock-password',
        serverType: 'generic'
      },
      timeout: 5000,
      enableCache: false
    });

    await providerManager.registerProvider(mockProvider);
    providerManager.setDefaultProvider('caldav-generic');

    const tools = createCalendarTools({
      providerManager,
      logger
    });

    const eventsTool = tools.find(tool => tool.name === 'get_calendar_events');
    expect(eventsTool).toBeDefined();

    if (eventsTool) {
      // Create date range for today
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const eventArgs = {
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
        calendarIds: null
      };

      const result = await eventsTool.handler(eventArgs);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('dateRange');
      expect(result).toHaveProperty('provider');
      
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.count).toBe(2); // Mock returns 2 events
      expect(result.events[0].title).toBe('Team Meeting');
      expect(result.events[1].title).toBe('Lunch Break');
      
      console.log('📅 Mock calendar events for today:');
      result.events.forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.title}`);
        console.log(`     Start: ${new Date(event.startDate).toLocaleString()}`);
        console.log(`     End: ${new Date(event.endDate).toLocaleString()}`);
        if (event.location) {
          console.log(`     Location: ${event.location}`);
        }
      });
    }
  });

  it('should demonstrate calendar listing with mock data', async () => {
    // Import the mocked CalDAV provider
    const { CalDAVProvider } = await import('../src/providers/CalDAVProvider.js');
    
    // Register a mock provider
    const mockProvider = new CalDAVProvider({
      credentials: {
        serverUrl: 'https://mock.example.com',
        username: 'test@example.com',
        password: 'mock-password',
        serverType: 'generic'
      },
      timeout: 5000,
      enableCache: false
    });

    await providerManager.registerProvider(mockProvider);
    providerManager.setDefaultProvider('caldav-generic');

    const tools = createCalendarTools({
      providerManager,
      logger
    });

    const calendarsTool = tools.find(tool => tool.name === 'get_calendars');
    expect(calendarsTool).toBeDefined();

    if (calendarsTool) {
      const result = await calendarsTool.handler({});
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('calendars');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('provider');
      
      expect(Array.isArray(result.calendars)).toBe(true);
      expect(result.count).toBe(2); // Mock returns 2 calendars
      expect(result.calendars[0].name).toBe('Personal');
      expect(result.calendars[1].name).toBe('Work');
      
      console.log('📋 Mock calendars:');
      result.calendars.forEach((calendar, index) => {
        console.log(`  ${index + 1}. ${calendar.name} (${calendar.color})`);
        console.log(`     Description: ${calendar.description}`);
      });
    }
  });
});

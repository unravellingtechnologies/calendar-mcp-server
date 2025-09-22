/**
 * Calendar Tools Factory
 * Creates MCP tool definitions for calendar operations
 */

import { CalendarProviderManager } from '../providers/CalendarProviderManager.js';
import { Logger } from '../utils/logger.js';
import { MCPTool } from '../server/index.js';

export interface CalendarToolsConfig {
	providerManager: CalendarProviderManager;
	logger: Logger;
	server?: {
		getToolCount(): number;
	};
}

export interface CalendarAccessResponse {
	granted: boolean;
	message: string;
	provider: string;
}

export interface CalendarAuthorizationResponse {
	hasAccess: boolean;
	provider: string;
	message: string;
}

export interface CalendarsResponse {
	calendars: any[];
	count: number;
	provider: string;
}

export interface CalendarEventsResponse {
	events: any[];
	count: number;
	dateRange: {
		startDate: string;
		endDate: string;
	};
	filteredCalendars: string[] | null;
	provider: string;
}

export interface CalendarProvidersResponse {
	providers: any[];
	count: number;
	defaultProvider: string | null;
}

export interface SwitchProviderResponse {
	success: boolean;
	message: string;
	activeProvider?: any;
	availableProviders?: string[];
}

export interface HealthCheckResponse {
	status: string;
	timestamp: string;
	toolCount: number;
	providers: string[];
}

export interface GetCalendarEventsArgs {
	startDate: string;
	endDate: string;
	calendarIds?: string[];
}

export interface SwitchProviderArgs {
	providerName: string;
}

/**
 * Factory function to create calendar tool definitions
 */
export function createCalendarTools(config: CalendarToolsConfig): MCPTool[] {
	const { providerManager, logger, server } = config;

	return [
		{
			name: 'request_calendar_access',
			description: 'Request permission to access the user\'s calendar data.',
			inputSchema: {
				type: 'object',
				properties: {},
			},
			handler: async (): Promise<CalendarAccessResponse> => {
				logger.info('Requesting calendar access');
				try {
					const granted = await providerManager.requestAccess();
					return {
						granted,
						message: granted ? 'Calendar access granted' : 'Calendar access denied',
						provider: providerManager.getDefaultProvider()?.getProviderInfo().displayName || 'Unknown',
					};
				} catch (_error) {
					return {
						granted: false,
						message: 'Calendar access denied - no providers available',
						provider: 'None',
					};
				}
			},
		},
		{
			name: 'check_calendar_authorization',
			description: 'Check the current calendar authorization status without requesting permission.',
			inputSchema: {
				type: 'object',
				properties: {},
			},
			handler: async (): Promise<CalendarAuthorizationResponse> => {
				logger.info('Checking calendar authorization status');
				try {
					const provider = providerManager.getDefaultProvider();
					const hasAccess = await providerManager.hasAccess();
					return {
						hasAccess,
						provider: provider?.getProviderInfo().displayName || 'Unknown',
						message: hasAccess 
							? 'Calendar access is granted'
							: 'Calendar access is not available - permission may be required',
					};
				} catch (_error) {
					return {
						hasAccess: false,
						provider: 'None',
						message: 'Calendar access is not available - no providers configured',
					};
				}
			},
		},
		{
			name: 'get_calendars',
			description: 'Retrieve all available calendars from the user\'s calendar application.',
			inputSchema: {
				type: 'object',
				properties: {},
			},
			handler: async (): Promise<CalendarsResponse> => {
				logger.info('Getting calendars');
				const calendars = await providerManager.getCalendars();
				return {
					calendars,
					count: calendars.length,
					provider: providerManager.getDefaultProvider()?.getProviderInfo().displayName || 'Unknown',
				};
			},
		},
		{
			name: 'get_calendar_events',
			description: 'Retrieve calendar events within a specified date range, optionally filtered by calendar IDs.',
			inputSchema: {
				type: 'object',
				properties: {
					startDate: {
						type: 'string',
						description: 'The start date for fetching events, in ISO 8601 format (e.g., "2024-01-01T00:00:00.000Z").',
					},
					endDate: {
						type: 'string',
						description: 'The end date for fetching events, in ISO 8601 format (e.g., "2024-01-31T23:59:59.999Z").',
					},
					calendarIds: {
						type: 'array',
						items: {
							type: 'string',
						},
						description: 'Optional array of calendar IDs to filter events. If not provided, events from all calendars will be returned.',
					},
				},
				required: ['startDate', 'endDate'],
			},
			handler: async (args: GetCalendarEventsArgs): Promise<CalendarEventsResponse> => {
				logger.info('Getting calendar events', { args });
				const startDate = new Date(args.startDate);
				const endDate = new Date(args.endDate);
				
				if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
					throw new Error('Invalid date format. Please use ISO 8601 format.');
				}

				const events = await providerManager.getEvents(startDate, endDate, args.calendarIds);
				return {
					events,
					count: events.length,
					dateRange: {
						startDate: args.startDate,
						endDate: args.endDate,
					},
					filteredCalendars: args.calendarIds || null,
					provider: providerManager.getDefaultProvider()?.getProviderInfo().displayName || 'Unknown',
				};
			},
		},
		{
			name: 'list_calendar_providers',
			description: 'List all available calendar providers and their capabilities.',
			inputSchema: {
				type: 'object',
				properties: {},
			},
			handler: async (): Promise<CalendarProvidersResponse> => {
				logger.info('Listing calendar providers');
				const providers = providerManager.getProvidersInfo();
				const defaultProvider = providerManager.getDefaultProvider();
				
				return {
					providers,
					count: providers.length,
					defaultProvider: defaultProvider?.getProviderInfo().name || null,
				};
			},
		},
		{
			name: 'switch_calendar_provider',
			description: 'Switch the active calendar provider to a different one.',
			inputSchema: {
				type: 'object',
				properties: {
					providerName: {
						type: 'string',
						description: 'The name of the provider to switch to (e.g., "apple", "google", "outlook").',
					},
				},
				required: ['providerName'],
			},
			handler: async (args: SwitchProviderArgs): Promise<SwitchProviderResponse> => {
				logger.info('Switching calendar provider', { targetProvider: args.providerName });
				const success = providerManager.setDefaultProvider(args.providerName);
				
				if (success) {
					const newDefault = providerManager.getDefaultProvider();
					return {
						success: true,
						message: `Successfully switched to ${newDefault?.getProviderInfo().displayName}`,
						activeProvider: newDefault?.getProviderInfo(),
					};
				} else {
					return {
						success: false,
						message: `Provider '${args.providerName}' not found or not registered`,
						availableProviders: providerManager.getProvidersInfo().map(p => p.name),
					};
				}
			},
		},
		{
			name: 'health_check',
			description: 'Performs a health check of the server and returns its status.',
			inputSchema: {
				type: 'object',
				properties: {},
			},
			handler: async (): Promise<HealthCheckResponse> => {
				logger.info('Executing health_check tool');
				return {
					status: 'ok',
					timestamp: new Date().toISOString(),
					toolCount: server?.getToolCount() || 0,
					providers: providerManager.getProvidersInfo().map(info => info.name),
				};
			},
		},
	];
}

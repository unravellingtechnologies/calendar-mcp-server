/**
 * CalDAV Calendar Provider Implementation
 * Supports iCloud, Google Calendar, Exchange, and other CalDAV servers
 */

import { CalendarProvider, Calendar, CalendarEvent, EventInput, CalendarProviderInfo, CalendarProviderError } from './CalendarProvider.js';
import { CalDAVClient } from 'ts-caldav';
import { logger } from '../utils/logger.js';

export interface CalDAVCredentials {
	serverUrl: string;
	username: string;
	password: string; // App-specific password for iCloud, regular password for others
	serverType: 'icloud' | 'google' | 'exchange' | 'generic';
}

export interface CalDAVProviderConfig {
	credentials: CalDAVCredentials;
	timeout?: number;
	enableCache?: boolean;
}

export class CalDAVProvider extends CalendarProvider {
	private client?: CalDAVClient;
	private config: CalDAVProviderConfig;
	private initialized = false;
	private calendars: any[] = [];

	constructor(config: CalDAVProviderConfig) {
		super();
		this.config = config;
	}

	getProviderInfo(): CalendarProviderInfo {
		return {
			name: `caldav-${this.config.credentials.serverType}`,
			displayName: this.getDisplayName(),
			version: '1.0.0',
			capabilities: {
				canCreateEvents: true,
				canUpdateEvents: true,
				canDeleteEvents: true,
				canCreateCalendars: false, // Most CalDAV servers don't allow calendar creation
				canDeleteCalendars: false,
				supportsRecurrence: true,
				supportsAttendees: true,
				supportsReminders: true,
				requiresAuthentication: true,
			},
		};
	}

	private getDisplayName(): string {
		switch (this.config.credentials.serverType) {
			case 'icloud':
				return 'iCloud Calendar';
			case 'google':
				return 'Google Calendar';
			case 'exchange':
				return 'Exchange Calendar';
			default:
				return 'CalDAV Calendar';
		}
	}

	async initialize(): Promise<void> {
		try {
			logger.info('Initializing CalDAV provider', { 
				serverType: this.config.credentials.serverType,
				serverUrl: this.config.credentials.serverUrl 
			});

			// Create CalDAV client using ts-caldav
			this.client = await CalDAVClient.create({
				baseUrl: this.config.credentials.serverUrl,
				auth: {
					type: 'basic',
					username: this.config.credentials.username,
					password: this.config.credentials.password,
				},
			});

			// Test connection by trying to fetch calendars
			const testCalendars = await this.client.getCalendars();
			logger.debug('CalDAV connection established', { calendarCount: testCalendars.length });

			this.initialized = true;
			logger.info('CalDAV provider initialized successfully', { 
				serverType: this.config.credentials.serverType 
			});

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Failed to initialize CalDAV provider', { 
				error: errorMessage,
				serverType: this.config.credentials.serverType 
			});
			throw new CalendarProviderError(
				`Failed to initialize CalDAV provider: ${errorMessage}`,
				`caldav-${this.config.credentials.serverType}`,
				'INIT_ERROR',
				error instanceof Error ? error : undefined
			);
		}
	}

	isInitialized(): boolean {
		return this.initialized && !!this.client;
	}

	async requestAccess(): Promise<boolean> {
		// CalDAV doesn't require permission requests - authentication is handled during initialization
		// If we can initialize successfully, we have access
		if (!this.initialized) {
			await this.initialize();
		}
		return this.initialized;
	}

	async hasAccess(): Promise<boolean> {
		try {
			if (!this.client) {
				return false;
			}

			// Test access by trying to fetch calendars
			await this.client.getCalendars();
			return true;
		} catch (error) {
			logger.debug('CalDAV access check failed', { error });
			return false;
		}
	}

	async getCalendars(): Promise<Calendar[]> {
		try {
			if (!this.client) {
				throw new CalendarProviderError(
					'CalDAV client not initialized',
					`caldav-${this.config.credentials.serverType}`,
					'NOT_INITIALIZED'
				);
			}

			logger.debug('Fetching calendars from CalDAV server');
			const davCalendars = await this.client.getCalendars();

			// Convert to our standard format
			const calendars: Calendar[] = davCalendars.map(cal => ({
				id: cal.url || cal.displayName || 'unknown',
				title: cal.displayName || 'Untitled Calendar',
				color: (cal as any).color, // ts-caldav might have color property
				isReadOnly: false, // ts-caldav doesn't expose this directly
				source: `caldav-${this.config.credentials.serverType}`,
			}));

			logger.debug('Retrieved CalDAV calendars', { 
				count: calendars.length,
				serverType: this.config.credentials.serverType 
			});
			
			return calendars;

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Failed to get CalDAV calendars', { 
				error: errorMessage,
				serverType: this.config.credentials.serverType 
			});
			throw new CalendarProviderError(
				`Failed to get calendars: ${errorMessage}`,
				`caldav-${this.config.credentials.serverType}`,
				'GET_CALENDARS_ERROR',
				error instanceof Error ? error : undefined
			);
		}
	}


	async getEvents(startDate: Date, endDate: Date, calendarIds?: string[]): Promise<CalendarEvent[]> {
		try {
			if (!this.client) {
				throw new CalendarProviderError(
					'CalDAV client not initialized',
					`caldav-${this.config.credentials.serverType}`,
					'NOT_INITIALIZED'
				);
			}

			logger.debug('Fetching events from CalDAV server', {
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
				calendarIds,
				serverType: this.config.credentials.serverType
			});

			const calendars = await this.client.getCalendars();
			const targetCalendars = calendarIds 
				? calendars.filter(cal => {
					const calId = cal.url || cal.displayName || '';
					return calendarIds.includes(calId);
				})
				: calendars;

			const allEvents: CalendarEvent[] = [];

			for (const calendar of targetCalendars) {
				try {
					const events = await this.client.getEvents(calendar.url);

					// Convert ts-caldav events to our format
					for (const event of events) {
						// Filter events by date range
						const eventStart = new Date(event.start);
						const eventEnd = new Date(event.end || event.start);
						
						if (eventEnd >= startDate && eventStart <= endDate) {
							const calendarEvent: CalendarEvent = {
								id: event.uid || `${calendar.url}-${Date.now()}`,
								title: event.summary || 'Untitled Event',
								startDate: eventStart,
								endDate: eventEnd,
								calendarId: calendar.url || calendar.displayName || 'unknown',
								notes: event.description,
								location: event.location,
								isAllDay: !(event.start instanceof Date && event.start.toISOString().includes('T')), // Simple check for all-day events
                                attendees: [] // Attendee parsing not supported in this provider yet
							};
							allEvents.push(calendarEvent);
						}
					}
				} catch (calError) {
					logger.warn('Failed to fetch events from calendar', { 
						calendar: calendar.displayName,
						error: calError 
					});
					// Continue with other calendars
				}
			}

			logger.debug('Retrieved CalDAV events', { 
				count: allEvents.length,
				serverType: this.config.credentials.serverType 
			});

			return allEvents;

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Failed to get CalDAV events', { 
				error: errorMessage,
				serverType: this.config.credentials.serverType 
			});
			throw new CalendarProviderError(
				`Failed to get events: ${errorMessage}`,
				`caldav-${this.config.credentials.serverType}`,
				'GET_EVENTS_ERROR',
				error instanceof Error ? error : undefined
			);
		}
	}


	// Placeholder methods for future implementation
	async createEvent(_calendarId: string, _event: EventInput): Promise<CalendarEvent> {
		throw new CalendarProviderError(
			'Event creation not yet implemented for CalDAV provider',
			`caldav-${this.config.credentials.serverType}`,
			'NOT_IMPLEMENTED'
		);
	}

	async updateEvent(_eventId: string, _event: Partial<EventInput>): Promise<CalendarEvent> {
		throw new CalendarProviderError(
			'Event updating not yet implemented for CalDAV provider',
			`caldav-${this.config.credentials.serverType}`,
			'NOT_IMPLEMENTED'
		);
	}

	async deleteEvent(_eventId: string): Promise<boolean> {
		throw new CalendarProviderError(
			'Event deletion not yet implemented for CalDAV provider',
			`caldav-${this.config.credentials.serverType}`,
			'NOT_IMPLEMENTED'
		);
	}

	async getEvent(_eventId: string): Promise<CalendarEvent | null> {
		throw new CalendarProviderError(
			'Single event retrieval not yet implemented for CalDAV provider',
			`caldav-${this.config.credentials.serverType}`,
			'NOT_IMPLEMENTED'
		);
	}

	async searchEvents(_query: string, _startDate?: Date, _endDate?: Date): Promise<CalendarEvent[]> {
		throw new CalendarProviderError(
			'Event search not yet implemented for CalDAV provider',
			`caldav-${this.config.credentials.serverType}`,
			'NOT_IMPLEMENTED'
		);
	}

	async dispose(): Promise<void> {
		logger.info('Disposing CalDAV provider', { 
			serverType: this.config.credentials.serverType 
		});
		this.client = undefined;
		this.initialized = false;
		this.calendars = [];
	}
}

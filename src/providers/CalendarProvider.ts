/**
 * Base interface for calendar providers
 * This abstraction allows supporting multiple calendar services (Apple Calendar, Outlook, Google Calendar, etc.)
 */

export interface Calendar {
	id: string;
	title: string;
	color?: string;
	isReadOnly?: boolean;
	source?: string;
}

export interface CalendarEvent {
	id: string;
	title: string;
	startDate: string;
	endDate: string;
	notes?: string;
	location?: string;
	calendarId: string;
	isAllDay?: boolean;
	recurrenceRule?: string;
	attendees?: string[];
}

export interface EventInput {
	title: string;
	startDate: Date;
	endDate: Date;
	notes?: string;
	location?: string;
	isAllDay?: boolean;
	recurrenceRule?: string;
	attendees?: string[];
}

export interface CalendarProviderInfo {
	name: string;
	displayName: string;
	version: string;
	capabilities: CalendarProviderCapabilities;
}

export interface CalendarProviderCapabilities {
	canCreateEvents: boolean;
	canUpdateEvents: boolean;
	canDeleteEvents: boolean;
	canCreateCalendars: boolean;
	canDeleteCalendars: boolean;
	supportsRecurrence: boolean;
	supportsAttendees: boolean;
	supportsReminders: boolean;
	requiresAuthentication: boolean;
}

export abstract class CalendarProvider {
	/**
	 * Get provider information
	 */
	abstract getProviderInfo(): CalendarProviderInfo;

	/**
	 * Initialize the provider (authenticate, setup, etc.)
	 */
	abstract initialize(): Promise<void>;

	/**
	 * Check if the provider is properly initialized and ready to use
	 */
	abstract isInitialized(): boolean;

	/**
	 * Request access to calendar data (permissions)
	 */
	abstract requestAccess(): Promise<boolean>;

	/**
	 * Check if access to calendar data is granted
	 */
	abstract hasAccess(): Promise<boolean>;

	/**
	 * Get all available calendars
	 */
	abstract getCalendars(): Promise<Calendar[]>;

	/**
	 * Get events from specific calendars within a date range
	 */
	abstract getEvents(_startDate: Date, _endDate: Date, _calendarIds?: string[]): Promise<CalendarEvent[]>;

	/**
	 * Create a new event in the specified calendar
	 */
	abstract createEvent(_calendarId: string, _event: EventInput): Promise<CalendarEvent>;

	/**
	 * Update an existing event
	 */
	abstract updateEvent(_eventId: string, _event: Partial<EventInput>): Promise<CalendarEvent>;

	/**
	 * Delete an event
	 */
	abstract deleteEvent(_eventId: string): Promise<boolean>;

	/**
	 * Get a specific event by ID
	 */
	abstract getEvent(_eventId: string): Promise<CalendarEvent | null>;

	/**
	 * Search for events by title or content
	 */
	abstract searchEvents(_query: string, _startDate?: Date, _endDate?: Date): Promise<CalendarEvent[]>;

	/**
	 * Clean up resources when the provider is no longer needed
	 */
	abstract dispose(): Promise<void>;
}

export class CalendarProviderError extends Error {
	constructor(
		message: string,
		public providerName: string,
		public code?: string,
		public originalError?: Error
	) {
		super(message);
		this.name = 'CalendarProviderError';
		// Mark unused parameters as used to avoid lint warnings
		void providerName;
		void code;
		void originalError;
	}
}

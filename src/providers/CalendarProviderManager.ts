/**
 * Calendar Provider Manager
 * Manages multiple calendar providers and provides a unified interface
 */

import { CalendarProvider, CalendarProviderInfo, Calendar, CalendarEvent, EventInput, CalendarProviderError } from './CalendarProvider.js';
import { logger } from '../utils/logger.js';
import { EventKitProvider } from './EventKitProvider.js';

export interface ProviderManagerConfig {
	defaultProvider?: string;
	enabledProviders?: string[];
	enableEventKit?: boolean;
}

export class CalendarProviderManager {
	private providers: Map<string, CalendarProvider> = new Map();
	private config: ProviderManagerConfig;
	private defaultProvider?: CalendarProvider;

	constructor(config: ProviderManagerConfig = {}) {
		this.config = config;
	}

	/**
	 * Register a calendar provider
	 */
	async registerProvider(provider: CalendarProvider): Promise<void> {
		try {
			const info = provider.getProviderInfo();
			
			// Check if provider is enabled (if enabledProviders is specified)
			if (this.config.enabledProviders && !this.config.enabledProviders.includes(info.name)) {
				logger.info('Skipping disabled provider', { provider: info.name });
				return;
			}

			// Initialize the provider
			await provider.initialize();

			this.providers.set(info.name, provider);
			logger.info('Registered calendar provider', { 
				name: info.name, 
				displayName: info.displayName,
				version: info.version
			});

			// Set as default if specified in config or if it's the first provider
			if (info.name === this.config.defaultProvider || (!this.defaultProvider && this.providers.size === 1)) {
				this.defaultProvider = provider;
				logger.info('Set default calendar provider', { provider: info.name });
			}

		} catch (error) {
			const providerName = provider.getProviderInfo().name;
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Failed to register provider', { provider: providerName, error: errorMessage });
			throw new CalendarProviderError(
				`Failed to register provider ${providerName}: ${errorMessage}`,
				providerName,
				'REGISTRATION_ERROR',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Register all providers based on configuration
	 */
	async registerProviders(): Promise<void> {
		// Register default providers
		if (this.config.defaultProvider) {
			const defaultProvider = this.providers.get(this.config.defaultProvider);
			if (defaultProvider) {
				this.defaultProvider = defaultProvider;
				logger.info('Set default calendar provider from config', { provider: this.config.defaultProvider });
			} else {
				logger.warn('Default provider not found in registered providers', { provider: this.config.defaultProvider });
			}
		}

		// Register enabled providers
		if (this.config.enabledProviders) {
			for (const providerName of this.config.enabledProviders) {
				const provider = this.providers.get(providerName);
				if (provider) {
					logger.info('Enabling provider from config', { provider: providerName });
					// If a provider is already registered, ensure it's initialized
					if (provider.getProviderInfo().name === this.config.defaultProvider) {
						this.defaultProvider = provider;
						logger.info('Set default calendar provider from enabled providers', { provider: providerName });
					}
				} else {
					logger.warn('Attempted to enable unknown provider from config', { provider: providerName });
				}
			}
		}

		// Register EventKitProvider if enabled
		const enableEventKit = process.env.EVENTKIT_ENABLED === 'true' || this.config.enableEventKit;
		if (enableEventKit && process.platform === 'darwin') {
			await this.registerProvider(new EventKitProvider());
		}
	}

	/**
	 * Get a specific provider by name
	 */
	getProvider(name: string): CalendarProvider | undefined {
		return this.providers.get(name);
	}

	/**
	 * Get the default provider
	 */
	getDefaultProvider(): CalendarProvider | undefined {
		return this.defaultProvider;
	}

	/**
	 * Set the default provider
	 */
	setDefaultProvider(name: string): boolean {
		const provider = this.providers.get(name);
		if (provider) {
			this.defaultProvider = provider;
			logger.info('Changed default calendar provider', { provider: name });
			return true;
		}
		logger.warn('Attempted to set unknown provider as default', { provider: name });
		return false;
	}

	/**
	 * Get all registered providers
	 */
	getAllProviders(): CalendarProvider[] {
		return Array.from(this.providers.values());
	}

	/**
	 * Get information about all registered providers
	 */
	getProvidersInfo(): CalendarProviderInfo[] {
		return this.getAllProviders().map(provider => provider.getProviderInfo());
	}

	/**
	 * Check if any providers are registered
	 */
	hasProviders(): boolean {
		return this.providers.size > 0;
	}

	/**
	 * Get the number of registered providers
	 */
	getProviderCount(): number {
		return this.providers.size;
	}

	/**
	 * Remove a provider
	 */
	async removeProvider(name: string): Promise<boolean> {
		const provider = this.providers.get(name);
		if (provider) {
			try {
				await provider.dispose();
				this.providers.delete(name);
				
				// If this was the default provider, clear it
				if (this.defaultProvider === provider) {
					this.defaultProvider = undefined;
					// Set a new default if other providers exist
					if (this.providers.size > 0) {
						this.defaultProvider = this.getAllProviders()[0];
						const newDefaultInfo = this.defaultProvider.getProviderInfo();
						logger.info('Auto-selected new default provider', { provider: newDefaultInfo.name });
					}
				}

				logger.info('Removed calendar provider', { provider: name });
				return true;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logger.error('Failed to remove provider', { provider: name, error: errorMessage });
				throw new CalendarProviderError(
					`Failed to remove provider ${name}: ${errorMessage}`,
					name,
					'REMOVAL_ERROR',
					error instanceof Error ? error : undefined
				);
			}
		}
		return false;
	}

	/**
	 * Dispose all providers and clean up
	 */
	async dispose(): Promise<void> {
		logger.info('Disposing calendar provider manager');
		const providers = Array.from(this.providers.values());
		
		for (const provider of providers) {
			try {
				await provider.dispose();
			} catch (error) {
				const info = provider.getProviderInfo();
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logger.error('Error disposing provider', { provider: info.name, error: errorMessage });
			}
		}

		this.providers.clear();
		this.defaultProvider = undefined;
		logger.info('Calendar provider manager disposed');
	}

	// Convenience methods that delegate to the default provider

	/**
	 * Get calendars from the default provider
	 */
	async getCalendars(): Promise<Calendar[]> {
		if (!this.defaultProvider) {
			throw new CalendarProviderError('No default calendar provider available', 'manager', 'NO_DEFAULT_PROVIDER');
		}
		return this.defaultProvider.getCalendars();
	}

	/**
	 * Get events from the default provider
	 */
	async getEvents(startDate: Date, endDate: Date, calendarIds?: string[]): Promise<CalendarEvent[]> {
		if (!this.defaultProvider) {
			throw new CalendarProviderError('No default calendar provider available', 'manager', 'NO_DEFAULT_PROVIDER');
		}
		return this.defaultProvider.getEvents(startDate, endDate, calendarIds);
	}

	/**
	 * Create an event using the default provider
	 */
	async createEvent(calendarId: string, event: EventInput): Promise<CalendarEvent> {
		if (!this.defaultProvider) {
			throw new CalendarProviderError('No default calendar provider available', 'manager', 'NO_DEFAULT_PROVIDER');
		}
		return this.defaultProvider.createEvent(calendarId, event);
	}

	/**
	 * Request access from the default provider
	 */
	async requestAccess(): Promise<boolean> {
		if (!this.defaultProvider) {
			throw new CalendarProviderError('No default calendar provider available', 'manager', 'NO_DEFAULT_PROVIDER');
		}
		return this.defaultProvider.requestAccess();
	}

	/**
	 * Check if the default provider has access
	 */
	async hasAccess(): Promise<boolean> {
		if (!this.defaultProvider) {
			throw new CalendarProviderError('No default calendar provider available', 'manager', 'NO_DEFAULT_PROVIDER');
		}
		return this.defaultProvider.hasAccess();
	}
}

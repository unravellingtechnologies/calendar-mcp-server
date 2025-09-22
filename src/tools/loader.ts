/**
 * Dynamic Tool Loader - Configuration-driven tool loading system
 */

import { BaseTool } from './base-tool.js';
import { ToolRegistry } from './registry.js';
import { ToolError, ToolErrorHandler } from './errors.js';
import { logger } from '../utils/logger.js';
import { CalendarProviderManager } from '../providers/index.js';

export interface ToolModuleConfig {
	name: string;
	enabled: boolean;
	modulePath: string;
	dependencies?: string[];
	config?: Record<string, any>;
}

export interface ToolLoaderConfig {
	toolsDirectory?: string;
	enabledTools?: string[];
	disabledTools?: string[];
	autoDiscovery?: boolean;
	loadOrder?: string[];
}

export interface ToolModule {
	name: string;
	description: string;
	version: string;
	tools: BaseTool[];
	dependencies?: string[];
	initialize?: (_config?: any, _context?: ToolLoadContext) => Promise<void> | void;
	dispose?: () => Promise<void> | void;
}

export interface ToolLoadContext {
	registry: ToolRegistry;
	providerManager: CalendarProviderManager;
	config: any;
}

export class ToolLoader {
	private config: ToolLoaderConfig;
	private loadedModules: Map<string, ToolModule> = new Map();
	private registry: ToolRegistry;
	private context: ToolLoadContext;

	constructor(
		registry: ToolRegistry,
		context: ToolLoadContext,
		config: ToolLoaderConfig = {}
	) {
		this.registry = registry;
		this.context = context;
		this.config = {
			toolsDirectory: './tools',
			autoDiscovery: true,
			enabledTools: [],
			disabledTools: [],
			...config,
		};
	}

	/**
	 * Load all configured tools
	 */
	async loadAllTools(): Promise<void> {
		logger.info('Starting dynamic tool loading', { config: this.config });

		try {
			// Load built-in core tools first
			await this.loadCoreTools();

			// Load additional tools if auto-discovery is enabled
			if (this.config.autoDiscovery) {
				await this.discoverAndLoadTools();
			}

			// Load specific tools from configuration
			if (this.config.enabledTools && this.config.enabledTools.length > 0) {
				await this.loadSpecificTools(this.config.enabledTools);
			}

			logger.info('Dynamic tool loading completed', {
				loadedModules: this.loadedModules.size,
				totalTools: this.registry.getStats().totalTools,
			});

		} catch (error) {
			const toolError = ToolErrorHandler.normalize(error, {
				operation: 'loadAllTools',
			});
			ToolErrorHandler.handle(toolError, logger);
			throw toolError;
		}
	}

	/**
	 * Load core calendar tools
	 */
	private async loadCoreTools(): Promise<void> {
		logger.debug('Loading core calendar tools');

		const coreModule: ToolModule = {
			name: 'core-calendar',
			description: 'Core calendar tools for basic operations',
			version: '1.0.0',
			tools: await this.createCoreTools(),
		};

		await this.loadModule(coreModule);
		logger.info('Core calendar tools loaded', { toolCount: coreModule.tools.length });
	}

	/**
	 * Create core calendar tools using the tool factory
	 */
	private async createCoreTools(): Promise<BaseTool[]> {
		const { defaultToolFactory } = await import('./tool-factory.js');
		const tools: BaseTool[] = [];

		// Calendar access tool
		tools.push(defaultToolFactory.createUtilityTool(
			'request_calendar_access',
			'Request permission to access the user\'s calendar data.',
			{
				type: 'object',
				properties: {},
			},
			async () => {
				const granted = await this.context.providerManager.requestAccess();
				const provider = this.context.providerManager.getDefaultProvider();
				return {
					granted,
					message: granted ? 'Calendar access granted' : 'Calendar access denied',
					provider: provider?.getProviderInfo().displayName || 'Unknown',
				};
			}
		));

		// Get calendars tool
		tools.push(defaultToolFactory.createCalendarQueryTool(
			'get_calendars',
			'Retrieve all available calendars from the user\'s calendar application.',
			{
				type: 'object',
				properties: {},
			},
			async () => {
				const calendars = await this.context.providerManager.getCalendars();
				const provider = this.context.providerManager.getDefaultProvider();
				return {
					calendars,
					count: calendars.length,
					provider: provider?.getProviderInfo().displayName || 'Unknown',
				};
			}
		));

		// Get calendar events tool
		tools.push(defaultToolFactory.createCalendarQueryTool(
			'get_calendar_events',
			'Retrieve calendar events within a specified date range, optionally filtered by calendar IDs.',
			{
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
			async (args: { startDate: string; endDate: string; calendarIds?: string[] }) => {
				const startDate = new Date(args.startDate);
				const endDate = new Date(args.endDate);
				
				if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
					throw ToolError.validationError('Invalid date format. Please use ISO 8601 format.', 'get_calendar_events', args);
				}

				const events = await this.context.providerManager.getEvents(startDate, endDate, args.calendarIds);
				const provider = this.context.providerManager.getDefaultProvider();
				return {
					events,
					count: events.length,
					dateRange: {
						startDate: args.startDate,
						endDate: args.endDate,
					},
					filteredCalendars: args.calendarIds || null,
					provider: provider?.getProviderInfo().displayName || 'Unknown',
				};
			}
		));

		return tools;
	}

	/**
	 * Load a tool module
	 */
	private async loadModule(module: ToolModule): Promise<void> {
		try {
			// Check if module is disabled
			if (this.config.disabledTools?.includes(module.name)) {
				logger.debug('Skipping disabled tool module', { module: module.name });
				return;
			}

			// Initialize module if it has an initialize function
			if (module.initialize) {
				await module.initialize(this.config, this.context);
			}

			// Register all tools from the module
			for (const tool of module.tools) {
				this.registry.registerTool(tool);
			}

			this.loadedModules.set(module.name, module);
			logger.info('Loaded tool module', { 
				module: module.name, 
				toolCount: module.tools.length,
				version: module.version 
			});

		} catch (error) {
			const toolError = ToolErrorHandler.normalize(error, {
				operation: 'loadModule',
				toolName: module.name,
			});
			ToolErrorHandler.handle(toolError, logger);
			throw toolError;
		}
	}

	/**
	 * Discover and load tools from the tools directory (placeholder for future expansion)
	 */
	private async discoverAndLoadTools(): Promise<void> {
		logger.debug('Tool auto-discovery is enabled but not yet implemented');
		// TODO: Implement file system scanning for tool modules
		// This would scan the tools directory for .js/.ts files that export ToolModule
	}

	/**
	 * Load specific tools by name
	 */
	private async loadSpecificTools(toolNames: string[]): Promise<void> {
		logger.debug('Loading specific tools', { tools: toolNames });
		// TODO: Implement loading of specific tool modules
		// This would load only the specified tools from configuration
	}

	/**
	 * Unload a tool module
	 */
	async unloadModule(moduleName: string): Promise<boolean> {
		const module = this.loadedModules.get(moduleName);
		if (!module) {
			logger.warn('Tool module not found for unloading', { module: moduleName });
			return false;
		}

		try {
			// Unregister all tools from the module
			for (const tool of module.tools) {
				this.registry.unregisterTool(tool.name);
			}

			// Dispose module if it has a dispose function
			if (module.dispose) {
				await module.dispose();
			}

			this.loadedModules.delete(moduleName);
			logger.info('Unloaded tool module', { module: moduleName });
			return true;

		} catch (error) {
			const toolError = ToolErrorHandler.normalize(error, {
				operation: 'unloadModule',
				toolName: moduleName,
			});
			ToolErrorHandler.handle(toolError, logger);
			throw toolError;
		}
	}

	/**
	 * Get information about loaded modules
	 */
	getLoadedModules(): ToolModule[] {
		return Array.from(this.loadedModules.values());
	}

	/**
	 * Get loader statistics
	 */
	getStats() {
		return {
			loadedModules: this.loadedModules.size,
			moduleNames: Array.from(this.loadedModules.keys()),
			totalTools: this.registry.getStats().totalTools,
			config: this.config,
		};
	}

	/**
	 * Reload all tools
	 */
	async reloadAllTools(): Promise<void> {
		logger.info('Reloading all tools');
		
		// Unload all modules
		const moduleNames = Array.from(this.loadedModules.keys());
		for (const moduleName of moduleNames) {
			await this.unloadModule(moduleName);
		}

		// Reload all tools
		await this.loadAllTools();
		
		logger.info('Tool reload completed');
	}
}

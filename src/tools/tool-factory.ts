/**
 * Tool Factory for creating MCP tools with standardized patterns
 */

import { BaseTool, ToolConfig, ToolInputSchema, ToolHandler, BaseToolImplementation } from './base-tool.js';
import { logger } from '../utils/logger.js';

export type ToolType = 'query' | 'action' | 'utility' | 'custom';

export interface ToolFactoryConfig {
	defaultCategory?: string;
	enableLogging?: boolean;
	enableValidation?: boolean;
}

export class ToolFactory {
	private config: ToolFactoryConfig;

	constructor(config: ToolFactoryConfig = {}) {
		this.config = {
			defaultCategory: 'general',
			enableLogging: true,
			enableValidation: true,
			...config,
		};
	}

	/**
	 * Create a generic tool
	 */
	createTool<TArgs = any, TResult = any>(toolConfig: ToolConfig<TArgs, TResult>): BaseTool<TArgs, TResult> {
		const tool = new GenericTool(toolConfig, this.config);
		
		if (this.config.enableLogging) {
			logger.info('Created tool', { 
				name: tool.name, 
				category: toolConfig.category || this.config.defaultCategory 
			});
		}

		return tool;
	}

	/**
	 * Create a query tool (read-only operations)
	 */
	createQueryTool<TArgs = any, TResult = any>(
		name: string,
		description: string,
		inputSchema: ToolInputSchema,
		handler: ToolHandler<TArgs, TResult>
	): BaseTool<TArgs, TResult> {
		return this.createTool({
			name,
			description,
			inputSchema,
			handler,
			category: 'query',
			tags: ['read-only', 'query'],
		});
	}

	/**
	 * Create an action tool (operations that modify data)
	 */
	createActionTool<TArgs = any, TResult = any>(
		name: string,
		description: string,
		inputSchema: ToolInputSchema,
		handler: ToolHandler<TArgs, TResult>
	): BaseTool<TArgs, TResult> {
		return this.createTool({
			name,
			description,
			inputSchema,
			handler,
			category: 'action',
			tags: ['write', 'action'],
		});
	}

	/**
	 * Create a utility tool (helper operations)
	 */
	createUtilityTool<TArgs = any, TResult = any>(
		name: string,
		description: string,
		inputSchema: ToolInputSchema,
		handler: ToolHandler<TArgs, TResult>
	): BaseTool<TArgs, TResult> {
		return this.createTool({
			name,
			description,
			inputSchema,
			handler,
			category: 'utility',
			tags: ['utility', 'helper'],
		});
	}

	/**
	 * Create a calendar-specific query tool
	 */
	createCalendarQueryTool<TArgs = any, TResult = any>(
		name: string,
		description: string,
		inputSchema: ToolInputSchema,
		handler: ToolHandler<TArgs, TResult>
	): BaseTool<TArgs, TResult> {
		return this.createTool({
			name,
			description,
			inputSchema,
			handler,
			category: 'calendar',
			tags: ['calendar', 'query', 'read-only'],
		});
	}

	/**
	 * Create a calendar-specific action tool
	 */
	createCalendarActionTool<TArgs = any, TResult = any>(
		name: string,
		description: string,
		inputSchema: ToolInputSchema,
		handler: ToolHandler<TArgs, TResult>
	): BaseTool<TArgs, TResult> {
		return this.createTool({
			name,
			description,
			inputSchema,
			handler,
			category: 'calendar',
			tags: ['calendar', 'action', 'write'],
		});
	}

	/**
	 * Create a batch of tools from configurations
	 */
	createTools(configs: ToolConfig[]): BaseTool[] {
		return configs.map(config => this.createTool(config));
	}

	/**
	 * Create a tool with automatic input validation
	 */
	createValidatedTool<TArgs = any, TResult = any>(
		toolConfig: ToolConfig<TArgs, TResult>,
		validator?: (_args: any) => TArgs
	): BaseTool<TArgs, TResult> {
		const originalHandler = toolConfig.handler;
		
		const wrappedHandler: ToolHandler<TArgs, TResult> = async (args: TArgs) => {
			if (this.config.enableValidation && validator) {
				const validatedArgs = validator(args);
				return originalHandler(validatedArgs);
			}
			return originalHandler(args);
		};

		return this.createTool({
			...toolConfig,
			handler: wrappedHandler,
		});
	}

	/**
	 * Create a tool with JSON Schema validation
	 */
	createSchemaValidatedTool<TArgs = any, TResult = any>(
		toolConfig: ToolConfig<TArgs, TResult>
	): BaseTool<TArgs, TResult> {
		// The validation will be handled automatically by the BaseToolImplementation
		// when validateArgs is called
		return this.createTool(toolConfig);
	}
}

/**
 * Generic tool implementation
 */
class GenericTool<TArgs = any, TResult = any> extends BaseToolImplementation<TArgs, TResult> {
	readonly name: string;
	readonly description: string;
	readonly inputSchema: ToolInputSchema;
	protected readonly category?: string;
	protected readonly tags?: string[];
	protected readonly examples?: any[];

	private toolHandler: ToolHandler<TArgs, TResult>;

	constructor(config: ToolConfig<TArgs, TResult>, factoryConfig: ToolFactoryConfig) {
		super();
		this.name = config.name;
		this.description = config.description;
		this.inputSchema = config.inputSchema;
		this.category = config.category || factoryConfig.defaultCategory;
		this.tags = config.tags;
		this.examples = config.examples;
		this.toolHandler = config.handler;
	}

	async handler(args: TArgs): Promise<TResult> {
		return this.toolHandler(args);
	}
}

// Export a default factory instance
export const defaultToolFactory = new ToolFactory({
	defaultCategory: 'calendar',
	enableLogging: true,
	enableValidation: true,
});

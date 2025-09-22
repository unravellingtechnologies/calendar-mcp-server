/**
 * Tool Registry for managing MCP tools
 */

import { BaseTool, ToolExecutionResult } from './base-tool.js';
import { CalendarMCPServer, MCPTool } from '../server/index.js';
import { ToolError, ToolErrorCode, ToolErrorHandler } from './errors.js';
import { logger } from '../utils/logger.js';

export interface ToolRegistryConfig {
	enableMetrics?: boolean;
	enableCaching?: boolean;
	maxCacheSize?: number;
}

export interface ToolMetrics {
	totalExecutions: number;
	successfulExecutions: number;
	failedExecutions: number;
	averageExecutionTime: number;
	lastExecuted?: Date;
}

export class ToolRegistry {
	private server: CalendarMCPServer;
	private tools: Map<string, BaseTool> = new Map();
	private metrics: Map<string, ToolMetrics> = new Map();
	private config: ToolRegistryConfig;

	constructor(server: CalendarMCPServer, config: ToolRegistryConfig = {}) {
		this.server = server;
		this.config = {
			enableMetrics: true,
			enableCaching: false,
			maxCacheSize: 100,
			...config,
		};
	}

	/**
	 * Register a single tool
	 */
	registerTool(tool: BaseTool): void {
		if (this.tools.has(tool.name)) {
			logger.warn('Tool already registered, overwriting', { name: tool.name });
		}

		// Convert our tool to MCP tool format
		const mcpTool: MCPTool = {
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
			handler: async (args: any) => {
				return this.executeTool(tool.name, args);
			},
		};

		this.tools.set(tool.name, tool);
		this.server.registerTool(mcpTool);

		// Initialize metrics
		if (this.config.enableMetrics) {
			this.metrics.set(tool.name, {
				totalExecutions: 0,
				successfulExecutions: 0,
				failedExecutions: 0,
				averageExecutionTime: 0,
			});
		}

		logger.info('Registered tool', { 
			name: tool.name, 
			description: tool.description.substring(0, 100) + (tool.description.length > 100 ? '...' : '')
		});
	}

	/**
	 * Register multiple tools
	 */
	registerTools(tools: BaseTool[]): void {
		for (const tool of tools) {
			this.registerTool(tool);
		}
		logger.info(`Registered ${tools.length} tools`);
	}

	/**
	 * Unregister a tool
	 */
	unregisterTool(name: string): boolean {
		const removed = this.tools.delete(name);
		if (removed) {
			this.server.unregisterTool(name);
			this.metrics.delete(name);
			logger.info('Unregistered tool', { name });
		} else {
			logger.warn('Tool not found for unregistration', { name });
		}
		return removed;
	}

	/**
	 * Get a registered tool
	 */
	getTool(name: string): BaseTool | undefined {
		return this.tools.get(name);
	}

	/**
	 * Get all registered tools
	 */
	getAllTools(): BaseTool[] {
		return Array.from(this.tools.values());
	}

	/**
	 * Get tools by category
	 */
	getToolsByCategory(category: string): BaseTool[] {
		return this.getAllTools().filter(tool => {
			const metadata = tool.getMetadata();
			return metadata.category === category;
		});
	}

	/**
	 * Get tools by tag
	 */
	getToolsByTag(tag: string): BaseTool[] {
		return this.getAllTools().filter((tool: BaseTool) => {
			const metadata = tool.getMetadata();
			return metadata.tags?.includes(tag) || false;
		});
	}

	/**
	 * Execute a tool with enhanced error handling and metrics tracking
	 */
	private async executeTool(toolName: string, args: any): Promise<any> {
		const tool = this.tools.get(toolName);
		if (!tool) {
			const error = ToolError.toolNotFound(toolName);
			ToolErrorHandler.handle(error, logger);
			throw error;
		}

		const startTime = Date.now();
		let result: ToolExecutionResult;

		try {
			logger.debug('Executing tool', { toolName, args });
			result = await tool.execute(args, { requestId: `req_${Date.now()}` });
		} catch (error) {
			const toolError = ToolErrorHandler.normalize(error, {
				toolName,
				args,
				operation: 'execute',
			});
			ToolErrorHandler.handle(toolError, logger);
			
			// Update failure metrics
			if (this.config.enableMetrics) {
				this.updateMetrics(toolName, {
					success: false,
					error: {
						message: toolError.message,
						code: toolError.code,
					},
					executionTime: Date.now() - startTime,
					context: { toolName, args, timestamp: new Date() },
				}, Date.now() - startTime);
			}
			
			throw toolError;
		}

		// Update metrics
		if (this.config.enableMetrics) {
			this.updateMetrics(toolName, result, Date.now() - startTime);
		}

		if (result.success) {
			logger.debug('Tool execution completed', { toolName, executionTime: result.executionTime });
			return result.result;
		} else {
			const toolError = new ToolError(
				result.error?.message || 'Tool execution failed',
				ToolErrorCode.EXECUTION_FAILED,
				{
					toolName,
					args,
					operation: 'execute',
				}
			);
			ToolErrorHandler.handle(toolError, logger);
			throw toolError;
		}
	}

	/**
	 * Update tool execution metrics
	 */
	private updateMetrics(toolName: string, result: ToolExecutionResult, executionTime: number): void {
		const metrics = this.metrics.get(toolName);
		if (!metrics) return;

		metrics.totalExecutions++;
		metrics.lastExecuted = new Date();

		if (result.success) {
			metrics.successfulExecutions++;
		} else {
			metrics.failedExecutions++;
		}

		// Update average execution time
		const totalTime = metrics.averageExecutionTime * (metrics.totalExecutions - 1) + executionTime;
		metrics.averageExecutionTime = totalTime / metrics.totalExecutions;
	}

	/**
	 * Get tool metrics
	 */
	getToolMetrics(toolName: string): ToolMetrics | undefined {
		return this.metrics.get(toolName);
	}

	/**
	 * Get all tool metrics
	 */
	getAllMetrics(): Map<string, ToolMetrics> {
		return new Map(this.metrics);
	}

	/**
	 * Get registry statistics
	 */
	getStats() {
		const totalTools = this.tools.size;
		const categories = new Set<string>();
		const tags = new Set<string>();

		for (const tool of this.tools.values()) {
			const metadata = tool.getMetadata();
			if (metadata.category) categories.add(metadata.category);
			if (metadata.tags) {
				metadata.tags.forEach((tag: string) => tags.add(tag));
			}
		}

		return {
			totalTools,
			categories: Array.from(categories),
			tags: Array.from(tags),
			metricsEnabled: this.config.enableMetrics,
		};
	}

	/**
	 * Clear all tools
	 */
	clear(): void {
		const toolNames = Array.from(this.tools.keys());
		for (const name of toolNames) {
			this.unregisterTool(name);
		}
		logger.info('Cleared all tools from registry');
	}
}

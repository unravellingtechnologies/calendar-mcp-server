/**
 * Calendar MCP Server Core Implementation
 * Handles communication with Claude Desktop and other MCP-compatible clients
 */

import { Server } from '@modelcontextprotocol/sdk/dist/esm/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/dist/esm/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/dist/esm/types.js';
import { logger } from '../utils/logger.js';

export interface CalendarMCPServerConfig {
	name: string;
	version: string;
	description?: string;
}

export interface MCPTool {
	name: string;
	description: string;
	inputSchema: object;
	handler: (args: any) => Promise<any>;
}

export class CalendarMCPServer {
	private server: Server;
	private config: CalendarMCPServerConfig;
	private tools: Map<string, MCPTool>;
	private isRunning: boolean = false;

	constructor(config: CalendarMCPServerConfig) {
		this.config = config;
		this.tools = new Map();

		// Initialize the MCP server
		this.server = new Server(
			{
				name: config.name,
				version: config.version,
			},
			{
				capabilities: {
					tools: {},
				},
			}
		);

		this.setupServerHandlers();
		logger.info('Calendar MCP Server initialized', { name: config.name, version: config.version });
	}

	private setupServerHandlers(): void {
		// Handle tool listing requests
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			const tools = Array.from(this.tools.values()).map(tool => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
			}));

			logger.debug('Listed tools', { count: tools.length });
			return { tools };
		});

		// Handle tool execution requests
		this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
			const { name, arguments: args } = request.params;
			const tool = this.tools.get(name);

			if (!tool) {
				const error = `Tool '${name}' not found`;
				logger.error(error);
				throw new Error(error);
			}

			try {
				logger.info('Executing tool', { name, args });
				const result = await tool.handler(args);
				logger.debug('Tool execution completed', { name, result });

				return {
					content: [
						{
							type: 'text',
							text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
						},
					],
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				logger.error('Tool execution failed', { name, error: errorMessage });
				throw error;
			}
		});

		// Handle server errors
		this.server.onerror = (error: any) => {
			logger.error('MCP Server error', error);
		};

		logger.debug('Server handlers configured');
	}

	public registerTool(tool: MCPTool): void {
		if (this.tools.has(tool.name)) {
			logger.warn('Tool already registered, overwriting', { name: tool.name });
		}

		this.tools.set(tool.name, tool);
		logger.info('Tool registered', { name: tool.name, description: tool.description });
	}

	public unregisterTool(name: string): boolean {
		const removed = this.tools.delete(name);
		if (removed) {
			logger.info('Tool unregistered', { name });
		} else {
			logger.warn('Tool not found for unregistration', { name });
		}
		return removed;
	}

	public getRegisteredTools(): string[] {
		return Array.from(this.tools.keys());
	}

	public async start(): Promise<void> {
		if (this.isRunning) {
			logger.warn('Server is already running');
			return;
		}

		try {
			const transport = new StdioServerTransport();
			await this.server.connect(transport);
			this.isRunning = true;
			logger.info('MCP Server started successfully', {
				name: this.config.name,
				toolCount: this.tools.size,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Failed to start MCP server', { error: errorMessage });
			throw new Error(`Failed to start MCP server: ${errorMessage}`);
		}
	}

	public async stop(): Promise<void> {
		if (!this.isRunning) {
			logger.warn('Server is not running');
			return;
		}

		try {
			await this.server.close();
			this.isRunning = false;
			logger.info('MCP Server stopped successfully');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			logger.error('Error stopping MCP server', { error: errorMessage });
			throw new Error(`Failed to stop MCP server: ${errorMessage}`);
		}
	}

	public isServerRunning(): boolean {
		return this.isRunning;
	}

	public getConfig(): CalendarMCPServerConfig {
		return { ...this.config };
	}

	public getToolCount(): number {
		return this.tools.size;
	}
}

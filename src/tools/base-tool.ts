/**
 * Base interfaces and types for MCP tools
 */

import { validateToolParameters } from './validation.js';
import { ToolError } from './errors.js';

export interface ToolInputSchema {
	type: 'object';
	properties: Record<string, any>;
	required?: string[];
	additionalProperties?: boolean;
}

export interface ToolHandler<TArgs = any, TResult = any> {
	(_args: TArgs): Promise<TResult> | TResult;
}

export interface BaseTool<TArgs = any, TResult = any> {
	name: string;
	description: string;
	inputSchema: ToolInputSchema;
	handler: ToolHandler<TArgs, TResult>;
	execute(_args: any, _context?: Partial<ToolExecutionContext>): Promise<ToolExecutionResult<TResult>>;
	getMetadata(): {
		name: string;
		description: string;
		inputSchema: ToolInputSchema;
		category?: string;
		tags?: string[];
		examples?: ToolExample[];
	};
}

export interface ToolConfig<TArgs = any, TResult = any> {
	name: string;
	description: string;
	inputSchema: ToolInputSchema;
	handler: ToolHandler<TArgs, TResult>;
	category?: string;
	tags?: string[];
	examples?: ToolExample[];
}

export interface ToolExample {
	description: string;
	input: Record<string, any>;
	expectedOutput?: any;
}

export interface ToolExecutionContext {
	toolName: string;
	args: any;
	timestamp: Date;
	requestId?: string;
}

export interface ToolExecutionResult<TResult = any> {
	success: boolean;
	result?: TResult;
	error?: ToolExecutionError;
	executionTime?: number;
	context: ToolExecutionContext;
}

export interface ToolExecutionError {
	message: string;
	code?: string;
	details?: any;
	stack?: string;
}

export abstract class BaseToolImplementation<TArgs = any, TResult = any> implements BaseTool<TArgs, TResult> {
	abstract readonly name: string;
	abstract readonly description: string;
	abstract readonly inputSchema: ToolInputSchema;

	protected readonly category?: string;
	protected readonly tags?: string[];
	protected readonly examples?: ToolExample[];

	abstract handler(_args: TArgs): Promise<TResult> | TResult;

	/**
	 * Validate input arguments against the schema
	 */
	protected validateArgs(args: any): TArgs {
		try {
			return validateToolParameters(this.name, this.inputSchema, args);
		} catch (error) {
			throw ToolError.validationError(
				error instanceof Error ? error.message : 'Unknown validation error',
				this.name,
				args
			);
		}
	}

	/**
	 * Execute the tool with error handling and context
	 */
	async execute(args: any, context?: Partial<ToolExecutionContext>): Promise<ToolExecutionResult<TResult>> {
		const startTime = Date.now();
		const executionContext: ToolExecutionContext = {
			toolName: this.name,
			args,
			timestamp: new Date(),
			requestId: context?.requestId,
		};

		try {
			const validatedArgs = this.validateArgs(args);
			const result = await this.handler(validatedArgs);
			const executionTime = Date.now() - startTime;

			return {
				success: true,
				result,
				executionTime,
				context: executionContext,
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;
			const toolError: ToolExecutionError = {
				message: error instanceof Error ? error.message : 'Unknown error',
				code: error instanceof Error && 'code' in error ? (error as any).code : undefined,
				details: error instanceof Error && 'details' in error ? (error as any).details : undefined,
				stack: error instanceof Error ? error.stack : undefined,
			};

			return {
				success: false,
				error: toolError,
				executionTime,
				context: executionContext,
			};
		}
	}

	/**
	 * Get tool metadata
	 */
	getMetadata() {
		return {
			name: this.name,
			description: this.description,
			inputSchema: this.inputSchema,
			category: this.category,
			tags: this.tags,
			examples: this.examples,
		};
	}
}

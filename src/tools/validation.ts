/**
 * Tool Parameter Validation using Zod
 */

import { z, ZodError, ZodSchema, ZodType } from 'zod';
import { ToolInputSchema } from './base-tool.js';
import { logger } from '../utils/logger.js';

export interface ValidationConfig {
	strict?: boolean;
	allErrors?: boolean;
	removeAdditional?: boolean | 'all' | 'failing';
	useDefaults?: boolean;
	coerceTypes?: boolean | 'array';
}

export interface ValidationError {
	message: string;
	field?: string;
	value?: any;
	details: ZodError['issues'];
}

export class ToolValidator {
	private schemas: Map<string, ZodSchema> = new Map();
	private config: ValidationConfig;

	constructor(config: ValidationConfig = {}) {
		this.config = {
			strict: true,
			...config,
		};
	}

	/**
	 * Create common Zod schemas for calendar operations
	 */
	static getCommonSchemas() {
		return {
			// ISO date string validation
			isoDate: z.string().refine(
				(dateString) => {
					const date = new Date(dateString);
					// Check if the string parses to a valid date
					if (isNaN(date.getTime())) {
						return false;
					}
					
					// Use a permissive ISO 8601 regex that allows:
					// - Optional fractional seconds
					// - Optional timezone (Z or +/-HH:MM or +/-HHMM)
					// - Date-only format (YYYY-MM-DD)
					// - Date-time format (YYYY-MM-DDTHH:mm:ss)
					const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:?\d{2})?$/;
					
					// Check if it matches ISO 8601 pattern and parsed timestamp matches
					return isoRegex.test(dateString) && date.getTime() === Date.parse(dateString);
				},
				{ message: 'Must be a valid ISO 8601 date string (e.g., "2024-01-01", "2024-01-01T12:00:00Z", "2024-01-01T12:00:00.000Z", "2024-01-01T12:00:00+02:00")' }
			),

			// Calendar ID validation
			calendarId: z.string().min(1).refine(
				(id) => id.trim() === id,
				{ message: 'Calendar ID must not have leading or trailing whitespace' }
			),

			// Event title validation
			eventTitle: z.string().min(1).max(255, 'Event title must be 255 characters or less'),

			// Optional array of calendar IDs
			calendarIds: z.array(z.string().min(1)).optional(),

			// Date range validation
			dateRange: z.object({
				startDate: z.string().refine(
					(dateString) => {
						const date = new Date(dateString);
						return !isNaN(date.getTime());
					},
					{ message: 'Must be a valid date string' }
				),
				endDate: z.string().refine(
					(dateString) => {
						const date = new Date(dateString);
						return !isNaN(date.getTime());
					},
					{ message: 'Must be a valid date string' }
				),
			}).refine(
				(data) => {
					const start = new Date(data.startDate);
					const end = new Date(data.endDate);
					return end >= start;
				},
				{ message: 'End date must be after or equal to start date' }
			),
		};
	}

	/**
	 * Convert JSON Schema to Zod schema (simplified conversion)
	 */
	private jsonSchemaToZod(schema: ToolInputSchema): ZodSchema {
		// This is a simplified converter - in practice, you might want a more complete implementation
		const zodObject: Record<string, ZodType> = {};

		if (schema.properties) {
			for (const [key, propSchema] of Object.entries(schema.properties)) {
				const isRequired = schema.required?.includes(key) || false;
				zodObject[key] = this.convertProperty(propSchema, isRequired);
			}
		}

		return z.object(zodObject);
	}

	/**
	 * Convert a single property schema to Zod
	 */
	private convertProperty(propSchema: any, isRequired: boolean = false): ZodType {
		let baseSchema: ZodType;

		switch (propSchema.type) {
			case 'string':
				baseSchema = z.string();
				if (propSchema.minLength) baseSchema = (baseSchema as z.ZodString).min(propSchema.minLength);
				if (propSchema.maxLength) baseSchema = (baseSchema as z.ZodString).max(propSchema.maxLength);
				if (propSchema.format === 'date-time') baseSchema = (baseSchema as z.ZodString).datetime();
				if (propSchema.format === 'email') baseSchema = (baseSchema as z.ZodString).email();
				if (propSchema.format === 'uri') baseSchema = (baseSchema as z.ZodString).url();
				break;

			case 'number':
				baseSchema = z.number();
				if (propSchema.minimum !== undefined) baseSchema = (baseSchema as z.ZodNumber).min(propSchema.minimum);
				if (propSchema.maximum !== undefined) baseSchema = (baseSchema as z.ZodNumber).max(propSchema.maximum);
				break;

			case 'integer':
				baseSchema = z.number().int();
				if (propSchema.minimum !== undefined) baseSchema = (baseSchema as z.ZodNumber).min(propSchema.minimum);
				if (propSchema.maximum !== undefined) baseSchema = (baseSchema as z.ZodNumber).max(propSchema.maximum);
				break;

			case 'boolean':
				baseSchema = z.boolean();
				break;

			case 'array':
				if (propSchema.items && typeof propSchema.items === 'object') {
					const itemSchema = this.convertProperty(propSchema.items, true);
					baseSchema = z.array(itemSchema);
					if (propSchema.minItems) baseSchema = (baseSchema as z.ZodArray<any>).min(propSchema.minItems);
					if (propSchema.maxItems) baseSchema = (baseSchema as z.ZodArray<any>).max(propSchema.maxItems);
				} else {
					// Fallback for simple array types
					baseSchema = z.array(z.string()); // Default to string array
				}
				break;

			case 'object':
				if (propSchema.properties) {
					const objectSchema: Record<string, ZodType> = {};
					for (const [key, subSchema] of Object.entries(propSchema.properties)) {
						const isSubRequired = propSchema.required?.includes(key) || false;
						objectSchema[key] = this.convertProperty(subSchema, isSubRequired);
					}
					baseSchema = z.object(objectSchema);
				} else {
					baseSchema = z.record(z.string(), z.unknown());
				}
				break;

			default:
				baseSchema = z.unknown();
		}

		// Make optional if not required
		return isRequired ? baseSchema : baseSchema.optional();
	}

	/**
	 * Get or create a Zod schema for a tool
	 */
	getSchema(toolName: string, jsonSchema: ToolInputSchema): ZodSchema {
		let schema = this.schemas.get(toolName);
		
		if (!schema) {
			try {
				schema = this.jsonSchemaToZod(jsonSchema);
				this.schemas.set(toolName, schema);
				logger.debug('Created Zod schema for tool', { toolName });
			} catch (error) {
				logger.error('Failed to create Zod schema', { toolName, error });
				throw new Error(`Failed to create schema for tool '${toolName}': ${error}`);
			}
		}

		return schema;
	}

	/**
	 * Validate tool parameters
	 */
	validateToolParameters<T = any>(
		toolName: string, 
		jsonSchema: ToolInputSchema, 
		data: any
	): { valid: boolean; data?: T; error?: ValidationError } {
		try {
			const schema = this.getSchema(toolName, jsonSchema);
			const result = schema.safeParse(data);

			if (result.success) {
				return { valid: true, data: result.data as T };
			} else {
				const error = this.formatZodError(result.error);
				logger.warn('Tool parameter validation failed', { 
					toolName, 
					error: error.message,
					data 
				});
				return { valid: false, error };
			}
		} catch (error) {
			const validationError: ValidationError = {
				message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				details: [],
			};
			return { valid: false, error: validationError };
		}
	}

	/**
	 * Format Zod validation errors into a user-friendly format
	 */
	private formatZodError(zodError: ZodError): ValidationError {
		if (zodError.issues.length === 0) {
			return {
				message: 'Unknown validation error',
				details: [],
			};
		}

		const primaryIssue = zodError.issues[0];
		let message = primaryIssue.message;
		let field = primaryIssue.path.join('.');

		// Create more specific messages based on the error code
		switch (primaryIssue.code) {
			case 'invalid_type':
				message = `Invalid type for field '${field}': ${primaryIssue.message}`;
				break;
			case 'too_small':
				message = `Field '${field}' is too small: ${primaryIssue.message}`;
				break;
			case 'too_big':
				message = `Field '${field}' is too large: ${primaryIssue.message}`;
				break;
			case 'custom':
				message = `Validation failed for field '${field}': ${primaryIssue.message}`;
				break;
			default:
				message = `Validation error for field '${field}': ${primaryIssue.message}`;
				break;
		}

		return {
			message,
			field,
			value: undefined, // Zod doesn't always provide the received value in a consistent way
			details: zodError.issues,
		};
	}

	/**
	 * Create a validation function for a specific tool
	 */
	createToolValidator<T = any>(toolName: string, jsonSchema: ToolInputSchema) {
		return (data: any): T => {
			const result = this.validateToolParameters<T>(toolName, jsonSchema, data);
			if (result.valid) {
				return result.data!;
			} else {
				throw new Error(result.error!.message);
			}
		};
	}

	/**
	 * Clear cached schemas
	 */
	clearCache(): void {
		this.schemas.clear();
		logger.debug('Cleared schema cache');
	}

	/**
	 * Remove a specific schema from cache
	 */
	removeSchema(toolName: string): boolean {
		const removed = this.schemas.delete(toolName);
		if (removed) {
			logger.debug('Removed schema from cache', { toolName });
		}
		return removed;
	}

	/**
	 * Get validation statistics
	 */
	getStats() {
		return {
			cachedSchemas: this.schemas.size,
			schemaNames: Array.from(this.schemas.keys()),
		};
	}
}

// Export a default validator instance
export const defaultValidator = new ToolValidator({
	strict: true,
});

/**
 * Convenience function for validating tool parameters
 */
export function validateToolParameters<T = any>(
	toolName: string,
	schema: ToolInputSchema,
	data: any
): T {
	const result = defaultValidator.validateToolParameters<T>(toolName, schema, data);
	if (result.valid) {
		return result.data!;
	} else {
		throw new Error(result.error!.message);
	}
}

/**
 * Create calendar-specific validation schemas using Zod
 */
export const CalendarSchemas = {
	// Get calendar events parameters
	getEvents: z.object({
		startDate: z.string().refine(
			(dateString) => {
				const date = new Date(dateString);
				return !isNaN(date.getTime());
			},
			{ message: 'Must be a valid date string' }
		),
		endDate: z.string().refine(
			(dateString) => {
				const date = new Date(dateString);
				return !isNaN(date.getTime());
			},
			{ message: 'Must be a valid date string' }
		),
		calendarIds: z.array(z.string().min(1)).optional(),
	}).refine(
		(data) => {
			const start = new Date(data.startDate);
			const end = new Date(data.endDate);
			return end >= start;
		},
		{ message: 'End date must be after or equal to start date' }
	),

	// Switch provider parameters
	switchProvider: z.object({
		providerName: z.string().min(1, 'Provider name is required'),
	}),

	// Create event parameters (for future use)
	createEvent: z.object({
		calendarId: z.string().min(1, 'Calendar ID is required'),
		title: z.string().min(1).max(255, 'Title must be between 1 and 255 characters'),
		startDate: z.string().refine(
			(dateString) => !isNaN(new Date(dateString).getTime()),
			{ message: 'Must be a valid date string' }
		),
		endDate: z.string().refine(
			(dateString) => !isNaN(new Date(dateString).getTime()),
			{ message: 'Must be a valid date string' }
		),
		notes: z.string().optional(),
		location: z.string().optional(),
		isAllDay: z.boolean().optional(),
	}).refine(
		(data) => {
			const start = new Date(data.startDate);
			const end = new Date(data.endDate);
			return end >= start;
		},
		{ message: 'End date must be after or equal to start date' }
	),
};

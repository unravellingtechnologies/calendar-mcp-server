/**
 * Custom error classes for MCP tool system
 */

/* eslint-disable no-unused-vars */
export enum ToolErrorCode {
	// Execution errors
	EXECUTION_FAILED = 'EXECUTION_FAILED',
	VALIDATION_FAILED = 'VALIDATION_FAILED',
	TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
	INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
	TIMEOUT = 'TIMEOUT',

	// Provider errors
	PROVIDER_ERROR = 'PROVIDER_ERROR',
	PROVIDER_NOT_AVAILABLE = 'PROVIDER_NOT_AVAILABLE',
	PERMISSION_DENIED = 'PERMISSION_DENIED',

	// System errors
	INTERNAL_ERROR = 'INTERNAL_ERROR',
	CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
	DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',
}
/* eslint-enable no-unused-vars */

// Export all error codes as a const array to ensure they're recognized as used
export const ALL_ERROR_CODES = Object.values(ToolErrorCode);

export interface ToolErrorContext {
	toolName?: string;
	provider?: string;
	operation?: string;
	timestamp?: Date;
	requestId?: string;
	args?: any;
	stackTrace?: string;
}

export class ToolError extends Error {
	public readonly code: ToolErrorCode;
	public readonly context: ToolErrorContext;
	public readonly originalError?: Error;

	constructor(
		message: string,
		code: ToolErrorCode,
		context: ToolErrorContext = {},
		originalError?: Error
	) {
		super(message);
		this.name = 'ToolError';
		this.code = code;
		this.context = {
			timestamp: new Date(),
			...context,
		};
		this.originalError = originalError;

		// Maintain proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ToolError);
		}

		// Include original error stack if available
		if (originalError?.stack) {
			this.context.stackTrace = originalError.stack;
		}
	}

	/**
	 * Create a ToolError from a generic error
	 */
	static fromError(
		error: Error,
		code: ToolErrorCode,
		context: ToolErrorContext = {}
	): ToolError {
		return new ToolError(
			error.message,
			code,
			context,
			error
		);
	}

	/**
	 * Create a validation error
	 */
	static validationError(
		message: string,
		toolName: string,
		args?: any
	): ToolError {
		return new ToolError(
			message,
			ToolErrorCode.VALIDATION_FAILED,
			{ toolName, args }
		);
	}

	/**
	 * Create a tool not found error
	 */
	static toolNotFound(toolName: string): ToolError {
		return new ToolError(
			`Tool '${toolName}' not found`,
			ToolErrorCode.TOOL_NOT_FOUND,
			{ toolName }
		);
	}

	/**
	 * Create a provider error
	 */
	static providerError(
		message: string,
		provider: string,
		operation?: string,
		originalError?: Error
	): ToolError {
		return new ToolError(
			message,
			ToolErrorCode.PROVIDER_ERROR,
			{ provider, operation },
			originalError
		);
	}

	/**
	 * Create a permission denied error
	 */
	static permissionDenied(
		message: string,
		provider: string,
		operation?: string
	): ToolError {
		return new ToolError(
			message,
			ToolErrorCode.PERMISSION_DENIED,
			{ provider, operation }
		);
	}

	/**
	 * Sanitize sensitive fields in an object by replacing their values with [REDACTED]
	 * @param obj - The object to sanitize
	 * @returns A new sanitized object without modifying the original
	 */
	private sanitizeContext(obj: any): any {
		if (obj === null || obj === undefined) {
			return obj;
		}

		if (typeof obj !== 'object') {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map(item => this.sanitizeContext(item));
		}

		// List of common sensitive field names
		const sensitiveKeys = [
			'password', 'pass', 'pwd', 'token', 'accessToken', 'refreshToken', 
			'secret', 'apiKey', 'authorization', 'auth', 'privateKey', 'secretKey',
			'clientSecret', 'apiSecret', 'bearer', 'jwt', 'sessionId', 'sessionToken'
		];

		const sanitized: any = {};
		for (const [key, value] of Object.entries(obj)) {
			const lowerKey = key.toLowerCase();
			
			// Check if the key matches any sensitive field names
			if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
				sanitized[key] = '[REDACTED]';
			} else {
				// Recursively sanitize nested objects/arrays
				sanitized[key] = this.sanitizeContext(value);
			}
		}

		return sanitized;
	}

	/**
	 * Get a JSON representation of the error with sanitized sensitive fields
	 */
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			context: this.sanitizeContext(this.context),
			stack: this.stack,
			originalError: this.originalError ? {
				name: this.originalError.name,
				message: this.originalError.message,
				stack: this.originalError.stack,
			} : undefined,
		};
	}

	/**
	 * Get a user-friendly error message
	 */
	getUserMessage(): string {
		switch (this.code) {
			case ToolErrorCode.VALIDATION_FAILED:
				return `Invalid input: ${this.message}`;
			case ToolErrorCode.TOOL_NOT_FOUND:
				return `The requested operation is not available: ${this.message}`;
			case ToolErrorCode.PERMISSION_DENIED:
				return `Permission denied: ${this.message}`;
			case ToolErrorCode.PROVIDER_NOT_AVAILABLE:
				return `Calendar service unavailable: ${this.message}`;
			case ToolErrorCode.TIMEOUT:
				return `Operation timed out: ${this.message}`;
			default:
				return this.message;
		}
	}

	/**
	 * Check if the error is retryable
	 */
	isRetryable(): boolean {
		switch (this.code) {
			case ToolErrorCode.TIMEOUT:
			case ToolErrorCode.INTERNAL_ERROR:
			case ToolErrorCode.DEPENDENCY_ERROR:
				return true;
			case ToolErrorCode.VALIDATION_FAILED:
			case ToolErrorCode.PERMISSION_DENIED:
			case ToolErrorCode.TOOL_NOT_FOUND:
				return false;
			default:
				return false;
		}
	}
}

/**
 * Error handler utility functions
 */
export class ToolErrorHandler {
	/**
	 * Handle and log a ToolError
	 */
	static handle(error: ToolError, logger?: any): void {
		const logData = {
			code: error.code,
			context: error.context,
			originalError: error.originalError?.message,
		};

		if (logger) {
			switch (error.code) {
				case ToolErrorCode.VALIDATION_FAILED:
				case ToolErrorCode.INVALID_ARGUMENTS:
					logger.warn('Tool validation error', logData);
					break;
				case ToolErrorCode.PERMISSION_DENIED:
					logger.warn('Permission denied', logData);
					break;
				case ToolErrorCode.TOOL_NOT_FOUND:
					logger.error('Tool not found', logData);
					break;
				default:
					logger.error('Tool error', logData);
					break;
			}
		}
	}

	/**
	 * Convert any error to a ToolError
	 */
	static normalize(
		error: unknown,
		context: ToolErrorContext = {}
	): ToolError {
		if (error instanceof ToolError) {
			return error;
		}

		if (error instanceof Error) {
			return ToolError.fromError(error, ToolErrorCode.INTERNAL_ERROR, context);
		}

		return new ToolError(
			typeof error === 'string' ? error : 'Unknown error',
			ToolErrorCode.INTERNAL_ERROR,
			context
		);
	}
}

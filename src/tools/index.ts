/**
 * Tools Module - MCP Tool Registration and Management System
 */

export * from './base-tool.js';
export * from './tool-factory.js';
export * from './registry.js';
export * from './validation.js';
export * from './errors.js';
export * from './loader.js';
export * from './docs-generator.js';
export * from './calendar-tools.js';

// Re-export commonly used types and utilities
export type { 
	BaseTool, 
	ToolConfig, 
	ToolInputSchema, 
	ToolHandler, 
	ToolExecutionResult,
	ToolExecutionError 
} from './base-tool.js';

export type { 
	ToolType, 
	ToolFactoryConfig 
} from './tool-factory.js';

export type { 
	ToolRegistryConfig, 
	ToolMetrics 
} from './registry.js';

export type {
	ValidationConfig,
	ValidationError
} from './validation.js';

export type {
	ToolErrorContext
} from './errors.js';

export type {
	ToolModuleConfig,
	ToolLoaderConfig,
	ToolModule,
	ToolLoadContext
} from './loader.js';

export type {
	DocumentationConfig,
	ToolDocumentation,
	ParameterDocumentation
} from './docs-generator.js';

export { 
	defaultToolFactory 
} from './tool-factory.js';

export {
	defaultValidator,
	validateToolParameters,
	CalendarSchemas
} from './validation.js';

export {
	ToolError,
	ToolErrorCode,
	ToolErrorHandler
} from './errors.js';

export {
	ToolDocumentationGenerator,
	createDocumentationGenerator
} from './docs-generator.js';

/**
 * Tool Documentation Generator
 * Generates formatted documentation for MCP tools suitable for Claude Desktop
 */

import { BaseTool, ToolExample } from './base-tool.js';
import { ToolRegistry } from './registry.js';
// import { ToolModule } from './loader.js'; // Unused import
import { logger } from '../utils/logger.js';

export interface DocumentationConfig {
	format: 'markdown' | 'json' | 'html';
	includeExamples: boolean;
	includeMetrics: boolean;
	includeSchemas: boolean;
	groupByCategory: boolean;
	outputPath?: string;
}

export interface ToolDocumentation {
	name: string;
	description: string;
	category?: string;
	tags?: string[];
	parameters: ParameterDocumentation[];
	examples?: ToolExample[];
	metrics?: {
		totalExecutions: number;
		successRate: number;
		averageExecutionTime: number;
	};
}

export interface ParameterDocumentation {
	name: string;
	type: string;
	description: string;
	required: boolean;
	default?: any;
	format?: string;
	constraints?: {
		minLength?: number;
		maxLength?: number;
		minimum?: number;
		maximum?: number;
		pattern?: string;
		enum?: any[];
	};
}

export class ToolDocumentationGenerator {
	private registry: ToolRegistry;
	private config: DocumentationConfig;

	constructor(registry: ToolRegistry, config: Partial<DocumentationConfig> = {}) {
		this.registry = registry;
		this.config = {
			format: 'markdown',
			includeExamples: true,
			includeMetrics: false,
			includeSchemas: true,
			groupByCategory: true,
			...config,
		};
	}

	/**
	 * Generate documentation for all registered tools
	 */
	generateDocumentation(): string {
		const tools = this.registry.getAllTools();
		
		switch (this.config.format) {
			case 'markdown':
				return this.generateMarkdownDocumentation(tools);
			case 'json':
				return this.generateJsonDocumentation(tools);
			case 'html':
				return this.generateHtmlDocumentation(tools);
			default:
				throw new Error(`Unsupported documentation format: ${this.config.format}`);
		}
	}

	/**
	 * Generate Markdown documentation
	 */
	private generateMarkdownDocumentation(tools: BaseTool[]): string {
		let markdown = '# Calendar MCP Server - Tool Documentation\n\n';
		markdown += `Generated on: ${new Date().toISOString()}\n\n`;
		
		const stats = this.registry.getStats();
		markdown += `**Total Tools:** ${stats.totalTools}\n`;
		markdown += `**Categories:** ${stats.categories.join(', ')}\n`;
		markdown += `**Tags:** ${stats.tags.join(', ')}\n\n`;

		if (this.config.groupByCategory) {
			markdown += this.generateMarkdownByCategory(tools);
		} else {
			markdown += this.generateMarkdownByTool(tools);
		}

		return markdown;
	}

	/**
	 * Generate Markdown documentation grouped by category
	 */
	private generateMarkdownByCategory(tools: BaseTool[]): string {
		let markdown = '';
		const toolsByCategory = this.groupToolsByCategory(tools);

		for (const [category, categoryTools] of toolsByCategory.entries()) {
			markdown += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Tools\n\n`;
			
			for (const tool of categoryTools) {
				markdown += this.generateToolMarkdown(tool);
			}
		}

		return markdown;
	}

	/**
	 * Generate Markdown documentation for individual tools
	 */
	private generateMarkdownByTool(tools: BaseTool[]): string {
		let markdown = '## Available Tools\n\n';
		
		for (const tool of tools) {
			markdown += this.generateToolMarkdown(tool);
		}

		return markdown;
	}

	/**
	 * Generate Markdown for a single tool
	 */
	private generateToolMarkdown(tool: BaseTool): string {
		const toolDoc = this.extractToolDocumentation(tool);
		
		let markdown = `### ${toolDoc.name}\n\n`;
		markdown += `**Description:** ${toolDoc.description}\n\n`;

		if (toolDoc.category) {
			markdown += `**Category:** ${toolDoc.category}\n\n`;
		}

		if (toolDoc.tags && toolDoc.tags.length > 0) {
			markdown += `**Tags:** ${toolDoc.tags.join(', ')}\n\n`;
		}

		// Parameters
		if (toolDoc.parameters.length > 0) {
			markdown += '**Parameters:**\n\n';
			for (const param of toolDoc.parameters) {
				markdown += `- **${param.name}** (${param.type})`;
				if (param.required) markdown += ' *required*';
				markdown += `\n  - ${param.description}\n`;
				
				if (param.constraints) {
					const constraints = [];
					if (param.constraints.minLength) constraints.push(`min length: ${param.constraints.minLength}`);
					if (param.constraints.maxLength) constraints.push(`max length: ${param.constraints.maxLength}`);
					if (param.constraints.minimum) constraints.push(`min: ${param.constraints.minimum}`);
					if (param.constraints.maximum) constraints.push(`max: ${param.constraints.maximum}`);
					if (param.constraints.enum) constraints.push(`values: ${param.constraints.enum.join(', ')}`);
					
					if (constraints.length > 0) {
						markdown += `  - Constraints: ${constraints.join(', ')}\n`;
					}
				}
				
				if (param.default !== undefined) {
					markdown += `  - Default: ${JSON.stringify(param.default)}\n`;
				}
				markdown += '\n';
			}
		} else {
			markdown += '**Parameters:** None\n\n';
		}

		// Examples
		if (this.config.includeExamples && toolDoc.examples && toolDoc.examples.length > 0) {
			markdown += '**Examples:**\n\n';
			for (const example of toolDoc.examples) {
				markdown += `**${example.description}**\n\n`;
				markdown += '```json\n';
				markdown += JSON.stringify(example.input, null, 2);
				markdown += '\n```\n\n';
				
				if (example.expectedOutput) {
					markdown += 'Expected output:\n```json\n';
					markdown += JSON.stringify(example.expectedOutput, null, 2);
					markdown += '\n```\n\n';
				}
			}
		}

		// Metrics
		if (this.config.includeMetrics && toolDoc.metrics) {
			markdown += '**Usage Statistics:**\n\n';
			markdown += `- Total executions: ${toolDoc.metrics.totalExecutions}\n`;
			markdown += `- Success rate: ${(toolDoc.metrics.successRate * 100).toFixed(1)}%\n`;
			markdown += `- Average execution time: ${toolDoc.metrics.averageExecutionTime.toFixed(2)}ms\n\n`;
		}

		markdown += '---\n\n';
		return markdown;
	}

	/**
	 * Generate JSON documentation
	 */
	private generateJsonDocumentation(tools: BaseTool[]): string {
		const documentation = {
			metadata: {
				title: 'Calendar MCP Server - Tool Documentation',
				generatedAt: new Date().toISOString(),
				version: '1.0.0',
				stats: this.registry.getStats(),
			},
			tools: tools.map(tool => this.extractToolDocumentation(tool)),
		};

		return JSON.stringify(documentation, null, 2);
	}

	/**
	 * Escape HTML special characters to prevent XSS
	 */
	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/\//g, '&#x2F;');
	}

	/**
	 * Generate HTML documentation
	 */
	private generateHtmlDocumentation(tools: BaseTool[]): string {
		let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calendar MCP Server - Tool Documentation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .tool { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .tool-name { color: #0066cc; margin-bottom: 10px; }
        .parameter { background: #f5f5f5; padding: 10px; margin: 5px 0; border-radius: 4px; }
        .required { color: #cc0000; font-weight: bold; }
        .example { background: #f9f9f9; padding: 15px; border-left: 4px solid #0066cc; margin: 10px 0; }
        pre { background: #f0f0f0; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>Calendar MCP Server - Tool Documentation</h1>
    <p>Generated on: ${new Date().toISOString()}</p>
`;

		const stats = this.registry.getStats();
		html += `<p><strong>Total Tools:</strong> ${this.escapeHtml(stats.totalTools.toString())}</p>`;
		html += `<p><strong>Categories:</strong> ${this.escapeHtml(stats.categories.join(', '))}</p>`;

		for (const tool of tools) {
			const toolDoc = this.extractToolDocumentation(tool);
			html += `<div class="tool">`;
			html += `<h2 class="tool-name">${this.escapeHtml(toolDoc.name)}</h2>`;
			html += `<p>${this.escapeHtml(toolDoc.description)}</p>`;
			
			if (toolDoc.parameters.length > 0) {
				html += `<h3>Parameters</h3>`;
				for (const param of toolDoc.parameters) {
					html += `<div class="parameter">`;
					html += `<strong>${this.escapeHtml(param.name)}</strong> (${this.escapeHtml(param.type)})`;
					if (param.required) html += ` <span class="required">required</span>`;
					html += `<br>${this.escapeHtml(param.description)}`;
					html += `</div>`;
				}
			}

			html += `</div>`;
		}

		html += `
</body>
</html>`;

		return html;
	}

	/**
	 * Extract documentation from a tool
	 */
	private extractToolDocumentation(tool: BaseTool): ToolDocumentation {
		const metadata = tool.getMetadata();
		const parameters = this.extractParameters(metadata.inputSchema);
		
		const doc: ToolDocumentation = {
			name: metadata.name,
			description: metadata.description,
			category: metadata.category,
			tags: metadata.tags,
			parameters,
			examples: metadata.examples,
		};

		// Add metrics if enabled
		if (this.config.includeMetrics) {
			const metrics = this.registry.getToolMetrics(metadata.name);
			if (metrics) {
				doc.metrics = {
					totalExecutions: metrics.totalExecutions,
					successRate: metrics.totalExecutions > 0 
						? metrics.successfulExecutions / metrics.totalExecutions 
						: 0,
					averageExecutionTime: metrics.averageExecutionTime,
				};
			}
		}

		return doc;
	}

	/**
	 * Extract parameter documentation from input schema
	 */
	private extractParameters(schema: any): ParameterDocumentation[] {
		const parameters: ParameterDocumentation[] = [];

		if (schema.properties) {
			for (const [name, propSchema] of Object.entries(schema.properties) as [string, any][]) {
				const param: ParameterDocumentation = {
					name,
					type: propSchema.type || 'unknown',
					description: propSchema.description || 'No description available',
					required: schema.required?.includes(name) || false,
				};

				// Add constraints
				const constraints: any = {};
				if (propSchema.minLength !== undefined) constraints.minLength = propSchema.minLength;
				if (propSchema.maxLength !== undefined) constraints.maxLength = propSchema.maxLength;
				if (propSchema.minimum !== undefined) constraints.minimum = propSchema.minimum;
				if (propSchema.maximum !== undefined) constraints.maximum = propSchema.maximum;
				if (propSchema.pattern) constraints.pattern = propSchema.pattern;
				if (propSchema.enum) constraints.enum = propSchema.enum;

				if (Object.keys(constraints).length > 0) {
					param.constraints = constraints;
				}

				if (propSchema.default !== undefined) {
					param.default = propSchema.default;
				}

				if (propSchema.format) {
					param.format = propSchema.format;
				}

				parameters.push(param);
			}
		}

		return parameters;
	}

	/**
	 * Group tools by category
	 */
	private groupToolsByCategory(tools: BaseTool[]): Map<string, BaseTool[]> {
		const grouped = new Map<string, BaseTool[]>();

		for (const tool of tools) {
			const metadata = tool.getMetadata();
			const category = metadata.category || 'general';
			
			if (!grouped.has(category)) {
				grouped.set(category, []);
			}
			
			grouped.get(category)!.push(tool);
		}

		return grouped;
	}

	/**
	 * Generate documentation for a specific tool
	 */
	generateToolDocumentation(toolName: string): string | null {
		const tool = this.registry.getTool(toolName);
		if (!tool) {
			logger.warn('Tool not found for documentation generation', { toolName });
			return null;
		}

		const toolDoc = this.extractToolDocumentation(tool);
		
		switch (this.config.format) {
			case 'markdown':
				return this.generateToolMarkdown(tool);
			case 'json':
				return JSON.stringify(toolDoc, null, 2);
			default:
				return this.generateToolMarkdown(tool);
		}
	}

	/**
	 * Generate a quick reference guide
	 */
	generateQuickReference(): string {
		const tools = this.registry.getAllTools();
		let reference = '# Calendar MCP Server - Quick Reference\n\n';
		
		reference += '| Tool Name | Description | Required Parameters |\n';
		reference += '|-----------|-------------|--------------------|\n';

		for (const tool of tools) {
			const metadata = tool.getMetadata();
			const requiredParams = this.extractParameters(metadata.inputSchema)
				.filter(p => p.required)
				.map(p => p.name)
				.join(', ') || 'None';

			reference += `| \`${metadata.name}\` | ${metadata.description} | ${requiredParams} |\n`;
		}

		return reference;
	}

	/**
	 * Generate usage examples for all tools
	 */
	generateUsageExamples(): string {
		const tools = this.registry.getAllTools();
		let examples = '# Calendar MCP Server - Usage Examples\n\n';

		for (const tool of tools) {
			const metadata = tool.getMetadata();
			examples += `## ${metadata.name}\n\n`;
			examples += `${metadata.description}\n\n`;

			// Generate a basic example based on the schema
			const exampleInput = this.generateExampleInput(metadata.inputSchema);
			if (exampleInput) {
				examples += '```json\n';
				examples += JSON.stringify(exampleInput, null, 2);
				examples += '\n```\n\n';
			}

			if (metadata.examples && metadata.examples.length > 0) {
				examples += '### Additional Examples\n\n';
				for (const example of metadata.examples) {
					examples += `**${example.description}**\n\n`;
					examples += '```json\n';
					examples += JSON.stringify(example.input, null, 2);
					examples += '\n```\n\n';
				}
			}

			examples += '---\n\n';
		}

		return examples;
	}

	/**
	 * Generate example input based on schema
	 */
	private generateExampleInput(schema: any): any {
		if (!schema.properties) return null;

		const example: any = {};

		for (const [name, propSchema] of Object.entries(schema.properties) as [string, any][]) {
			switch (propSchema.type) {
				case 'string':
					if (propSchema.format === 'date-time') {
						example[name] = '2024-01-01T00:00:00.000Z';
					} else if (name.includes('Date')) {
						example[name] = '2024-01-01T00:00:00.000Z';
					} else {
						example[name] = propSchema.description?.includes('ID') ? 'example-id' : 'example value';
					}
					break;
				case 'number':
				case 'integer':
					example[name] = 1;
					break;
				case 'boolean':
					example[name] = true;
					break;
				case 'array':
					example[name] = ['example-item'];
					break;
				case 'object':
					example[name] = {};
					break;
			}
		}

		return example;
	}

	/**
	 * Get tool documentation as structured data
	 */
	getToolDocumentationData(): ToolDocumentation[] {
		const tools = this.registry.getAllTools();
		return tools.map(tool => this.extractToolDocumentation(tool));
	}

	/**
	 * Export documentation to file (placeholder)
	 */
	async exportToFile(content: string, filename?: string): Promise<string> {
		const outputPath = filename || this.config.outputPath || `tools-documentation.${this.config.format}`;
		
		// TODO: Implement file writing
		logger.info('Documentation generated', { 
			format: this.config.format,
			outputPath,
			contentLength: content.length 
		});
		
		return outputPath;
	}
}

// Export a default documentation generator
export const createDocumentationGenerator = (registry: ToolRegistry, config?: Partial<DocumentationConfig>) => {
	return new ToolDocumentationGenerator(registry, config);
};

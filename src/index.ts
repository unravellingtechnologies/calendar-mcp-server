// Calendar MCP Server Entry Point
import { CalendarMCPServer } from './server/index.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';
import { CalendarProviderManager, CalDAVProvider } from './providers/index.js';
import { defaultCredentialManager } from './credentials/index.js';
import { cliParser, CLIParser } from './cli/index.js';
import { createCalendarTools } from './tools/calendar-tools.js';

// Dynamically import package.json
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const main = async () => {
	try {
		// Parse command-line arguments
		const args = cliParser.parse();
		
		// Update log level if specified
		if (args.logLevel) {
			const logLevelMap = {
				'debug': 0,
				'info': 1, 
				'warn': 2,
				'error': 3
			};
			logger.setLevel(logLevelMap[args.logLevel] || 1);
		} else {
			logger.setLevel(config.logLevel);
		}

		if (args.verbose) {
			logger.setLevel(0); // Debug level
		}

			logger.info('Calendar MCP Server starting...', { 
				args: {
					dev: args.dev,
					logLevel: args.logLevel
				}
			});

		const server = new CalendarMCPServer({
			name: packageJson.name,
			version: packageJson.version,
			description: packageJson.description,
		});

		// Initialize calendar provider manager
		const providerManager = new CalendarProviderManager();

		// Register providers based on command-line arguments
		let defaultProviderSet = false;


		// Register CalDAV providers based on environment variables
		try {
			const caldavCredentialsList = CLIParser.createCalDAVCredentials();
			
			for (const caldavCredentials of caldavCredentialsList) {
				const caldavProvider = new CalDAVProvider({
					credentials: caldavCredentials,
					timeout: 15000,
					enableCache: true,
				});

				await providerManager.registerProvider(caldavProvider);
				if (!defaultProviderSet) {
					providerManager.setDefaultProvider(`caldav-${caldavCredentials.serverType}`);
					defaultProviderSet = true;
				}
				logger.info('CalDAV provider registered', { 
					serverType: caldavCredentials.serverType,
					serverUrl: caldavCredentials.serverUrl 
				});
			}
		} catch (error) {
			logger.error('Failed to register CalDAV providers', { error });
			if (args.dev) {
				throw error; // Fail fast in development
			}
		}

		if (!defaultProviderSet) {
			logger.error('No calendar providers could be registered. Please provide CalDAV credentials.');
			if (!args.dev) {
				console.error('\nSetup Instructions:');
				console.error(CLIParser.getSetupInstructions('icloud'));
			}
			process.exit(1);
		}

		// Register calendar tools using the factory
		const calendarTools = createCalendarTools({
			providerManager,
			logger,
			server,
		});

		// Register each tool with the server
		for (const tool of calendarTools) {
			server.registerTool(tool);
		}

		await server.start();

		const gracefulShutdown = async (signal: string) => {
			logger.info(`Received ${signal}. Shutting down gracefully...`);
			await server.stop();
			await providerManager.dispose();
			process.exit(0);
		};

		process.on('SIGINT', () => gracefulShutdown('SIGINT'));
		process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Failed to initialize or start the server', { error: errorMessage });
		process.exit(1);
	}
};

main();

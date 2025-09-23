// Calendar MCP Server Entry Point
import { CalendarMCPServer } from './server/index.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';
import { CalendarProviderManager, CalDAVProvider } from './providers/index.js';
// import { defaultCredentialManager } from './credentials/index.js';
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
		const providerManager = new CalendarProviderManager({
			enableEventKit: args.enableEventkit || process.env.EVENTKIT_ENABLED === 'true'
		});

		// Register providers based on command-line arguments
		let defaultProviderSet = false;

		// Request calendar permissions for EventKit if enabled
		if (args.enableEventkit || process.env.EVENTKIT_ENABLED === 'true') {
			try {
				logger.info('Initializing EventKit provider...');
				
				// Import and create EventKit provider
				const { EventKitProvider } = await import('./providers/EventKitProvider.js');
				const eventkitProvider = new EventKitProvider();
				
				// Register the EventKit provider
				await providerManager.registerProvider(eventkitProvider);
				await providerManager.setDefaultProvider('eventkit');
				defaultProviderSet = true; // Mark that we have a default provider
				
				// Check current access status
				const authStatus = await eventkitProvider.getAuthorizationStatus();
				logger.info('EventKit authorization status', authStatus);
				
				if (authStatus.hasAccess) {
					logger.info('✅ Calendar permissions already granted for EventKit');
				} else {
					// If user requested permissions interactively, try to request them
					if (args.requestPermissions) {
						logger.info('🔄 Requesting calendar permissions interactively...');
						try {
							const granted = await eventkitProvider.requestAccess();
							if (granted) {
								logger.info('✅ Calendar permissions granted! You can now use the MCP server.');
							} else {
								logger.warn('❌ Calendar permissions denied by user');
							}
						} catch (error) {
							logger.error('Failed to request permissions', { error });
						}
					} else {
						// Provide guidance for different permission states
						switch (authStatus.statusString) {
							case 'notDetermined':
								logger.warn('⚠️ Calendar permissions not yet requested for EventKit');
								logger.info('💡 SOLUTION: Run this command in Terminal to trigger permission dialog:');
								logger.info('   node ' + process.argv[1] + ' --enable-eventkit --request-permissions');
								logger.info('   Then grant permission when the macOS dialog appears.');
								break;
							case 'denied':
								logger.warn('❌ Calendar permissions denied for EventKit');
								logger.info('💡 SOLUTION: Reset permissions and try again:');
								logger.info('   1. Run: tccutil reset Calendar');
								logger.info('   2. Then run: node ' + process.argv[1] + ' --enable-eventkit --request-permissions');
								break;
							case 'restricted':
								logger.warn('🔒 Calendar permissions restricted by system policy for EventKit');
								logger.info('💡 Contact your system administrator to enable calendar access');
								break;
							default:
								logger.warn('⚠️ Calendar permissions not granted for EventKit - status: ' + authStatus.statusString);
								break;
						}
					}
				}
			} catch (error) {
				logger.error('Failed to initialize EventKit provider', { 
					error: error instanceof Error ? error.message : error,
					stack: error instanceof Error ? error.stack : undefined
				});
				if (args.dev) {
					throw error; // Fail fast in development
				}
			}
		}


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
				if (!defaultProviderSet && !(args.enableEventkit || process.env.EVENTKIT_ENABLED === 'true')) {
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

		// Ensure we have a default provider set
		if (!defaultProviderSet) {
			if (args.enableEventkit || process.env.EVENTKIT_ENABLED === 'true') {
				defaultProviderSet = true; // EventKit was already set as default above
			} else {
				logger.error('No calendar providers could be registered. Please provide CalDAV credentials or enable EventKit.');
				if (!args.dev) {
					console.error('\nSetup Instructions:');
					console.error(CLIParser.getSetupInstructions('icloud'));
				}
				process.exit(1);
			}
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

		// Add error handlers to catch any unhandled issues
		process.on('uncaughtException', (error) => {
			logger.error('Uncaught exception', { error: error.message, stack: error.stack });
			process.exit(1);
		});

		process.on('unhandledRejection', (reason, promise) => {
			logger.error('Unhandled promise rejection', { reason, promise });
			process.exit(1);
		});

		const gracefulShutdown = async (signal: string) => {
			logger.info(`Received ${signal}. Shutting down gracefully...`);
			await server.stop();
			await providerManager.dispose();
			process.exit(0);
		};

		process.on('SIGINT', () => gracefulShutdown('SIGINT'));
		process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

		// Keep the process alive
		logger.info('MCP Server is running and ready to accept requests');
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		logger.error('Failed to initialize or start the server', { error: errorMessage });
		process.exit(1);
	}
};

main();

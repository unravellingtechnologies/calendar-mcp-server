/**
 * Command-line argument parsing for Calendar MCP Server
 */

import { Command } from 'commander';
import { CalDAVCredentials } from '../providers/CalDAVProvider.js';
import { logger } from '../utils/logger.js';
import { CalendarCredentials } from '../credentials/CredentialManager.js';

// Valid server types for validation
const VALID_SERVER_TYPES: readonly CalendarCredentials['serverType'][] = ['icloud', 'google', 'exchange', 'generic'] as const;

/**
 * Type guard to validate if a string is a valid server type
 * @param value - The string to validate
 * @returns True if the value is a valid server type
 */
function isValidServerType(value: string): value is CalendarCredentials['serverType'] {
	return VALID_SERVER_TYPES.includes(value as CalendarCredentials['serverType']);
}

export interface ServerArgs {
	// Server options
	logLevel?: 'debug' | 'info' | 'warn' | 'error';
	
	// Development options
	dev?: boolean;
	verbose?: boolean;
	
	// CalDAV options (for backward compatibility and logging)
	caldavProvider?: string;
	enableCalDAV?: boolean;
	caldavUsername?: string;
	caldavPassword?: string;
	
	// EventKit options
	enableEventkit?: boolean;
	requestPermissions?: boolean;
}

export interface CalDAVProviderConfig {
	provider: string;
	username: string;
	password: string;
	serverUrl?: string;
}

export class CLIParser {
	private program: Command;

	constructor() {
		this.program = new Command();
		this.setupCommands();
	}

	/**
	 * Get all available provider configurations based on environment variables
	 */
	private static getAvailableProviders(): CalDAVProviderConfig[] {
		const providers = [
			{ name: 'icloud', username: 'ICLOUD_CALDAV_USERNAME', password: 'ICLOUD_CALDAV_PASSWORD', serverUrl: 'https://caldav.icloud.com' },
			{ name: 'google', username: 'GOOGLE_CALDAV_USERNAME', password: 'GOOGLE_CALDAV_PASSWORD', serverUrl: 'https://apidata.googleusercontent.com/caldav/v2' },
			{ name: 'exchange', username: 'EXCHANGE_CALDAV_USERNAME', password: 'EXCHANGE_CALDAV_PASSWORD', serverUrlEnv: 'EXCHANGE_CALDAV_SERVER' },
			{ name: 'generic', username: 'GENERIC_CALDAV_USERNAME', password: 'GENERIC_CALDAV_PASSWORD', serverUrlEnv: 'GENERIC_CALDAV_SERVER' }
		];

		const availableProviders: CalDAVProviderConfig[] = [];

		for (const provider of providers) {
			const username = process.env[provider.username];
			const password = process.env[provider.password];
			
			if (username && password) {
				let serverUrl = provider.serverUrl;
				
				// For exchange and generic, check for custom server URL
				if (provider.serverUrlEnv) {
					serverUrl = process.env[provider.serverUrlEnv] || serverUrl;
				}
				
				availableProviders.push({
					provider: provider.name,
					username,
					password,
					serverUrl
				});
			}
		}

		return availableProviders;
	}

	/**
	 * Get provider-specific environment variable names
	 */
	private static getProviderEnvVars(provider: string): { username: string; password: string } {
		switch (provider) {
			case 'icloud':
				return {
					username: 'ICLOUD_CALDAV_USERNAME',
					password: 'ICLOUD_CALDAV_PASSWORD'
				};
			case 'google':
				return {
					username: 'GOOGLE_CALDAV_USERNAME',
					password: 'GOOGLE_CALDAV_PASSWORD'
				};
			case 'exchange':
				return {
					username: 'EXCHANGE_CALDAV_USERNAME',
					password: 'EXCHANGE_CALDAV_PASSWORD'
				};
			default:
				return {
					username: 'GENERIC_CALDAV_USERNAME',
					password: 'GENERIC_CALDAV_PASSWORD'
				};
		}
	}

	private setupCommands(): void {
		this.program
			.name('calendar-mcp-server')
			.description('Calendar MCP Server for Claude Desktop and other MCP clients')
			.version('0.1.0');

		// Server options
		this.program
			.option('--log-level <level>', 'Logging level', 'info')
			.option('--dev', 'Development mode', false)
			.option('-v, --verbose', 'Verbose logging', false)
			.option('--enable-eventkit', 'Enable EventKit provider for macOS Calendar access')
			.option('--request-permissions', 'Request EventKit permissions interactively (shows permission dialog)');

		// Help examples
		this.program.addHelpText('after', `

Examples:
  # Single provider (iCloud)
  ICLOUD_CALDAV_USERNAME=user@icloud.com ICLOUD_CALDAV_PASSWORD=xxxx-xxxx-xxxx-xxxx node dist/index.js

  # Multiple providers simultaneously
  ICLOUD_CALDAV_USERNAME=user@icloud.com ICLOUD_CALDAV_PASSWORD=xxxx-xxxx-xxxx-xxxx \\
  GOOGLE_CALDAV_USERNAME=user@gmail.com GOOGLE_CALDAV_PASSWORD=oauth-token \\
  node dist/index.js

  # Development mode
  node dist/index.js --dev --log-level=debug

Setup Instructions:
  iCloud: Generate app-specific password at appleid.apple.com > Security > App-Specific Passwords
  Google: Use OAuth 2.0 flow to get access token
  Exchange: Get server URL from IT administrator
  
  Set credentials via provider-specific environment variables:
  iCloud:   export ICLOUD_CALDAV_USERNAME=your-username ICLOUD_CALDAV_PASSWORD=your-password
  Google:   export GOOGLE_CALDAV_USERNAME=your-username GOOGLE_CALDAV_PASSWORD=your-password
  Exchange: export EXCHANGE_CALDAV_USERNAME=your-username EXCHANGE_CALDAV_PASSWORD=your-password
  Generic:  export GENERIC_CALDAV_USERNAME=your-username GENERIC_CALDAV_PASSWORD=your-password
  
  The server will automatically detect and enable all providers with valid credentials.
`);
	}

	parse(argv?: string[]): ServerArgs {
		this.program.parse(argv);
		const options = this.program.opts();

		// Detect available providers
		const availableProviders = CLIParser.getAvailableProviders();
		const eventkitEnabled = options.enableEventkit || process.env.EVENTKIT_ENABLED === 'true';
		
		// Only warn about CalDAV if no providers are configured at all (including EventKit)
		if (availableProviders.length === 0 && !eventkitEnabled) {
			logger.warn('No calendar providers configured. Set environment variables for at least one provider:');
			logger.warn('  iCloud:   ICLOUD_CALDAV_USERNAME and ICLOUD_CALDAV_PASSWORD');
			logger.warn('  Google:   GOOGLE_CALDAV_USERNAME and GOOGLE_CALDAV_PASSWORD');
			logger.warn('  Exchange: EXCHANGE_CALDAV_USERNAME and EXCHANGE_CALDAV_PASSWORD');
			logger.warn('  Generic:  GENERIC_CALDAV_USERNAME and GENERIC_CALDAV_PASSWORD');
			logger.warn('  Or enable EventKit: --enable-eventkit');
		} else {
			const providerList = [];
			if (eventkitEnabled) providerList.push('EventKit');
			if (availableProviders.length > 0) {
				providerList.push(...availableProviders.map(p => `CalDAV-${p.provider}`));
			}
			logger.info(`Found ${providerList.length} calendar provider(s): ${providerList.join(', ')}`);
		}

		return {
			logLevel: options.logLevel,
			dev: options.dev,
			verbose: options.verbose,
			enableEventkit: options.enableEventkit,
			requestPermissions: options.requestPermissions,
		};
	}

	/**
	 * Create CalDAV credentials for all available providers
	 */
	static createCalDAVCredentials(): CalDAVCredentials[] {
		const availableProviders = CLIParser.getAvailableProviders();
		const credentials: CalDAVCredentials[] = [];

		for (const provider of availableProviders) {
			// Validate serverType before using it
			if (!isValidServerType(provider.provider)) {
				logger.warn('Invalid server type in provider configuration, skipping', { 
					provider: provider.provider,
					validTypes: VALID_SERVER_TYPES 
				});
				continue;
			}

			credentials.push({
				serverUrl: provider.serverUrl || this.getDefaultServerUrl(provider.provider),
				username: provider.username,
				password: provider.password,
				serverType: provider.provider as CalendarCredentials['serverType'],
			});
		}

		return credentials;
	}

	/**
	 * Get default server URLs for known providers
	 */
	private static getDefaultServerUrl(serverType: string): string {
		switch (serverType) {
			case 'icloud':
				return 'https://caldav.icloud.com';
			case 'google':
				return 'https://apidata.googleusercontent.com/caldav/v2';
			case 'exchange':
				throw new Error('Exchange server URL must be provided via EXCHANGE_CALDAV_SERVER environment variable');
			default:
				throw new Error('Generic CalDAV server URL must be provided via GENERIC_CALDAV_SERVER environment variable');
		}
	}

	/**
	 * Show help
	 */
	showHelp(): void {
		this.program.help();
	}

	/**
	 * Get setup instructions for a provider
	 */
	static getSetupInstructions(serverType: string): string {
		const envVars = CLIParser.getProviderEnvVars(serverType);
		
		switch (serverType) {
			case 'icloud':
				return `
iCloud CalDAV Setup:
1. Go to appleid.apple.com and sign in
2. Navigate to Security > App-Specific Passwords  
3. Generate password for "Calendar MCP Server"
4. Set environment variables:
   export ${envVars.username}=your@icloud.com
   export ${envVars.password}=xxxx-xxxx-xxxx-xxxx
5. Run: node dist/index.js
`;

			case 'google':
				return `
Google Calendar CalDAV Setup:
1. Enable Calendar API in Google Cloud Console
2. Create OAuth 2.0 credentials and complete flow
3. Set environment variables:
   export ${envVars.username}=your@gmail.com
   export ${envVars.password}=oauth-access-token
4. Run: node dist/index.js
`;

			case 'exchange':
				return `
Exchange CalDAV Setup:
1. Get Exchange server URL from IT administrator
2. Set environment variables:
   export ${envVars.username}=domain\\\\user
   export ${envVars.password}=password
   export EXCHANGE_CALDAV_SERVER=https://your-exchange.com
3. Run: node dist/index.js
`;

			default:
				return `
Generic CalDAV Setup:
1. Get CalDAV server URL from your provider
2. Set environment variables:
   export ${envVars.username}=user
   export ${envVars.password}=password
   export GENERIC_CALDAV_SERVER=https://your-server.com
3. Run: node dist/index.js
`;
		}
	}
}

export const cliParser = new CLIParser();

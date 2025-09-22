/**
 * Cross-Platform Credential Management System
 * Supports multiple storage backends and credential-as-parameter approach
 * Includes optional encryption for sensitive credential data
 */

import { logger } from '../utils/logger.js';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { spawn } from 'child_process';

export interface CalendarCredentials {
	id: string; // Unique identifier for this credential set
	name: string; // User-friendly name
	serverUrl: string;
	username: string;
	password: string; // App-specific password for iCloud, OAuth token for others
	serverType: 'icloud' | 'google' | 'exchange' | 'generic';
	metadata?: {
		createdAt?: Date;
		lastUsed?: Date;
		description?: string;
		encrypted?: boolean; // Indicates if the credential data is encrypted
		encryptionAlgorithm?: string; // Algorithm used for encryption
	};
}

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

export interface CredentialStorageBackend {
	name: string;
	isAvailable(): Promise<boolean>;
	// eslint-disable-next-line no-unused-vars
	store(id: string, credentials: CalendarCredentials): Promise<void>;
	// eslint-disable-next-line no-unused-vars
	retrieve(id: string): Promise<CalendarCredentials | null>;
	list(): Promise<string[]>;
	// eslint-disable-next-line no-unused-vars
	delete(id: string): Promise<boolean>;
}

export interface CredentialManagerConfig {
	preferredBackend?: 'keychain' | 'env' | 'memory' | 'auto';
	allowParameterCredentials?: boolean;
	/** 
	 * Optional encryption key for sensitive credential data
	 * When provided, credentials will be encrypted using AES-256-GCM
	 * Only the password field is encrypted; other metadata remains in plain text
	 */
	encryptionKey?: string;
}

/**
 * Encryption utilities for credential data using AES-256-GCM
 * 
 * This class provides secure encryption and decryption of sensitive credential data
 * using industry-standard cryptographic practices:
 * - AES-256-GCM for authenticated encryption
 * - scrypt for secure key derivation with random salt
 * - Random IV for each encryption operation
 * - Authentication tags to prevent tampering
 */
class CredentialEncryption {
	static readonly ALGORITHM = 'aes-256-gcm';
	private static readonly SALT_LENGTH = 32;
	private static readonly IV_LENGTH = 16;
	private static readonly TAG_LENGTH = 16;
	private static readonly KEY_LENGTH = 32;

	/**
	 * Encrypt data using AES-256-GCM with scrypt key derivation
	 * 
	 * @param data - The plaintext data to encrypt
	 * @param password - The password to derive the encryption key from
	 * @returns Base64-encoded encrypted data with salt, IV, tag, and ciphertext
	 */
	static async encrypt(data: string, password: string): Promise<string> {
		const salt = randomBytes(this.SALT_LENGTH);
		const iv = randomBytes(this.IV_LENGTH);
		
		// Derive key from password using scrypt
		const scryptAsync = promisify(scrypt);
		const key = await scryptAsync(password, salt, this.KEY_LENGTH) as Buffer;
		
		const cipher = createCipheriv(this.ALGORITHM, key, iv);
		cipher.setAAD(salt);
		
		let encrypted = cipher.update(data, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		
		// Get authentication tag
		const tag = cipher.getAuthTag();
		
		// Combine salt + iv + tag + encrypted data
		const result = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);
		return result.toString('base64');
	}

	/**
	 * Decrypt data that was encrypted with the encrypt method
	 * 
	 * @param encryptedData - Base64-encoded encrypted data with salt, IV, tag, and ciphertext
	 * @param password - The password to derive the decryption key from
	 * @returns The decrypted plaintext data
	 * @throws Error if decryption fails (wrong password, corrupted data, etc.)
	 */
	static async decrypt(encryptedData: string, password: string): Promise<string> {
		const buffer = Buffer.from(encryptedData, 'base64');
		
		// Extract components
		const salt = buffer.subarray(0, this.SALT_LENGTH);
		const iv = buffer.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
		const tag = buffer.subarray(this.SALT_LENGTH + this.IV_LENGTH, this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
		const encrypted = buffer.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
		
		// Derive key from password using scrypt
		const scryptAsync = promisify(scrypt);
		const key = await scryptAsync(password, salt, this.KEY_LENGTH) as Buffer;
		
		const decipher = createDecipheriv(this.ALGORITHM, key, iv);
		decipher.setAAD(salt);
		decipher.setAuthTag(tag);
		
		let decrypted = decipher.update(encrypted, undefined, 'utf8');
		decrypted += decipher.final('utf8');
		
		return decrypted;
	}

	/**
	 * Check if a string appears to be encrypted data
	 * 
	 * @param data - The string to check
	 * @returns true if the data appears to be in the expected encrypted format
	 */
	static isEncrypted(data: string): boolean {
		try {
			const buffer = Buffer.from(data, 'base64');
			// Check if it has the expected minimum length for our encrypted format
			return buffer.length >= this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH + 1;
		} catch {
			return false;
		}
	}
}

/**
 * Memory storage backend (temporary, cross-platform)
 */
class MemoryStorageBackend implements CredentialStorageBackend {
	name = 'memory';
	private credentials: Map<string, CalendarCredentials> = new Map();

	async isAvailable(): Promise<boolean> {
		return true; // Always available
	}

	async store(id: string, credentials: CalendarCredentials): Promise<void> {
		this.credentials.set(id, { ...credentials });
		logger.debug('Stored credentials in memory', { id, serverType: credentials.serverType });
	}

	async retrieve(id: string): Promise<CalendarCredentials | null> {
		const creds = this.credentials.get(id);
		if (creds) {
			// Update last used timestamp while preserving all existing metadata
			creds.metadata = { 
				...creds.metadata,
				createdAt: creds.metadata?.createdAt || new Date(),
				lastUsed: new Date(),
			};
		}
		return creds || null;
	}

	async list(): Promise<string[]> {
		return Array.from(this.credentials.keys());
	}

	async delete(id: string): Promise<boolean> {
		return this.credentials.delete(id);
	}
}

/**
 * Environment variable storage backend
 */
class EnvironmentStorageBackend implements CredentialStorageBackend {
	name = 'env';

	async isAvailable(): Promise<boolean> {
		return true; // Always available
	}

	async store(id: string, credentials: CalendarCredentials): Promise<void> {
		// Environment variables are read-only, so this is a no-op
		logger.warn('Cannot store credentials in environment backend - read-only', { id });
		// Suppress unused parameter warning
		void credentials;
	}

	async retrieve(id: string): Promise<CalendarCredentials | null> {
		// Try to read from environment variables
		const envPrefix = `CALDAV_${id.toUpperCase()}`;
		const serverUrl = process.env[`${envPrefix}_SERVER_URL`];
		const username = process.env[`${envPrefix}_USERNAME`];
		const password = process.env[`${envPrefix}_PASSWORD`];
		const serverTypeRaw = process.env[`${envPrefix}_SERVER_TYPE`];

		// Validate serverType before using it
		if (!serverTypeRaw || !isValidServerType(serverTypeRaw.trim())) {
			logger.warn('Invalid or missing server type in environment variables', { 
				id, 
				serverType: serverTypeRaw,
				validTypes: VALID_SERVER_TYPES 
			});
			return null;
		}

		const serverType = serverTypeRaw.trim() as CalendarCredentials['serverType'];

		if (serverUrl && username && password && serverType) {
			return {
				id,
				name: `Environment: ${id}`,
				serverUrl,
				username,
				password,
				serverType,
				metadata: {
					createdAt: new Date(),
					description: 'Loaded from environment variables',
				},
			};
		}

		return null;
	}

	async list(): Promise<string[]> {
		// Scan environment variables for credential sets
		const credentialIds: string[] = [];
		const envKeys = Object.keys(process.env);
		
		for (const key of envKeys) {
			if (key.startsWith('CALDAV_') && key.endsWith('_SERVER_URL')) {
				const id = key.replace('CALDAV_', '').replace('_SERVER_URL', '').toLowerCase();
				credentialIds.push(id);
			}
		}

		return credentialIds;
	}

	async delete(id: string): Promise<boolean> {
		logger.warn('Cannot delete credentials from environment backend - read-only', { id });
		return false;
	}
}

/**
 * macOS Keychain storage backend (macOS only)
 */
class KeychainStorageBackend implements CredentialStorageBackend {
	name = 'keychain';

	/**
	 * Validate and sanitize the credential ID to prevent command injection
	 * @param id - The credential ID to validate
	 * @returns The sanitized ID
	 * @throws Error if the ID contains invalid characters
	 */
	private validateId(id: string): string {
		// Only allow alphanumeric characters, hyphens, and underscores
		const validIdPattern = /^[a-zA-Z0-9_-]+$/;
		if (!validIdPattern.test(id)) {
			throw new Error(`Invalid credential ID: '${id}'. Only alphanumeric characters, hyphens, and underscores are allowed.`);
		}
		// Limit length to prevent potential issues
		if (id.length > 100) {
			throw new Error(`Credential ID too long: '${id}'. Maximum length is 100 characters.`);
		}
		return id;
	}

	async isAvailable(): Promise<boolean> {
		return process.platform === 'darwin';
	}

	async store(id: string, credentials: CalendarCredentials): Promise<void> {
		if (process.platform !== 'darwin') {
			throw new Error('Keychain storage is only available on macOS');
		}

		// Validate the ID to prevent command injection
		const validatedId = this.validateId(id);

		try {
			const credentialsJson = JSON.stringify(credentials);
			
			// Use execFile to avoid shell interpolation - pass password via stdin
			const child = spawn('security', [
				'add-generic-password',
				'-a', validatedId,
				'-s', 'calendar-mcp-server',
				'-w', '-', // Read password from stdin
				'-U'
			], {
				stdio: ['pipe', 'pipe', 'pipe']
			});

			// Write credentials to stdin
			child.stdin?.write(credentialsJson);
			child.stdin?.end();

			// Capture stdout and stderr
			let _stdout = '';
			let _stderr = '';
			
			child.stdout?.on('data', (data) => {
				_stdout += data.toString();
			});
			
			child.stderr?.on('data', (data) => {
				_stderr += data.toString();
			});

			// Wait for the process to complete
			const exitCode = await new Promise<number>((resolve, reject) => {
				child.on('close', (code) => {
					resolve(code || 0);
				});
				child.on('error', (error) => {
					reject(error);
				});
			});

			if (exitCode !== 0) {
				throw new Error(`security command failed with exit code ${exitCode}. stderr: ${_stderr}`);
			}

			logger.info('Stored credentials in keychain', { id: validatedId, serverType: credentials.serverType });
		} catch (error) {
			logger.error('Failed to store credentials in keychain', { id: validatedId, error: error instanceof Error ? error.message : 'Unknown error' });
			throw new Error(`Failed to store credentials in keychain: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	async retrieve(id: string): Promise<CalendarCredentials | null> {
		if (process.platform !== 'darwin') {
			return null;
		}

		// Validate the ID to prevent command injection
		const validatedId = this.validateId(id);

		try {
			// Use execFile to avoid shell interpolation
			const result = await new Promise<string>((resolve, reject) => {
				const child = spawn('security', [
					'find-generic-password',
					'-a', validatedId,
					'-s', 'calendar-mcp-server',
					'-w'
				], {
					stdio: ['pipe', 'pipe', 'pipe']
				});

				let stdout = '';
				let stderr = '';
				
				child.stdout?.on('data', (data) => {
					stdout += data.toString();
				});
				
				child.stderr?.on('data', (data) => {
					stderr += data.toString();
				});

				child.on('close', (code) => {
					if (code === 0) {
						resolve(stdout.trim());
					} else {
						reject(new Error(`security command failed with exit code ${code}. stderr: ${stderr}`));
					}
				});

				child.on('error', (error) => {
					reject(error);
				});
			});

			const credentialsJson = result;
			const credentials = JSON.parse(credentialsJson) as CalendarCredentials;
			
			// Update last used timestamp
			credentials.metadata = { 
				createdAt: credentials.metadata?.createdAt || new Date(),
				lastUsed: new Date(),
				description: credentials.metadata?.description
			};
			
			return credentials;
		} catch (error) {
			logger.debug('Credentials not found in keychain', { id: validatedId, error: error instanceof Error ? error.message : 'Unknown error' });
			return null;
		}
	}

	async list(): Promise<string[]> {
		if (process.platform !== 'darwin') {
			return [];
		}

		try {
			// Use execFile to avoid shell interpolation - use a pipeline approach
			const result = await new Promise<string>((resolve, reject) => {
				// First, dump the keychain
				const dumpChild = spawn('security', ['dump-keychain'], {
					stdio: ['pipe', 'pipe', 'pipe']
				});

				// Then grep for our service
				const grepChild = spawn('grep', ['-A', '1', '-B', '1', 'calendar-mcp-server'], {
					stdio: ['pipe', 'pipe', 'pipe']
				});

				// Connect the processes
				dumpChild.stdout?.pipe(grepChild.stdin!);
				dumpChild.stderr?.pipe(grepChild.stdin!);

				let stdout = '';
				let stderr = '';
				
				grepChild.stdout?.on('data', (data) => {
					stdout += data.toString();
				});
				
				grepChild.stderr?.on('data', (data) => {
					stderr += data.toString();
				});

				grepChild.on('close', (code) => {
					if (code === 0 || code === 1) { // grep returns 1 when no matches found
						resolve(stdout.trim());
					} else {
						reject(new Error(`grep command failed with exit code ${code}. stderr: ${stderr}`));
					}
				});

				grepChild.on('error', (error) => {
					reject(error);
				});

				dumpChild.on('error', (error) => {
					reject(error);
				});
			});

			// Parse the output to extract account names (this is a simplified implementation)
			const lines = result.split('\n');
			const accounts: string[] = [];
			
			for (const line of lines) {
				if (line.includes('acct')) {
					const match = line.match(/"([^"]+)"/);
					if (match) {
						accounts.push(match[1]);
					}
				}
			}

			return accounts;
		} catch (error) {
			logger.debug('No credentials found in keychain or error listing', { error: error instanceof Error ? error.message : 'Unknown error' });
			return [];
		}
	}

	async delete(id: string): Promise<boolean> {
		if (process.platform !== 'darwin') {
			return false;
		}

		// Validate the ID to prevent command injection
		const validatedId = this.validateId(id);

		try {
			// Use execFile to avoid shell interpolation
			const result = await new Promise<{ exitCode: number; stderr: string }>((resolve, reject) => {
				const child = spawn('security', [
					'delete-generic-password',
					'-a', validatedId,
					'-s', 'calendar-mcp-server'
				], {
					stdio: ['pipe', 'pipe', 'pipe']
				});

				let _stdout = '';
				let _stderr = '';
				
				child.stdout?.on('data', (data) => {
					_stdout += data.toString();
				});
				
				child.stderr?.on('data', (data) => {
					_stderr += data.toString();
				});

				child.on('close', (code) => {
					resolve({ exitCode: code || 0, stderr: _stderr });
				});

				child.on('error', (error) => {
					reject(error);
				});
			});

			if (result.exitCode !== 0) {
				throw new Error(`security command failed with exit code ${result.exitCode}. stderr: ${result.stderr}`);
			}

			logger.info('Deleted credentials from keychain', { id: validatedId });
			return true;
		} catch (error) {
			logger.debug('Failed to delete credentials from keychain', { id: validatedId, error: error instanceof Error ? error.message : 'Unknown error' });
			return false;
		}
	}
}

/**
 * Cross-platform credential manager
 */
export class CredentialManager {
	private backends: Map<string, CredentialStorageBackend> = new Map();
	private config: CredentialManagerConfig;
	private encryptionKey?: string;

	constructor(config: CredentialManagerConfig = {}) {
		this.config = {
			preferredBackend: 'auto',
			allowParameterCredentials: true,
			...config,
		};

		this.encryptionKey = config.encryptionKey;

		// Initialize storage backends
		this.initializeBackends();

		if (this.encryptionKey) {
			logger.info('Credential encryption enabled', { 
				algorithm: CredentialEncryption.ALGORITHM 
			});
		}
	}

	private initializeBackends(): void {
		// Always available backends
		this.backends.set('memory', new MemoryStorageBackend());
		this.backends.set('env', new EnvironmentStorageBackend());

		// Platform-specific backends
		if (process.platform === 'darwin') {
			this.backends.set('keychain', new KeychainStorageBackend());
		}

		logger.debug('Initialized credential storage backends', { 
			backends: Array.from(this.backends.keys()) 
		});
	}

	/**
	 * Encrypt credentials if encryption is enabled
	 * 
	 * Only encrypts the password field while preserving other metadata.
	 * Adds encryption metadata to track that the credentials are encrypted.
	 * 
	 * @param credentials - The credentials to potentially encrypt
	 * @returns Encrypted credentials if encryption is enabled, otherwise original credentials
	 */
	private async encryptCredentials(credentials: CalendarCredentials): Promise<CalendarCredentials> {
		if (!this.encryptionKey) {
			return credentials;
		}

		try {
			// Only encrypt the password field, not the entire credentials object
			const encryptedPassword = await CredentialEncryption.encrypt(credentials.password, this.encryptionKey);
			
			// Return a modified credentials object with encrypted password
			return {
				...credentials,
				password: encryptedPassword,
				metadata: {
					...credentials.metadata,
					encrypted: true,
					encryptionAlgorithm: CredentialEncryption.ALGORITHM,
				}
			};
		} catch (error) {
			logger.error('Failed to encrypt credentials', { id: credentials.id, error });
			throw new Error(`Failed to encrypt credentials: ${error}`);
		}
	}

	/**
	 * Decrypt credentials if they are encrypted
	 * 
	 * Only decrypts the password field if the credentials have encryption metadata.
	 * Removes encryption metadata after successful decryption.
	 * 
	 * @param credentials - The credentials to potentially decrypt
	 * @returns Decrypted credentials if they were encrypted, otherwise original credentials
	 * @throws Error if decryption fails (wrong key, corrupted data, etc.)
	 */
	private async decryptCredentials(credentials: CalendarCredentials): Promise<CalendarCredentials> {
		if (!this.encryptionKey || !credentials.metadata?.encrypted) {
			return credentials;
		}

		try {
			// Only decrypt the password field
			const decryptedPassword = await CredentialEncryption.decrypt(credentials.password, this.encryptionKey);
			
			// Return credentials with decrypted password and cleaned metadata
			return {
				...credentials,
				password: decryptedPassword,
				metadata: {
					...credentials.metadata,
					encrypted: undefined,
					encryptionAlgorithm: undefined,
				}
			};
		} catch (error) {
			logger.error('Failed to decrypt credentials', { id: credentials.id, error });
			throw new Error(`Failed to decrypt credentials: ${error}`);
		}
	}

	/**
	 * Get the best available storage backend
	 */
	private async getBestBackend(): Promise<CredentialStorageBackend> {
		if (this.config.preferredBackend && this.config.preferredBackend !== 'auto') {
			const backend = this.backends.get(this.config.preferredBackend);
			if (backend && await backend.isAvailable()) {
				return backend;
			}
		}

		// Auto-select best backend
		const backendPriority = ['keychain', 'env', 'memory'];
		
		for (const backendName of backendPriority) {
			const backend = this.backends.get(backendName);
			if (backend && await backend.isAvailable()) {
				logger.debug('Selected storage backend', { backend: backendName });
				return backend;
			}
		}

		// Fallback to memory
		return this.backends.get('memory')!;
	}

	/**
	 * Store credentials
	 */
	async storeCredentials(credentials: CalendarCredentials): Promise<void> {
		const backend = await this.getBestBackend();
		
		// Encrypt credentials if encryption is enabled
		const credentialsToStore = await this.encryptCredentials(credentials);
		
		await backend.store(credentials.id, credentialsToStore);
		logger.info('Stored calendar credentials', { 
			id: credentials.id, 
			backend: backend.name,
			serverType: credentials.serverType,
			encrypted: !!this.encryptionKey
		});
	}

	/**
	 * Retrieve credentials by ID
	 */
	async getCredentials(id: string): Promise<CalendarCredentials | null> {
		// Try all backends in priority order
		const backends = ['keychain', 'env', 'memory'];
		
		for (const backendName of backends) {
			const backend = this.backends.get(backendName);
			if (backend && await backend.isAvailable()) {
				const credentials = await backend.retrieve(id);
				if (credentials) {
					// Decrypt credentials if they are encrypted
					const decryptedCredentials = await this.decryptCredentials(credentials);
					logger.debug('Retrieved credentials', { 
						id, 
						backend: backendName,
						encrypted: !!credentials.metadata?.encrypted
					});
					return decryptedCredentials;
				}
			}
		}

		logger.debug('Credentials not found', { id });
		return null;
	}

	/**
	 * List all available credential IDs
	 */
	async listCredentials(): Promise<string[]> {
		const allIds = new Set<string>();
		
		for (const backend of this.backends.values()) {
			if (await backend.isAvailable()) {
				const ids = await backend.list();
				ids.forEach(id => allIds.add(id));
			}
		}

		return Array.from(allIds);
	}

	/**
	 * Delete credentials
	 */
	async deleteCredentials(id: string): Promise<boolean> {
		let deleted = false;
		
		for (const backend of this.backends.values()) {
			if (await backend.isAvailable()) {
				const result = await backend.delete(id);
				if (result) deleted = true;
			}
		}

		if (deleted) {
			logger.info('Deleted credentials', { id });
		}

		return deleted;
	}

	/**
	 * Validate credentials format
	 */
	validateCredentials(credentials: any): credentials is CalendarCredentials {
		return (
			typeof credentials === 'object' &&
			typeof credentials.id === 'string' &&
			typeof credentials.name === 'string' &&
			typeof credentials.serverUrl === 'string' &&
			typeof credentials.username === 'string' &&
			typeof credentials.password === 'string' &&
			isValidServerType(credentials.serverType)
		);
	}

	/**
	 * Create credentials from parameters (for credential-as-parameter approach)
	 */
	createTemporaryCredentials(params: {
		serverUrl: string;
		username: string;
		password: string;
		serverType: CalendarCredentials['serverType'];
		name?: string;
	}): CalendarCredentials {
		return {
			id: `temp_${Date.now()}`,
			name: params.name || `Temporary ${params.serverType} credentials`,
			serverUrl: params.serverUrl,
			username: params.username,
			password: params.password,
			serverType: params.serverType,
			metadata: {
				createdAt: new Date(),
				description: 'Temporary credentials passed as parameters',
			},
		};
	}

	/**
	 * Get suggested server URLs for common providers
	 */
	static getServerUrls() {
		return {
			icloud: 'https://caldav.icloud.com',
			google: 'https://apidata.googleusercontent.com/caldav/v2',
			outlook: 'https://outlook.office365.com',
			yahoo: 'https://caldav.calendar.yahoo.com',
		};
	}

	/**
	 * Get setup instructions for different providers
	 */
	static getSetupInstructions(serverType: CalendarCredentials['serverType']) {
		switch (serverType) {
			case 'icloud':
				return {
					title: 'iCloud Calendar Setup',
					steps: [
						'1. Go to appleid.apple.com and sign in',
						'2. Navigate to Security > App-Specific Passwords',
						'3. Generate a new app-specific password for "Calendar MCP Server"',
						'4. Use your Apple ID email as username',
						'5. Use the generated app-specific password (not your regular password)',
					],
					serverUrl: 'https://caldav.icloud.com',
					notes: 'App-specific passwords are required for iCloud CalDAV access.',
				};

			case 'google':
				return {
					title: 'Google Calendar Setup',
					steps: [
						'1. Enable Calendar API in Google Cloud Console',
						'2. Create OAuth 2.0 credentials',
						'3. Complete OAuth flow to get access token',
						'4. Use OAuth token as password',
					],
					serverUrl: 'https://apidata.googleusercontent.com/caldav/v2',
					notes: 'Google Calendar requires OAuth 2.0 authentication.',
				};

			case 'exchange':
				return {
					title: 'Exchange Calendar Setup',
					steps: [
						'1. Get your Exchange server URL from IT admin',
						'2. Use your domain username (e.g., domain\\username)',
						'3. Use your regular Exchange password',
					],
					serverUrl: 'https://your-exchange-server.com/ews/exchange.asmx',
					notes: 'Contact your IT administrator for Exchange server details.',
				};

			default:
				return {
					title: 'Generic CalDAV Setup',
					steps: [
						'1. Get CalDAV server URL from your provider',
						'2. Use your account username',
						'3. Use your account password or app-specific password',
					],
					serverUrl: 'https://your-caldav-server.com',
					notes: 'Consult your calendar provider\'s documentation for specific setup instructions.',
				};
		}
	}
}

// Export default credential manager instance
export const defaultCredentialManager = new CredentialManager({
	preferredBackend: 'auto',
	allowParameterCredentials: true,
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CredentialManager, CalendarCredentials } from '../src/credentials/CredentialManager.js';

describe('CredentialManager Encryption', () => {
	let credentialManager: CredentialManager;
	const testCredentials: CalendarCredentials = {
		id: 'test-credentials',
		name: 'Test Credentials',
		serverUrl: 'https://test.example.com',
		username: 'testuser',
		password: 'testpassword',
		serverType: 'generic',
		metadata: {
			createdAt: new Date(),
			description: 'Test credentials for encryption testing',
		},
	};

	describe('Without Encryption', () => {
		beforeEach(() => {
			credentialManager = new CredentialManager({
				preferredBackend: 'memory',
				allowParameterCredentials: true,
			});
		});

		it('should store and retrieve credentials without encryption', async () => {
			await credentialManager.storeCredentials(testCredentials);
			const retrieved = await credentialManager.getCredentials('test-credentials');
			
			expect(retrieved).toBeTruthy();
			expect(retrieved?.id).toBe(testCredentials.id);
			expect(retrieved?.username).toBe(testCredentials.username);
			expect(retrieved?.password).toBe(testCredentials.password);
			expect(retrieved?.metadata?.encrypted).toBeUndefined();
		});
	});

	describe('With Encryption', () => {
		const encryptionKey = 'test-encryption-key-12345';

		beforeEach(() => {
			credentialManager = new CredentialManager({
				preferredBackend: 'memory',
				allowParameterCredentials: true,
				encryptionKey,
			});
		});

		it('should store and retrieve credentials with encryption', async () => {
			await credentialManager.storeCredentials(testCredentials);
			const retrieved = await credentialManager.getCredentials('test-credentials');
			
			expect(retrieved).toBeTruthy();
			expect(retrieved?.id).toBe(testCredentials.id);
			expect(retrieved?.username).toBe(testCredentials.username);
			expect(retrieved?.password).toBe(testCredentials.password);
			expect(retrieved?.metadata?.encrypted).toBeUndefined(); // Should be cleaned up after decryption
		});

		it('should encrypt sensitive data when storing', async () => {
			await credentialManager.storeCredentials(testCredentials);
			
			// Access the memory backend directly to check encrypted storage
			const memoryBackend = (credentialManager as any).backends.get('memory');
			const storedCredentials = memoryBackend.credentials.get('test-credentials');
			
			expect(storedCredentials).toBeTruthy();
			expect(storedCredentials.metadata?.encrypted).toBe(true);
			expect(storedCredentials.metadata?.encryptionAlgorithm).toBe('aes-256-gcm');
			expect(storedCredentials.password).not.toBe(testCredentials.password); // Should be encrypted
		});

		it('should handle different credential types with encryption', async () => {
			const credentials: CalendarCredentials[] = [
				{
					...testCredentials,
					id: 'icloud-test',
					serverType: 'icloud',
					password: 'app-specific-password-123',
				},
				{
					...testCredentials,
					id: 'google-test',
					serverType: 'google',
					password: 'oauth-token-456',
				},
				{
					...testCredentials,
					id: 'exchange-test',
					serverType: 'exchange',
					password: 'domain-password-789',
				},
			];

			for (const creds of credentials) {
				await credentialManager.storeCredentials(creds);
				const retrieved = await credentialManager.getCredentials(creds.id);
				
				expect(retrieved).toBeTruthy();
				expect(retrieved?.password).toBe(creds.password);
				expect(retrieved?.serverType).toBe(creds.serverType);
			}
		});

		it('should handle empty and special characters in passwords', async () => {
			const specialCredentials: CalendarCredentials[] = [
				{
					...testCredentials,
					id: 'empty-password',
					password: '',
				},
				{
					...testCredentials,
					id: 'special-chars',
					password: '!@#$%^&*()_+-=[]{}|;:,.<>?',
				},
				{
					...testCredentials,
					id: 'unicode-password',
					password: '🔐密码123',
				},
			];

			for (const creds of specialCredentials) {
				await credentialManager.storeCredentials(creds);
				const retrieved = await credentialManager.getCredentials(creds.id);
				
				expect(retrieved).toBeTruthy();
				expect(retrieved?.password).toBe(creds.password);
			}
		});

		it('should fail to decrypt with wrong encryption key', async () => {
			await credentialManager.storeCredentials(testCredentials);
			
			// Create a new manager with different encryption key
			const wrongKeyManager = new CredentialManager({
				preferredBackend: 'memory',
				allowParameterCredentials: true,
				encryptionKey: 'wrong-key',
			});
			
			// Copy the encrypted data to the wrong key manager's memory backend
			const originalMemoryBackend = (credentialManager as any).backends.get('memory');
			const wrongKeyMemoryBackend = (wrongKeyManager as any).backends.get('memory');
			const encryptedCredentials = originalMemoryBackend.credentials.get('test-credentials');
			wrongKeyMemoryBackend.credentials.set('test-credentials', encryptedCredentials);
			
			// Should throw error when trying to decrypt with wrong key
			await expect(wrongKeyManager.getCredentials('test-credentials')).rejects.toThrow();
		});

		it('should handle missing encryption key gracefully', async () => {
			// Store with encryption
			await credentialManager.storeCredentials(testCredentials);
			
			// Create a new manager without encryption key
			const noEncryptionManager = new CredentialManager({
				preferredBackend: 'memory',
				allowParameterCredentials: true,
			});
			
			// Copy the encrypted data to the no encryption manager's memory backend
			const originalMemoryBackend = (credentialManager as any).backends.get('memory');
			const noEncryptionMemoryBackend = (noEncryptionManager as any).backends.get('memory');
			const encryptedCredentials = originalMemoryBackend.credentials.get('test-credentials');
			noEncryptionMemoryBackend.credentials.set('test-credentials', encryptedCredentials);
			
			// Should return the encrypted data as-is (not decrypted)
			const retrieved = await noEncryptionManager.getCredentials('test-credentials');
			expect(retrieved).toBeTruthy();
			expect(retrieved?.password).not.toBe(testCredentials.password); // Should still be encrypted
		});
	});

	describe('Encryption Edge Cases', () => {
		const encryptionKey = 'test-encryption-key-12345';

		beforeEach(() => {
			credentialManager = new CredentialManager({
				preferredBackend: 'memory',
				allowParameterCredentials: true,
				encryptionKey,
			});
		});

		it('should handle very long passwords', async () => {
			const longPassword = 'a'.repeat(10000); // 10KB password
			const longPasswordCredentials: CalendarCredentials = {
				...testCredentials,
				id: 'long-password',
				password: longPassword,
			};

			await credentialManager.storeCredentials(longPasswordCredentials);
			const retrieved = await credentialManager.getCredentials('long-password');
			
			expect(retrieved).toBeTruthy();
			expect(retrieved?.password).toBe(longPassword);
		});

		it('should handle JSON with special characters in metadata', async () => {
			const specialMetadataCredentials: CalendarCredentials = {
				...testCredentials,
				id: 'special-metadata',
				metadata: {
					createdAt: new Date(),
					description: 'Test with special chars: "quotes", \'apostrophes\', \\backslashes\\, and newlines\n',
				},
			};

			await credentialManager.storeCredentials(specialMetadataCredentials);
			const retrieved = await credentialManager.getCredentials('special-metadata');
			
			expect(retrieved).toBeTruthy();
			expect(retrieved?.metadata?.description).toBe(specialMetadataCredentials.metadata?.description);
		});

		it('should handle concurrent encryption operations', async () => {
			const promises = [];
			const credentialCount = 10;

			// Store multiple credentials concurrently
			for (let i = 0; i < credentialCount; i++) {
				const creds: CalendarCredentials = {
					...testCredentials,
					id: `concurrent-${i}`,
					password: `password-${i}`,
				};
				promises.push(credentialManager.storeCredentials(creds));
			}

			await Promise.all(promises);

			// Retrieve all credentials
			const retrievePromises = [];
			for (let i = 0; i < credentialCount; i++) {
				retrievePromises.push(credentialManager.getCredentials(`concurrent-${i}`));
			}

			const retrievedCredentials = await Promise.all(retrievePromises);

			// Verify all credentials were stored and retrieved correctly
			expect(retrievedCredentials).toHaveLength(credentialCount);
			retrievedCredentials.forEach((creds, index) => {
				expect(creds).toBeTruthy();
				expect(creds?.id).toBe(`concurrent-${index}`);
				expect(creds?.password).toBe(`password-${index}`);
			});
		});
	});

	describe('Encryption Performance', () => {
		const encryptionKey = 'test-encryption-key-12345';

		beforeEach(() => {
			credentialManager = new CredentialManager({
				preferredBackend: 'memory',
				allowParameterCredentials: true,
				encryptionKey,
			});
		});

		it('should encrypt and decrypt within reasonable time', async () => {
			const startTime = Date.now();
			
			await credentialManager.storeCredentials(testCredentials);
			const retrieved = await credentialManager.getCredentials('test-credentials');
			
			const endTime = Date.now();
			const duration = endTime - startTime;
			
			expect(retrieved).toBeTruthy();
			expect(duration).toBeLessThan(1000); // Should complete within 1 second
		});
	});

	afterEach(async () => {
		// Clean up any stored credentials
		if (credentialManager) {
			await credentialManager.deleteCredentials('test-credentials');
			await credentialManager.deleteCredentials('icloud-test');
			await credentialManager.deleteCredentials('google-test');
			await credentialManager.deleteCredentials('exchange-test');
			await credentialManager.deleteCredentials('empty-password');
			await credentialManager.deleteCredentials('special-chars');
			await credentialManager.deleteCredentials('unicode-password');
			await credentialManager.deleteCredentials('long-password');
			await credentialManager.deleteCredentials('special-metadata');
			
			// Clean up concurrent test credentials
			for (let i = 0; i < 10; i++) {
				await credentialManager.deleteCredentials(`concurrent-${i}`);
			}
		}
	});
});

import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should have basic test environment working', () => {
    expect(1 + 1).toBe(2);
  });

  it('should support TypeScript', () => {
    const message: string = 'Hello, TypeScript!';
    expect(typeof message).toBe('string');
    expect(message).toBe('Hello, TypeScript!');
  });

	it('should be able to import MCP SDK', async () => {
		// Test that we can import the MCP SDK without errors
		const { Server } = await import('@modelcontextprotocol/sdk/dist/esm/server/index.js');
		expect(Server).toBeDefined();
		expect(typeof Server).toBe('function');
	});
});

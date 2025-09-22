import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel, logger } from '../src/utils/logger';

describe('Logger', () => {
	let consoleSpy: any;
	let stderrSpy: any;
	let originalEnv: string | undefined;

	beforeEach(() => {
		// Mock environment variables to ensure we're not in MCP mode
		originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'test';
		
		// Mock stdout.isTTY to false to trigger MCP mode detection
		Object.defineProperty(process.stdout, 'isTTY', {
			value: false,
			writable: true,
		});

		consoleSpy = {
			log: vi.spyOn(console, 'log').mockImplementation(() => {}),
			error: vi.spyOn(console, 'error').mockImplementation(() => {}),
		};

		// Mock stderr.write since logger uses it in MCP mode
		stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		process.env.NODE_ENV = originalEnv;
	});

	describe('Logger class', () => {
		it('should create logger with default configuration', () => {
			const testLogger = new Logger();
			expect(testLogger.getLevel()).toBe(LogLevel.INFO);
		});

		it('should create logger with custom configuration', () => {
			const testLogger = new Logger({ level: LogLevel.DEBUG });
			expect(testLogger.getLevel()).toBe(LogLevel.DEBUG);
		});

		it('should log info messages at INFO level', () => {
			const testLogger = new Logger({ level: LogLevel.INFO });
			testLogger.info('Test message');
			expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test message'));
		});

		it('should log error messages at INFO level', () => {
			const testLogger = new Logger({ level: LogLevel.INFO });
			testLogger.error('Test error');
			expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test error'));
		});

		it('should not log debug messages at INFO level', () => {
			const testLogger = new Logger({ level: LogLevel.INFO });
			testLogger.debug('Debug message');
			expect(stderrSpy).not.toHaveBeenCalled();
		});

		it('should log debug messages at DEBUG level', () => {
			const testLogger = new Logger({ level: LogLevel.DEBUG });
			testLogger.debug('Debug message');
			expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Debug message'));
		});

		it('should format messages with data objects', () => {
			const testLogger = new Logger({ level: LogLevel.INFO });
			const testData = { key: 'value', number: 42 };
			testLogger.info('Test with data', testData);
			expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(testData, null, 2)));
		});

		it('should allow changing log level', () => {
			const testLogger = new Logger({ level: LogLevel.INFO });
			expect(testLogger.getLevel()).toBe(LogLevel.INFO);

			testLogger.setLevel(LogLevel.ERROR);
			expect(testLogger.getLevel()).toBe(LogLevel.ERROR);
		});

		it('should respect log level filtering', () => {
			const testLogger = new Logger({ level: LogLevel.ERROR });

			testLogger.debug('Debug');
			testLogger.info('Info');
			testLogger.warn('Warn');
			testLogger.error('Error');

			expect(stderrSpy).toHaveBeenCalledTimes(1);
			expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Error'));
		});
	});

	describe('Default logger instance', () => {
		it('should be available as a singleton', () => {
			expect(logger).toBeDefined();
			expect(typeof logger.info).toBe('function');
			expect(typeof logger.error).toBe('function');
			expect(typeof logger.warn).toBe('function');
			expect(typeof logger.debug).toBe('function');
		});

		it('should work with the default configuration', () => {
			logger.info('Test default logger');
			expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test default logger'));
		});
	});
});

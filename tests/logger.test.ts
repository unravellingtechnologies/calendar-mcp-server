import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel, logger } from '../src/utils/logger';

describe('Logger', () => {
	let consoleSpy: any;

	beforeEach(() => {
		consoleSpy = {
			log: vi.spyOn(console, 'log').mockImplementation(() => {}),
			error: vi.spyOn(console, 'error').mockImplementation(() => {}),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
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
			expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test message'));
		});

		it('should log error messages at INFO level', () => {
			const testLogger = new Logger({ level: LogLevel.INFO });
			testLogger.error('Test error');
			expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test error'));
		});

		it('should not log debug messages at INFO level', () => {
			const testLogger = new Logger({ level: LogLevel.INFO });
			testLogger.debug('Debug message');
			expect(consoleSpy.log).not.toHaveBeenCalled();
		});

		it('should log debug messages at DEBUG level', () => {
			const testLogger = new Logger({ level: LogLevel.DEBUG });
			testLogger.debug('Debug message');
			expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Debug message'));
		});

		it('should format messages with data objects', () => {
			const testLogger = new Logger({ level: LogLevel.INFO });
			const testData = { key: 'value', number: 42 };
			testLogger.info('Test with data', testData);
			expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(testData, null, 2)));
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

			expect(consoleSpy.log).not.toHaveBeenCalled();
			expect(consoleSpy.error).toHaveBeenCalledOnce();
			expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Error'));
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
			expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test default logger'));
		});
	});
});

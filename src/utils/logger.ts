/**
 * Simple logger utility for the Calendar MCP Server
 * Provides different log levels and formatting
 */

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

export interface LoggerConfig {
	level: LogLevel;
	enableColors: boolean;
	enableTimestamp: boolean;
}

class Logger {
	private config: LoggerConfig;

	constructor(config: Partial<LoggerConfig> = {}) {
		this.config = {
			level: LogLevel.INFO,
			enableColors: true,
			enableTimestamp: true,
			...config,
		};
	}

	private formatMessage(level: string, message: string, data?: any): string {
		const timestamp = this.config.enableTimestamp ? `[${new Date().toISOString()}]` : '';
		const levelStr = `[${level}]`;
		const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';

		return `${timestamp} ${levelStr} ${message}${dataStr}`;
	}

	private getColorCode(level: LogLevel): string {
		if (!this.config.enableColors) return '';

		switch (level) {
			case LogLevel.DEBUG:
				return '\x1b[36m'; // Cyan
			case LogLevel.INFO:
				return '\x1b[32m'; // Green
			case LogLevel.WARN:
				return '\x1b[33m'; // Yellow
			case LogLevel.ERROR:
				return '\x1b[31m'; // Red
			default:
				return '';
		}
	}

	private resetColor(): string {
		return this.config.enableColors ? '\x1b[0m' : '';
	}

	private log(level: LogLevel, levelName: string, message: string, data?: any): void {
		if (level < this.config.level) return;

		const colorCode = this.getColorCode(level);
		const resetCode = this.resetColor();
		const formattedMessage = this.formatMessage(levelName, message, data);

		const output = `${colorCode}${formattedMessage}${resetCode}`;

		if (level >= LogLevel.ERROR) {
			console.error(output);
		} else {
			console.log(output);
		}
	}

	debug(message: string, data?: any): void {
		this.log(LogLevel.DEBUG, 'DEBUG', message, data);
	}

	info(message: string, data?: any): void {
		this.log(LogLevel.INFO, 'INFO', message, data);
	}

	warn(message: string, data?: any): void {
		this.log(LogLevel.WARN, 'WARN', message, data);
	}

	error(message: string, data?: any): void {
		this.log(LogLevel.ERROR, 'ERROR', message, data);
	}

	setLevel(level: LogLevel): void {
		this.config.level = level;
	}

	getLevel(): LogLevel {
		return this.config.level;
	}
}

// Create and export a default logger instance
export const logger = new Logger({
	level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
	enableColors: process.env.NODE_ENV !== 'test',
	enableTimestamp: true,
});

// Export the Logger class for custom instances
export { Logger };

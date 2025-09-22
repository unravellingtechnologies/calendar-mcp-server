import { createRequire } from 'module';
import { LogLevel } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

export interface AppConfig {
	name: string;
	version: string;
	description: string;
	logLevel: LogLevel;
}

const getLogLevel = (): LogLevel => {
	const logLevel = process.env.LOG_LEVEL?.toUpperCase();
	switch (logLevel) {
		case 'DEBUG':
			return LogLevel.DEBUG;
		case 'INFO':
			return LogLevel.INFO;
		case 'WARN':
			return LogLevel.WARN;
		case 'ERROR':
			return LogLevel.ERROR;
		default:
			return process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
	}
};

export const config: AppConfig = {
	name: packageJson.name,
	version: packageJson.version,
	description: packageJson.description ?? '',
	logLevel: getLogLevel(),
};

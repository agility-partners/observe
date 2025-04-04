import winston from 'winston';
import { Logtail } from '@logtail/node';
import { LogtailTransport } from '@logtail/winston';

/**
 * @name observe
 * @description A TypeScript logging utility using Winston and BetterStack
 */

/**
 * Custom format to remove log level prefix from message for BetterStack
 * This prevents the double log level issue in BetterStack UI
 */
const removeLogLevelPrefix = winston.format((info) => {
  // Clone the info object to avoid modifying the original
  const updatedInfo = { ...info };
  
  // Remove log level prefix from message if it exists
  // Example: "INFO User logged in" becomes "User logged in"
  const logLevels = ['ERROR', 'WARN', 'INFO', 'HTTP', 'VERBOSE', 'DEBUG', 'SILLY'];
  
  for (const level of logLevels) {
    const prefix = `${level} `;
    if (typeof updatedInfo.message === 'string' && updatedInfo.message.startsWith(prefix)) {
      updatedInfo.message = updatedInfo.message.substring(prefix.length);
      break;
    }
  }
  
  return updatedInfo;
});

/**
 * Log levels following the RFC5424 format with custom colors
 */
const logLevels = {
  error: 0, 
  warn: 1, 
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

/**
 * Custom colors for console output
 */
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray'
};

// Add colors to Winston
winston.addColors(logColors);

/**
 * Configuration interface for the logger
 */
export interface LoggerConfig {
  betterStackToken?: string;
  betterStackEndpoint?: string;
  consoleLevel?: string;
  fileLevel?: string;
  filePath?: string;
  serviceContext?: {
    service?: string;
    environment?: string;
    version?: string;
  };
}

/**
 * Default configuration
 */
const defaultConfig: LoggerConfig = {
  consoleLevel: 'info',
  fileLevel: 'debug',
  filePath: 'logs/app.log',
  serviceContext: {
    service: 'application',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  }
};

/**
 * Create a custom logger format with timestamp, colors and structured data
 */
const createLogFormat = (config: LoggerConfig) => {
  // Format for console output (colorized and readable)
  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const serviceInfo = config.serviceContext ? 
        `[${config.serviceContext.service}:${config.serviceContext.environment}] ` : '';
      
      // Format metadata as JSON if present
      const metaStr = Object.keys(meta).length ? 
        `\n${JSON.stringify(meta, null, 2)}` : '';
        
      return `${timestamp} ${serviceInfo}${level}: ${message}${metaStr}`;
    })
  );
  
  // Format for file (JSON with level prefix)
  const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  );
  
  // Format for BetterStack (JSON without level prefix in message)
  const betterStackFormat = winston.format.combine(
    winston.format.timestamp(),
    removeLogLevelPrefix(),
    winston.format.json()
  );
  
  return { consoleFormat, fileFormat, betterStackFormat };
};

/**
 * Create the logger instance with specified configuration
 */
export function createLogger(customConfig: Partial<LoggerConfig> = {}) {
  // Merge default config with custom config
  const config = { ...defaultConfig, ...customConfig };
  const { consoleFormat, fileFormat, betterStackFormat } = createLogFormat(config);
  
  // Create transport array
  const transports: winston.transport[] = [
    // Console transport
    new winston.transports.Console({
      level: config.consoleLevel,
      format: consoleFormat
    })
  ];
  
  // Add file transport if enabled
  if (config.filePath) {
    transports.push(
      new winston.transports.File({
        filename: config.filePath,
        level: config.fileLevel,
        format: fileFormat
      })
    );
  }
  
  // Add BetterStack transport if token is provided
  let logtail: Logtail | null = null;
  if (config.betterStackToken) {
    // Ensure the endpoint URL has the proper https:// prefix
    let endpoint = config.betterStackEndpoint || 'your-ingesting-url.betterstackdata.com';
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }
    
    logtail = new Logtail(config.betterStackToken, {
      endpoint: endpoint
    });
    
    // Create a custom transport with our specific formatter
    const betterStackTransport = new LogtailTransport(logtail);
    
    transports.push(betterStackTransport);
  }
  
  // Create the Winston logger
  const logger = winston.createLogger({
    levels: logLevels,
    defaultMeta: {
      ...config.serviceContext
    },
    format: winston.format.combine(
      removeLogLevelPrefix()
    ),
    transports
  });
  
  // Add flush method to ensure all logs are sent before exiting
  const enhancedLogger = logger as winston.Logger & { flush: () => Promise<void> };
  enhancedLogger.flush = async () => {
    if (logtail) {
      await logtail.flush();
    }
    // Return a promise that resolves when all logs are flushed
    return new Promise<void>((resolve) => {
      logger.on('finish', resolve);
      logger.end();
    });
  };
  
  return enhancedLogger;
}

// Export a default instance with environment variables for quick usage
export const logger = createLogger({
  betterStackToken: process.env.BETTER_STACK_SOURCE_TOKEN,
  betterStackEndpoint: process.env.BETTER_STACK_INGESTING_URL,
  serviceContext: {
    service: process.env.SERVICE_NAME || 'application',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.SERVICE_VERSION || '1.0.0'
  }
});

// Export Winston formats and transport classes for advanced usage
export { format, transports } from 'winston';
/**
 * @name observe
 * @description A hybrid logging utility that logs to both console and BetterStack
 */
import { Logtail } from '@logtail/node';

// Log levels in order of priority
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  HTTP = 3,
  DEBUG = 4,
  VERBOSE = 5,
  SILLY = 6
}

// Configuration interface
export interface LoggerConfig {
  level?: LogLevel;
  serviceContext?: {
    service?: string;
    environment?: string;
    version?: string;
  };
  betterStackToken?: string;
  betterStackEndpoint?: string;
}

// Default configuration
const defaultConfig: LoggerConfig = {
  level: LogLevel.INFO,
  serviceContext: {
    service: process.env.SERVICE_NAME || 'application',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.SERVICE_VERSION || '1.0.0'
  }
};

// Log level names
const logLevelNames: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.HTTP]: 'HTTP',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.VERBOSE]: 'VERBOSE',
  [LogLevel.SILLY]: 'SILLY'
};

// Map LogLevel to BetterStack log level
const betterStackLevels: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'error',
  [LogLevel.WARN]: 'warn',
  [LogLevel.INFO]: 'info',
  [LogLevel.HTTP]: 'info',
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.VERBOSE]: 'debug',
  [LogLevel.SILLY]: 'debug'
};

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Color mapping for log levels
const logLevelColors: Record<LogLevel, string> = {
  [LogLevel.ERROR]: colors.red,
  [LogLevel.WARN]: colors.yellow,
  [LogLevel.INFO]: colors.green,
  [LogLevel.HTTP]: colors.magenta,
  [LogLevel.DEBUG]: colors.blue,
  [LogLevel.VERBOSE]: colors.cyan,
  [LogLevel.SILLY]: colors.gray
};

/**
 * Class for hybrid logging to console and BetterStack
 */
export class Logger {
  private config: LoggerConfig;
  private logtail: Logtail | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    
    // Initialize BetterStack logger if token is provided
    if (this.config.betterStackToken) {
      try {
        // Ensure the endpoint URL has the proper https:// prefix
        let endpoint = this.config.betterStackEndpoint || 'your-ingesting-url.betterstackdata.com';
        if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
          endpoint = `https://${endpoint}`;
        }
        
        this.logtail = new Logtail(this.config.betterStackToken, {
          endpoint: endpoint
        });
      } catch (error) {
        console.error('Failed to initialize BetterStack logger:', error);
        this.logtail = null;
      }
    }
  }

  /**
   * Format a log message with timestamp, service context, and metadata
   */
  private formatLogMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const levelName = logLevelNames[level];
    const levelColor = logLevelColors[level];
    
    // Add service context if available
    const context = this.config.serviceContext;
    const serviceInfo = context ? 
      `[${context.service}:${context.environment}]` : '';
    
    // Format metadata as JSON if present
    const metaStr = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
    
    // Create colored log for console
    return `${timestamp} ${serviceInfo} ${levelColor}${levelName}${colors.reset}: ${message}${metaStr}`;
  }

  /**
   * Log a message to both console and BetterStack
   */
  private log(level: LogLevel, message: string, meta?: any): void {
    // Only log if the level is within the configured threshold
    if (level <= (this.config.level || LogLevel.INFO)) {
      // Log to console
      const formattedMessage = this.formatLogMessage(level, message, meta);
      
      // Use appropriate console method based on level
      if (level === LogLevel.ERROR) {
        console.error(formattedMessage);
      } else if (level === LogLevel.WARN) {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }
      
      // Log to BetterStack if available
      if (this.logtail) {
        try {
          // BetterStack requires a specific format to work properly
          // Always call the direct level method with just the message string as first param
          const betterStackLevel = betterStackLevels[level];
          
          if (typeof this.logtail[betterStackLevel as keyof Logtail] === 'function') {
            // Call the appropriate level method directly (info, warn, error, etc.)
            // Pass metadata as the second parameter
            (this.logtail[betterStackLevel as keyof Logtail] as (message: string, meta?: Record<string, any>) => Promise<void>)(
              message, 
              { 
                ...(meta || {}),
                service: this.config.serviceContext?.service,
                environment: this.config.serviceContext?.environment,
                version: this.config.serviceContext?.version
              }
            ).catch((error: Error) => {
              console.error('Failed to send log to BetterStack:', error);
            });
          }
        } catch (error) {
          console.error('Error logging to BetterStack:', error);
        }
      }
    }
  }

  /**
   * Log an error message
   */
  error(message: string, meta?: any): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  /**
   * Log a warning message
   */
  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, message, meta);
  }

  /**
   * Log an info message
   */
  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, message, meta);
  }

  /**
   * Log an HTTP message
   */
  http(message: string, meta?: any): void {
    this.log(LogLevel.HTTP, message, meta);
  }

  /**
   * Log a debug message
   */
  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta);
  }

  /**
   * Log a verbose message
   */
  verbose(message: string, meta?: any): void {
    this.log(LogLevel.VERBOSE, message, meta);
  }

  /**
   * Log a silly message
   */
  silly(message: string, meta?: any): void {
    this.log(LogLevel.SILLY, message, meta);
  }

  /**
   * Create a new logger with additional context
   */
  with(additionalContext: Record<string, any>): Logger {
    const newConfig = { ...this.config };
    
    // Merge service context
    if (additionalContext.service || additionalContext.environment || additionalContext.version) {
      newConfig.serviceContext = {
        ...this.config.serviceContext,
        ...(additionalContext.service && { service: additionalContext.service }),
        ...(additionalContext.environment && { environment: additionalContext.environment }),
        ...(additionalContext.version && { version: additionalContext.version })
      };
      
      // Remove from additionalContext to avoid duplication
      const { service, environment, version, ...rest } = additionalContext;
      additionalContext = rest;
    }
    
    const logger = new Logger(newConfig);
    
    // Override log methods to include additional context
    const originalLog = logger['log'].bind(logger);
    logger['log'] = (level: LogLevel, message: string, meta?: any) => {
      const combinedMeta = meta ? { ...additionalContext, ...meta } : additionalContext;
      originalLog(level, message, combinedMeta);
    };
    
    return logger;
  }

  /**
   * Flush BetterStack logs before exiting
   */
  async flush(): Promise<void> {
    if (this.logtail) {
      try {
        await this.logtail.flush();
      } catch (error) {
        console.error('Error flushing logs to BetterStack:', error);
      }
    }
    return Promise.resolve();
  }
}

// Create and export a default logger instance
export const logger = new Logger({
  level: parseLogLevel(process.env.LOG_LEVEL),
  betterStackToken: process.env.BETTER_STACK_SOURCE_TOKEN,
  betterStackEndpoint: process.env.BETTER_STACK_INGESTING_URL
});

// Create and export the createLogger function for custom loggers
export function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  return new Logger(config);
}

/**
 * Helper function to parse log level from string
 */
function parseLogLevel(level?: string): LogLevel | undefined {
  if (!level) return undefined;
  
  const upperLevel = level.toUpperCase();
  const levels: Record<string, LogLevel> = {
    'ERROR': LogLevel.ERROR,
    'WARN': LogLevel.WARN,
    'INFO': LogLevel.INFO,
    'HTTP': LogLevel.HTTP,
    'DEBUG': LogLevel.DEBUG,
    'VERBOSE': LogLevel.VERBOSE,
    'SILLY': LogLevel.SILLY
  };
  
  return levels[upperLevel];
}
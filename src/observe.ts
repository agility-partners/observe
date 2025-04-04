/**
 * @name observe
 * @description A simple logger that emulates console.log while sending to BetterStack
 */
import { Logtail } from '@logtail/node';

// Define log levels and types for better type safety
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogMetadata = Record<string, any>;

export interface LoggerOptions {
    betterStackToken?: string;
    betterStackEndpoint?: string;
    service?: string;
    environment?: string;
    version?: string;
    minLevel?: LogLevel;
}

// Simple logger class
export class Logger {
    private logtail: Logtail | null = null;
    private service: string;
    private environment: string;
    private version: string;
    private betterStackToken?: string;
    private betterStackEndpoint?: string;
    private isInitialized: boolean = false;
    private minLevel: LogLevel;
    private initRetryTimeout?: NodeJS.Timeout;

    // Log level numeric values for filtering
    private readonly LOG_LEVEL_VALUES: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };

    constructor(options: LoggerOptions = {}) {
        // Try to get token from options or environment
        this.betterStackToken = options.betterStackToken || process.env.BETTER_STACK_SOURCE_TOKEN;
        this.betterStackEndpoint = options.betterStackEndpoint || process.env.BETTER_STACK_INGESTING_URL;
        this.service = options.service || process.env.SERVICE_NAME || 'application';
        this.environment = options.environment || process.env.NODE_ENV || 'development';
        this.version = options.version || process.env.SERVICE_VERSION || '1.0.0';
        this.minLevel = options.minLevel || (process.env.LOG_LEVEL as LogLevel) || 'info';

        // Initialize BetterStack logger
        this.initLogtail();
    }

    // Separate initialization to allow for delayed or retry initialization
    private initLogtail(): void {
        if (this.isInitialized) return;

        // Clear any existing retry timeouts
        if (this.initRetryTimeout) {
            clearTimeout(this.initRetryTimeout);
            this.initRetryTimeout = undefined;
        }

        if (this.betterStackToken) {
            try {
                // Ensure the endpoint URL has the proper https:// prefix
                let endpoint = this.betterStackEndpoint || 'logs.betterstack.com';
                if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
                    endpoint = `https://${endpoint}`;
                }

                console.debug(`[Logger] Initializing BetterStack logger with endpoint: ${endpoint}`);
                this.logtail = new Logtail(this.betterStackToken, {
                    endpoint,
                });
                this.isInitialized = true;
                console.debug(`[Logger] BetterStack logger initialized successfully`);
            } catch (error) {
                console.error(`[Logger] Failed to initialize BetterStack logger:`, error);
                // Schedule retry after a delay
                this.scheduleRetry();
            }
        } else {
            console.debug(`[Logger] No BetterStack token provided, logs will only go to console`);
        }
    }

    private scheduleRetry(): void {
        this.initRetryTimeout = setTimeout(() => {
            console.debug('[Logger] Retrying Logtail initialization');
            this.initLogtail();
        }, 5000);
    }

    private shouldLog(level: LogLevel): boolean {
        return this.LOG_LEVEL_VALUES[level] >= this.LOG_LEVEL_VALUES[this.minLevel];
    }

    // Generic log method to reduce repetition
    private logWithLevel(level: LogLevel, ...args: any[]): void {
        if (!this.shouldLog(level)) return;

        // Try to initialize again if not initialized
        if (!this.isInitialized && this.betterStackToken && !this.initRetryTimeout) {
            this.initLogtail();
        }

        // Log to console
        console[level](...args);

        // Send to BetterStack
        this.sendToBetterStack(level, args);
    }

    // Console method equivalents
    log(...args: any[]): void {
        this.logWithLevel('info', ...args);
    }

    info(...args: any[]): void {
        this.logWithLevel('info', ...args);
    }

    warn(...args: any[]): void {
        this.logWithLevel('warn', ...args);
    }

    error(...args: any[]): void {
        this.logWithLevel('error', ...args);
    }

    debug(...args: any[]): void {
        this.logWithLevel('debug', ...args);
    }

    // Helper to send to BetterStack
    private sendToBetterStack(level: LogLevel, args: any[]): void {
        if (!this.logtail) {
            return;
        }

        try {
            // Extract message and metadata
            let message = '';
            let metadata: LogMetadata = {
                service: this.service,
                environment: this.environment,
                version: this.version,
                timestamp: new Date().toISOString(),
            };

            // Process args similar to console.log but improved
            if (args.length > 0) {
                // Format objects and errors better
                if (args[0] instanceof Error) {
                    const err = args[0];
                    message = err.message;
                    metadata.error = {
                        name: err.name,
                        stack: err.stack,
                        ...Object.fromEntries(Object.entries(err)) // Capture custom error properties
                    };
                } else if (typeof args[0] === 'string') {
                    message = args[0];
                } else {
                    // Try to stringify non-string first arguments
                    try {
                        message = JSON.stringify(args[0]);
                    } catch (e) {
                        message = String(args[0]);
                    }
                }

                // Handle additional args
                if (args.length > 1) {
                    if (args.length === 2 && typeof args[1] === 'object' && args[1] !== null && !(args[1] instanceof Error)) {
                        // If second arg is an object, use it as metadata
                        metadata = { ...metadata, ...args[1] };
                    } else {
                        // Process all remaining args
                        const additionalArgs = args.slice(1).map(arg => {
                            if (arg instanceof Error) {
                                return {
                                    errorMessage: arg.message,
                                    errorName: arg.name,
                                    errorStack: arg.stack,
                                    ...Object.fromEntries(Object.entries(arg))
                                };
                            }
                            return arg;
                        });

                        metadata.additionalArgs = additionalArgs;
                    }
                }
            }

            // Send to BetterStack
            this.logtail[level](message, metadata).catch((err) => {
                console.error(`[Logger] Failed to send log to BetterStack:`, err);
            });
        } catch (error) {
            console.error(`[Logger] Error in sendToBetterStack:`, error);
        }
    }

    // Create a new logger with additional context - improved implementation
    with(context: LogMetadata): Logger {
        // Create a new logger with the same options
        const newLogger = new Logger({
            betterStackToken: this.betterStackToken,
            betterStackEndpoint: this.betterStackEndpoint,
            service: context.service || this.service,
            environment: context.environment || this.environment,
            version: context.version || this.version,
            minLevel: this.minLevel
        });

        // Define a function to attach context
        const attachContext = (level: LogLevel) => {
            return function (this: Logger, ...args: any[]) {
                const newArgs = [...args];

                if (newArgs.length > 0) {
                    if (newArgs.length > 1 && typeof newArgs[1] === 'object' && newArgs[1] !== null && !(newArgs[1] instanceof Error)) {
                        // Merge context with existing metadata object
                        newArgs[1] = { ...context, ...newArgs[1] };
                    } else {
                        // Add context as metadata
                        newArgs.push({ ...context });
                    }
                }

                this.logWithLevel(level, ...newArgs);
            };
        };

        // Override log methods
        newLogger.log = attachContext('info').bind(newLogger);
        newLogger.info = attachContext('info').bind(newLogger);
        newLogger.warn = attachContext('warn').bind(newLogger);
        newLogger.error = attachContext('error').bind(newLogger);
        newLogger.debug = attachContext('debug').bind(newLogger);

        return newLogger;
    }

    // Set minimum log level dynamically
    setMinLogLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    // Flush method for compatibility with serverless environments - improved with better promise handling
    async flush(timeoutMs = 3000): Promise<void> {
        if (!this.logtail) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            console.debug(`[Logger] Flushing logs to BetterStack`);

            const timeoutId = setTimeout(() => {
                console.warn(`[Logger] Flush timed out after ${timeoutMs}ms`);
                resolve();
            }, timeoutMs);

            if (this.logtail) {
                this.logtail.flush()
                    .then(() => {
                        console.debug(`[Logger] Logs flushed successfully`);
                        clearTimeout(timeoutId);
                        resolve();
                    })
                    .catch((error) => {
                        console.error(`[Logger] Error flushing logs:`, error);
                        clearTimeout(timeoutId);
                        resolve();
                    });
            } else {
                resolve();
            }
        });
    }
}

// Create and export the default logger
export const logger = new Logger({
    betterStackToken: process.env.BETTER_STACK_SOURCE_TOKEN,
    betterStackEndpoint: process.env.BETTER_STACK_INGESTING_URL
});

// Export createLogger for custom instances
export function createLogger(options: LoggerOptions = {}): Logger {
    return new Logger(options);
}

// Default export
export default logger;
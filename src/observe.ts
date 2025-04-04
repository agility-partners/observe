/**
 * @name observe
 * @description A simple logger that emulates console.log while sending to BetterStack
 */
import { Logtail } from '@logtail/node';

// Simple logger class
export class Logger {
  private logtail: Logtail | null = null;
  private service: string;
  private environment: string;
  private version: string;
  private betterStackToken?: string;
  private betterStackEndpoint?: string;
  private isInitialized: boolean = false;

  constructor(options: {
    betterStackToken?: string;
    betterStackEndpoint?: string;
    service?: string;
    environment?: string;
    version?: string;
  } = {}) {
    // Try to get token from options or environment
    this.betterStackToken = options.betterStackToken || process.env.BETTER_STACK_SOURCE_TOKEN;
    this.betterStackEndpoint = options.betterStackEndpoint || process.env.BETTER_STACK_INGESTING_URL;
    this.service = options.service || process.env.SERVICE_NAME || 'application';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.version = options.version || process.env.SERVICE_VERSION || '1.0.0';
    
    // Initialize BetterStack logger
    this.initLogtail();
  }

  // Separate initialization to allow for delayed or retry initialization
  private initLogtail(): void {
    if (this.isInitialized) return;
    
    if (this.betterStackToken) {
      try {
        // Ensure the endpoint URL has the proper https:// prefix
        let endpoint = this.betterStackEndpoint || 'your-ingesting-url.betterstackdata.com';
        if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
          endpoint = `https://${endpoint}`;
        }
        
        console.debug(`[Logger] Initializing BetterStack logger with endpoint: ${endpoint}`);
        this.logtail = new Logtail(this.betterStackToken, {
          endpoint: endpoint,
        });
        this.isInitialized = true;
        console.debug(`[Logger] BetterStack logger initialized successfully`);
      } catch (error) {
        console.error(`[Logger] Failed to initialize BetterStack logger:`, error);
      }
    } else {
      console.debug(`[Logger] No BetterStack token provided, logs will only go to console`);
    }
  }

  // Direct console.log equivalent
  log(...args: any[]): void {
    // Try to initialize again if not initialized
    if (!this.isInitialized && this.betterStackToken) {
      this.initLogtail();
    }
    
    console.log(...args);
    this.sendToBetterStack('info', args);
  }

  // Console.info equivalent
  info(...args: any[]): void {
    console.info(...args);
    this.sendToBetterStack('info', args);
  }

  // Console.warn equivalent
  warn(...args: any[]): void {
    console.warn(...args);
    this.sendToBetterStack('warn', args);
  }

  // Console.error equivalent
  error(...args: any[]): void {
    console.error(...args);
    this.sendToBetterStack('error', args);
  }

  // Console.debug equivalent
  debug(...args: any[]): void {
    console.debug(...args);
    this.sendToBetterStack('debug', args);
  }

  // Helper to send to BetterStack
  private sendToBetterStack(level: 'info' | 'warn' | 'error' | 'debug', args: any[]): void {
    if (!this.logtail) {
      // Try to initialize again if we have a token but failed to initialize
      if (this.betterStackToken && !this.isInitialized) {
        console.log("[Logger] Attempting to reinitialize Logtail");
        this.initLogtail();
      }
      if (!this.logtail) return;
    }
    
    try {
      // Extract message and metadata
      let message = '';
      let metadata: Record<string, any> = {
        service: this.service,
        environment: this.environment,
        version: this.version,
        timestamp: new Date().toISOString() // Add explicit timestamp
      };
      
      // Process args similar to console.log
      if (args.length > 0) {
        if (typeof args[0] === 'string') {
          message = args[0];
          
          // Handle additional args
          if (args.length > 1) {
            if (args.length === 2 && typeof args[1] === 'object' && args[1] !== null) {
              // If second arg is an object, use it as metadata
              metadata = { ...metadata, ...args[1] };
            } else {
              // Otherwise add all args to an "args" property
              metadata.args = args.slice(1);
            }
          }
        } else {
          // If first arg isn't a string, stringify the whole args array
          message = JSON.stringify(args);
        }
      }
      
      // Send to BetterStack
      if (typeof this.logtail[level] === 'function') {
        this.logtail[level](message, metadata).catch((err) => {
          console.error(`[Logger] Failed to send log to BetterStack:`, err);
        });
      }
    } catch (error) {
      console.error(`[Logger] Error in sendToBetterStack:`, error);
    }
  }

  // Create a new logger with additional context
  with(context: Record<string, any>): Logger {
    // Create a new logger with the same token and endpoint
    const newLogger = new Logger({
      betterStackToken: this.betterStackToken,
      betterStackEndpoint: this.betterStackEndpoint,
      service: context.service || this.service,
      environment: context.environment || this.environment,
      version: context.version || this.version
    });
    
    // Copy the original methods
    const originalLog = newLogger.log.bind(newLogger);
    const originalInfo = newLogger.info.bind(newLogger);
    const originalWarn = newLogger.warn.bind(newLogger);
    const originalError = newLogger.error.bind(newLogger);
    const originalDebug = newLogger.debug.bind(newLogger);
    
    // Override with context
    newLogger.log = (...args: any[]) => {
      if (args.length > 0 && typeof args[0] === 'string' && args.length > 1 && typeof args[1] === 'object') {
        // If we have a string message and an object metadata, merge the context
        args[1] = { ...context, ...args[1] };
      } else if (args.length > 0 && typeof args[0] === 'string') {
        // If we only have a string message, add context as second arg
        args.push(context);
      }
      originalLog(...args);
    };
    
    // Do the same for other methods
    newLogger.info = (...args: any[]) => {
      if (args.length > 0 && typeof args[0] === 'string' && args.length > 1 && typeof args[1] === 'object') {
        args[1] = { ...context, ...args[1] };
      } else if (args.length > 0 && typeof args[0] === 'string') {
        args.push(context);
      }
      originalInfo(...args);
    };
    
    newLogger.warn = (...args: any[]) => {
      if (args.length > 0 && typeof args[0] === 'string' && args.length > 1 && typeof args[1] === 'object') {
        args[1] = { ...context, ...args[1] };
      } else if (args.length > 0 && typeof args[0] === 'string') {
        args.push(context);
      }
      originalWarn(...args);
    };
    
    newLogger.error = (...args: any[]) => {
      if (args.length > 0 && typeof args[0] === 'string' && args.length > 1 && typeof args[1] === 'object') {
        args[1] = { ...context, ...args[1] };
      } else if (args.length > 0 && typeof args[0] === 'string') {
        args.push(context);
      }
      originalError(...args);
    };
    
    newLogger.debug = (...args: any[]) => {
      if (args.length > 0 && typeof args[0] === 'string' && args.length > 1 && typeof args[1] === 'object') {
        args[1] = { ...context, ...args[1] };
      } else if (args.length > 0 && typeof args[0] === 'string') {
        args.push(context);
      }
      originalDebug(...args);
    };
    
    return newLogger;
  }

  // Flush method for compatibility with serverless environments
  async flush(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.logtail) {
        console.debug(`[Logger] No Logtail instance to flush`);
        return resolve();
      }
      
      try {
        console.debug(`[Logger] Flushing logs to BetterStack`);
        
        // Set timeout to ensure flush completes or times out
        const timeoutId = setTimeout(() => {
          console.warn(`[Logger] Flush timed out after 3000ms`);
          resolve();
        }, 3000);
        
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
      } catch (error) {
        console.error(`[Logger] Exception during flush:`, error);
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
export function createLogger(options: {
  betterStackToken?: string;
  betterStackEndpoint?: string;
  service?: string;
  environment?: string;
  version?: string;
} = {}): Logger {
  return new Logger(options);
}

// Default export
export default logger;
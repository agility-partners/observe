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

  constructor(options: {
    betterStackToken?: string;
    betterStackEndpoint?: string;
    service?: string;
    environment?: string;
    version?: string;
  } = {}) {
    this.service = options.service || process.env.SERVICE_NAME || 'application';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.version = options.version || process.env.SERVICE_VERSION || '1.0.0';
    this.betterStackToken = options.betterStackToken;
    this.betterStackEndpoint = options.betterStackEndpoint;
    
    // Initialize BetterStack logger if token is provided
    if (options.betterStackToken) {
      try {
        // Ensure the endpoint URL has the proper https:// prefix
        let endpoint = options.betterStackEndpoint || 'your-ingesting-url.betterstackdata.com';
        if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
          endpoint = `https://${endpoint}`;
        }
        
        this.logtail = new Logtail(options.betterStackToken, {
          endpoint: endpoint
        });
      } catch (error) {
        // Silent fail
      }
    }
  }

  // Direct console.log equivalent
  log(...args: any[]): void {
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
    if (!this.logtail) return;
    
    try {
      // Extract message and metadata
      let message = '';
      let metadata: Record<string, any> = {
        service: this.service,
        environment: this.environment,
        version: this.version
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
        this.logtail[level](message, metadata).catch(() => {
          // Silent fail
        });
      }
    } catch (error) {
      // Silent fail
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

  // Flush method for compatibility
  async flush(): Promise<void> {
    if (this.logtail) {
      try {
        await this.logtail.flush();
      } catch (error) {
        // Silent fail
      }
    }
    return Promise.resolve();
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
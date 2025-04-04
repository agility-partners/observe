# Observe

A TypeScript logging utility for Bun that uses Winston as the base framework and integrates with BetterStack for centralized log management. This logger provides structured logging with multiple transports (console, file, and BetterStack) and configurable log levels.

## Installation

Add this package directly from the GitHub repository (authentication required):

```bash
# Using Bun with authentication token (required)
bun add github:agility-partners/observe

# If you need to specify a branch/tag
bun add github:agility-partners/observe#main
```

You can create a GitHub personal access token in your GitHub account settings or use your organization's token. Make sure it has the appropriate permissions to access private repositories.

To use the package in your project:

```typescript
// Import the default logger
import logger from 'observe';

// Or import specific components
import { createLogger } from 'observe';
```

## Project Structure

```
observe/
├── index.ts           # Main entry point, exports from src/observe.ts
├── src/
│   ├── observe.ts      # Core logging implementation
│   └── example.ts      # Usage examples
├── dist/               # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
└── README.md
```

## Quick Start

```typescript
// Import the default logger instance
import logger from 'observe';

// Use the default logger (configured via environment variables)
logger.info('Application started');

// Log with structured data
logger.info('User logged in', { userId: 123, username: 'john.doe' });

// Different log levels
logger.error('Something bad happened', { error: new Error('Oops!') });
logger.warn('Resource usage high', { cpuUsage: 85 });
logger.debug('Processing request', { requestId: 'abc123' });

// Make sure logs are sent before the process exits
process.on('beforeExit', async () => {
  await logger.flush();
});
```

## Configuration

### Environment Variables

The default logger instance uses these environment variables:

```bash
# BetterStack configuration
export BETTER_STACK_SOURCE_TOKEN="your-source-token"
export BETTER_STACK_INGESTING_URL="your-ingesting-url.betterstackdata.com"  # No need for https:// prefix

# Service context
export SERVICE_NAME="your-service-name"
export NODE_ENV="production"
export SERVICE_VERSION="1.0.0"
```

### Custom Configuration

Create a custom logger with specific configuration:

```typescript
import { createLogger } from 'observe';

const logger = createLogger({
  betterStackToken: 'your-better-stack-token',
  betterStackEndpoint: 'your-ingesting-url.betterstackdata.com',  // No need for https:// prefix
  consoleLevel: 'debug',
  fileLevel: 'info',
  filePath: 'logs/app.log',
  serviceContext: {
    service: 'payment-service',
    environment: 'staging',
    version: '2.1.0'
  }
});
```

## Log Levels

This logger uses the standard Winston log levels in order of priority (highest to lowest):

- `error`: Fatal errors that cause the application to crash
- `warn`: Warning conditions that should be addressed
- `info`: Informational messages about normal application flow
- `http`: HTTP request/response logs
- `verbose`: Verbose information for detailed debugging
- `debug`: Debug information for development
- `silly`: Extremely detailed information

## Best Practices

1. **Use Structured Logging**: Add context as a second parameter to log methods:
   ```typescript
   logger.info('User registered', { userId: '123', email: 'user@example.com' });
   ```

2. **Log at Appropriate Levels**: Use the correct log level for each message.

3. **Handle Async Operations**: Ensure logs are flushed before process exit:
   ```typescript
   await logger.flush();
   ```

4. **Add Request Context**: For HTTP applications, log request details:
   ```typescript
   logger.http('API request', { method: 'GET', path: '/users', ip: req.ip });
   ```

5. **Use Service Context**: Add service information to identify log sources.

## Testing

The package includes both unit tests and integration tests:

```bash
# Run all tests
bun test

# Run only unit tests
bun run test:unit

# Run only integration tests
bun run test:integration
```

The test suite:
- Tests the logger creation and configuration
- Verifies all log levels work correctly
- Validates metadata inclusion in logs
- Checks service context is correctly applied
- Tests file logging functionality
- Ensures log flushing works properly

## Advanced Usage

Access Winston's built-in formats and transports for advanced configurations:

```typescript
import { format, transports, createLogger } from 'observe';

const logger = createLogger({
  // ... base config
});

// Add a custom transport
logger.add(new transports.Stream({
  stream: process.stderr,
  level: 'error'
}));
```

## License

MIT

/**
 * Example usage of the console-based Observe logging utility
 */

// Import the default logger instance
import logger from '../index';

// Or import specific components
import { createLogger, LogLevel } from '../index';

// Use the default logger
logger.info('Application started');

// Log with structured data
logger.info('User action performed', { 
  userId: 123, 
  action: 'login',
  timestamp: new Date().toISOString()
});

// Different log levels
logger.error('Database connection failed', { 
  error: new Error('Connection timeout'), 
  dbHost: 'db.example.com' 
});

logger.warn('API rate limit approaching', { 
  currentUsage: 980, 
  limit: 1000 
});

logger.debug('Processing request', { 
  requestId: 'req-123', 
  params: { id: 456 } 
});

// Create a custom logger with specific configuration
const customLogger = createLogger({
  level: LogLevel.DEBUG,
  serviceContext: {
    service: 'payment-service',
    environment: 'production',
    version: '1.2.0'
  }
});

customLogger.info('Payment processing started', { 
  paymentId: 'pay_123456', 
  amount: 99.99, 
  currency: 'USD' 
});

// Create a logger with additional context
const userLogger = logger.with({
  service: 'user-service',
  userId: 'user_123',
  requestId: 'req_456'
});

userLogger.info('User profile updated');
userLogger.debug('User details', { email: 'user@example.com' });

// Example of an async function using the logger
async function processOrder(orderId: string) {
  logger.info('Processing order', { orderId });
  
  try {
    // Simulate some async work
    await new Promise(resolve => setTimeout(resolve, 1000));
    logger.info('Order processed successfully', { orderId });
  } catch (error) {
    logger.error('Order processing failed', { orderId, error });
  }
}

// Execute the async function
processOrder('order_789').catch(error => {
  logger.error('Unexpected error', { error });
});
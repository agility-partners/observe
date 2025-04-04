/**
 * Example usage of the simple Observe logging utility
 */

// Import the default logger instance
import logger from '../index';

// Use exactly like console.log
logger.log('This is a basic log message');

// Log with structured data
logger.info('User action performed', { userId: 123, action: 'login' });

// Different log levels
logger.error('Database connection failed', { error: 'Connection timeout' });
logger.warn('API rate limit approaching', { currentUsage: 980, limit: 1000 });
logger.debug('Processing request', { requestId: 'req-123' });

// Create a logger with additional context
const userLogger = logger.with({ userId: 'user_123', requestId: 'req_456' });

// Use contextual logger - userId and requestId will be added automatically
userLogger.info('User profile updated');
userLogger.debug('User details', { email: 'user@example.com' });

// Example of an async function using the logger
async function processOrder(orderId: string) {
  logger.log('Processing order', { orderId });
  
  try {
    // Simulate some async work
    await new Promise(resolve => setTimeout(resolve, 1000));
    logger.log('Order processed successfully', { orderId });
  } catch (error) {
    logger.error('Order processing failed', { orderId, error });
  }
}

// Execute the async function
processOrder('order_789').catch(error => {
  logger.error('Unexpected error', { error });
});
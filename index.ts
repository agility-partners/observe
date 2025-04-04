/**
 * Observe - A TypeScript logging utility using Winston and BetterStack
 * 
 * This package provides a powerful logging solution that combines:
 * - Winston for flexible logging and multiple transports
 * - BetterStack for centralized log management
 * - Structured logging with context enrichment
 * - TypeScript support for better developer experience
 */

// Re-export everything from observe.ts
export * from './src/observe';

// Default export for convenience
import { logger } from './src/observe';
export default logger;
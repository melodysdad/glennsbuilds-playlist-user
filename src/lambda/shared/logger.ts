/**
 * Shared logger utility for Lambda functions
 * Uses pino for structured logging
 */

import pino from 'pino';

/**
 * Create a logger instance configured for AWS Lambda
 * - Uses JSON formatting for CloudWatch Logs Insights
 * - Optimized for Lambda performance
 * - Includes request context when available
 */
export const createLogger = (context?: { requestId?: string; functionName?: string }) => {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
      ...(context?.requestId && { requestId: context.requestId }),
      ...(context?.functionName && { function: context.functionName }),
    },
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
  });
};

/**
 * Default logger instance
 */
export const logger = createLogger();

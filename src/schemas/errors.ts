/**
 * Error response schemas
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Enable OpenAPI extensions on Zod
extendZodWithOpenApi(z);

/**
 * Standard error response schema
 */
export const ErrorResponseSchema = z
  .object({
    error: z
      .string()
      .openapi({
        description: 'Error message',
        example: 'userId is required',
      }),
    fields: z
      .record(z.string(), z.string())
      .optional()
      .openapi({
        description: 'Field-specific validation errors (for 400 errors)',
        example: {
          userId: 'Required',
          'preferences.varietyLevel': 'Must be between 1 and 10',
        },
      }),
    stack: z
      .string()
      .optional()
      .openapi({
        description: 'Stack trace (only included in development environment)',
      }),
  })
  .openapi('ErrorResponse');

/**
 * Not found error response schema
 */
export const NotFoundResponseSchema = z
  .object({
    error: z
      .string()
      .openapi({
        description: 'Not found error message',
        example: 'Playlist not found',
      }),
  })
  .openapi('NotFoundResponse');

/**
 * Conflict error response schema
 */
export const ConflictResponseSchema = z
  .object({
    error: z
      .string()
      .openapi({
        description: 'Conflict error message',
        example: 'Playlist already complete',
      }),
  })
  .openapi('ConflictResponse');

/**
 * Service error response schema (502)
 */
export const ServiceErrorResponseSchema = z
  .object({
    error: z
      .string()
      .openapi({
        description: 'Service error message',
        example: 'Playlist service is unavailable',
      }),
  })
  .openapi('ServiceErrorResponse');

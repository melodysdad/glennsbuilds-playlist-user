/**
 * Validation utilities for Lambda handlers
 * Provides helper functions for validating request data using Zod schemas
 */

import { z } from 'zod';
import { validationErrorResponse, type LambdaResponse } from './response.js';

/**
 * Validation result types
 */
export type ValidationSuccess<T> = {
  success: true;
  data: T;
};

export type ValidationFailure = {
  success: false;
  response: LambdaResponse;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate data against a Zod schema
 * Returns either the validated data or a formatted error response
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with either data or error response
 *
 * @example
 * const validation = validateSchema(GetPreferencesQuerySchema, event.queryStringParameters);
 * if (!validation.success) {
 *   return validation.response;
 * }
 * const { userId } = validation.data;
 */
export function validateSchema<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Extract field-level errors
    const fields: Record<string, string> = {};
    result.error.issues.forEach((err: z.ZodIssue) => {
      const path = err.path.join('.');
      fields[path] = err.message;
    });

    return {
      success: false,
      response: validationErrorResponse('Validation failed', fields),
    };
  }

  return { success: true, data: result.data };
}

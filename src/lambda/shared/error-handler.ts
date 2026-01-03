/**
 * Error handling utilities for Lambda functions
 */

import { errorResponse, LambdaResponse } from './response.js';

export class ValidationError extends Error {
  constructor(
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message?: string) {
    super(message || 'Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export function handleError(error: unknown): LambdaResponse {
  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
        fields: error.fields,
      }),
    };
  }

  if (error instanceof NotFoundError) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }

  if (error instanceof UnauthorizedError) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }

  return errorResponse(error);
}

/**
 * Shared Lambda response utilities
 * Provides consistent response formatting across all Lambda functions
 */

export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
};

export function successResponse<T>(
  data: T,
  statusCode: number = 200
): LambdaResponse {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(data),
  };
}

export function errorResponse(
  error: unknown,
  statusCode: number = 500
): LambdaResponse {
  console.error('Lambda error:', error);

  const message =
    error instanceof Error ? error.message : 'Internal server error';

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      error: message,
      ...(process.env.NODE_ENV === 'dev' && error instanceof Error
        ? { stack: error.stack }
        : {}),
    }),
  };
}

export function validationErrorResponse(
  message: string,
  fields?: Record<string, string>
): LambdaResponse {
  return {
    statusCode: 400,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      error: message,
      fields,
    }),
  };
}

export function notFoundResponse(resource: string): LambdaResponse {
  return {
    statusCode: 404,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      error: `${resource} not found`,
    }),
  };
}

export function unauthorizedResponse(message?: string): LambdaResponse {
  return {
    statusCode: 401,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      error: message || 'Unauthorized',
    }),
  };
}

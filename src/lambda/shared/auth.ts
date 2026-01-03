/**
 * Authentication utilities for extracting user information from Cognito JWT tokens
 */

import { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * JWT claims structure from Cognito
 */
interface JWTClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  'cognito:username'?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * HTTP API Gateway authorizer context with JWT
 */
interface JWTAuthorizer {
  jwt?: {
    claims?: JWTClaims;
  };
}

/**
 * Extended request context with authorizer
 */
interface RequestContextWithAuthorizer {
  authorizer?: JWTAuthorizer;
}

/**
 * Extract the authenticated user's ID from the Cognito JWT token
 *
 * When using Cognito authorizer with HTTP API Gateway, the JWT claims are
 * available in event.requestContext.authorizer.jwt.claims
 *
 * The 'sub' claim contains the unique Cognito user ID (UUID format)
 *
 * @param event - API Gateway proxy event (v1 or v2)
 * @returns The user ID (sub claim) from the JWT token
 * @throws Error if user ID cannot be extracted
 */
export function getUserIdFromEvent(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): string {
  // For HTTP API (v2), JWT claims are in requestContext.authorizer.jwt.claims
  if ('requestContext' in event && event.requestContext) {
    const authorizer = (event.requestContext as RequestContextWithAuthorizer)
      .authorizer;

    if (authorizer?.jwt?.claims?.sub) {
      return authorizer.jwt.claims.sub;
    }
  }

  throw new Error('User ID not found in authorization context');
}

/**
 * Extract the authenticated user's email from the Cognito JWT token
 *
 * @param event - API Gateway proxy event (v1 or v2)
 * @returns The user's email from the JWT token
 * @throws Error if email cannot be extracted
 */
export function getUserEmailFromEvent(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): string {
  if ('requestContext' in event && event.requestContext) {
    const authorizer = (event.requestContext as RequestContextWithAuthorizer)
      .authorizer;

    if (authorizer?.jwt?.claims?.email) {
      return authorizer.jwt.claims.email;
    }
  }

  throw new Error('User email not found in authorization context');
}

/**
 * Get all JWT claims from the Cognito token
 *
 * @param event - API Gateway proxy event (v1 or v2)
 * @returns Object containing all JWT claims
 */
export function getJWTClaims(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): Record<string, string | number | boolean | undefined> {
  if ('requestContext' in event && event.requestContext) {
    const authorizer = (event.requestContext as RequestContextWithAuthorizer)
      .authorizer;

    if (authorizer?.jwt?.claims) {
      return authorizer.jwt.claims;
    }
  }

  return {};
}

/**
 * Check if the authenticated user matches a specific user ID
 * Useful for authorization checks in endpoints with userId path parameters
 *
 * @param event - API Gateway proxy event
 * @param userIdToCheck - User ID to check against (e.g., from path parameters)
 * @returns true if the authenticated user matches the provided user ID
 */
export function isAuthorizedUser(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
  userIdToCheck: string
): boolean {
  try {
    const authenticatedUserId = getUserIdFromEvent(event);
    return authenticatedUserId === userIdToCheck;
  } catch {
    return false;
  }
}

/**
 * Format user ID for DynamoDB key
 * Convention: USER#<cognito-sub>
 *
 * @param userId - Cognito user ID (sub claim)
 * @returns Formatted user ID for DynamoDB
 */
export function formatUserIdForDynamoDB(userId: string): string {
  return `USER#${userId}`;
}

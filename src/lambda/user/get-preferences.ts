import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBUserRepository } from '../../storage/dynamodb-user-repository.js';
import { successResponse, errorResponse } from '../shared/response.js';
import { validateSchema } from '../shared/validation.js';
import { GetPreferencesQuerySchema } from '../../schemas/index.js';
import { logger } from '../shared/logger.js';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    logger.info('Get preferences request received');
    logger.debug({
      queryParams: event.queryStringParameters,
      body: event.body,
    }, 'Request details');

    // Support both query params and body (backward compatibility)
    const inputData =
      event.queryStringParameters || JSON.parse(event.body || '{}');

    logger.debug({ inputData }, 'Parsed input data');

    // Validate input
    const validation = validateSchema(GetPreferencesQuerySchema, inputData);
    if (!validation.success) {
      logger.warn({ validation: validation.response }, 'Validation failed');
      return validation.response;
    }

    const { userId } = validation.data;
    logger.info({ userId }, 'Validation succeeded');

    logger.debug({ userId }, 'Fetching user profile from DynamoDB');
    const userRepo = new DynamoDBUserRepository();
    const profile = await userRepo.getUserProfile(userId);

    if (!profile) {
      logger.info({ userId }, 'No profile found for user');
      return successResponse({
        message: 'No profile found for user',
        userId,
        profile: null,
      });
    }

    logger.info({ userId }, 'Profile found, returning success response');
    return successResponse({ userId, profile });
  } catch (error) {
    logger.error({ error }, 'Error in getUserPreferences');
    return errorResponse(error);
  }
}

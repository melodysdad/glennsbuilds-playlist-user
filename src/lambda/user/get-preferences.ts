import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBUserRepository } from '../../storage/dynamodb-user-repository.js';
import { successResponse, errorResponse } from '../shared/response.js';
import { validateSchema } from '../shared/validation.js';
import { GetPreferencesQuerySchema } from '../../schemas/index.js';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.error('Get preferences request received');

    // Support both query params and body (backward compatibility)
    const inputData =
      event.queryStringParameters || JSON.parse(event.body || '{}');

    // Validate input
    const validation = validateSchema(GetPreferencesQuerySchema, inputData);
    if (!validation.success) {
      return validation.response;
    }

    const { userId } = validation.data;

    const userRepo = new DynamoDBUserRepository();
    const profile = await userRepo.getUserProfile(userId);

    if (!profile) {
      return successResponse({
        message: 'No profile found for user',
        userId,
        profile: null,
      });
    }

    return successResponse({ userId, profile });
  } catch (error) {
    console.error('Error in getUserPreferences:', error);
    return errorResponse(error);
  }
}

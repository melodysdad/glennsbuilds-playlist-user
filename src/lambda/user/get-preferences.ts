import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBUserRepository } from '../../storage/dynamodb-user-repository.js';
import { successResponse, errorResponse } from '../shared/response.js';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.error('Get preferences request received');

    // Support both query params and body
    const userId =
      event.queryStringParameters?.userId ||
      JSON.parse(event.body || '{}').userId;

    if (!userId) {
      return errorResponse(new Error('userId is required'));
    }

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

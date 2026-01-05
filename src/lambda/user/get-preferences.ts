import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBUserRepository } from '../../storage/dynamodb-user-repository.js';
import { successResponse, errorResponse } from '../shared/response.js';
import { validateSchema } from '../shared/validation.js';
import { GetPreferencesQuerySchema } from '../../schemas/index.js';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.log('Get preferences request received');
    console.log('Query params:', JSON.stringify(event.queryStringParameters));
    console.log('Body:', event.body);

    // Support both query params and body (backward compatibility)
    const inputData =
      event.queryStringParameters || JSON.parse(event.body || '{}');

    console.log('Input data:', JSON.stringify(inputData));

    // Validate input
    const validation = validateSchema(GetPreferencesQuerySchema, inputData);
    if (!validation.success) {
      console.log('Validation failed:', JSON.stringify(validation.response));
      return validation.response;
    }

    console.log('Validation succeeded, userId:', validation.data.userId);

    const { userId } = validation.data;

    console.log('Fetching user profile from DynamoDB for userId:', userId);
    const userRepo = new DynamoDBUserRepository();
    const profile = await userRepo.getUserProfile(userId);

    if (!profile) {
      console.log('No profile found for user:', userId);
      return successResponse({
        message: 'No profile found for user',
        userId,
        profile: null,
      });
    }

    console.log('Profile found, returning success response');
    return successResponse({ userId, profile });
  } catch (error) {
    console.error('Error in getUserPreferences:', error);
    return errorResponse(error);
  }
}

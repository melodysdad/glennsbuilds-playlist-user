import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBUserRepository } from '../../storage/dynamodb-user-repository.js';
import { successResponse, errorResponse } from '../shared/response.js';
import { Suppression } from '../../types.js';
import { validateSchema } from '../shared/validation.js';
import { AddSuppressionBodySchema } from '../../schemas/index.js';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.error('Add suppression request received:', event.body);

    const body = JSON.parse(event.body || '{}');

    // Validate input
    const validation = validateSchema(AddSuppressionBodySchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const { userId, type, value, days } = validation.data;

    const userRepo = new DynamoDBUserRepository();

    // Calculate until date
    const until = new Date();
    until.setDate(until.getDate() + days);

    // Create new suppression
    const newSuppression: Suppression = {
      type: type as 'genre' | 'artist' | 'tag',
      value,
      until: until.toISOString(),
      createdAt: new Date().toISOString(),
    };

    await userRepo.addSuppression(userId, newSuppression);

    console.error(
      `Suppression added for user ${userId}: ${type} "${value}" for ${days} days`
    );
    return successResponse({
      message: `Suppressed ${type} "${value}" for ${days} days`,
      suppression: newSuppression,
    });
  } catch (error) {
    console.error('Error in addSuppression:', error);
    return errorResponse(error);
  }
}

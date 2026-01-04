import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBPlaylistRepository } from '../../storage/dynamodb-playlist-repository.js';
import { successResponse, errorResponse } from '../shared/response.js';
import { validateSchema } from '../shared/validation.js';
import { GetPlaylistHistoryQuerySchema } from '../../schemas/index.js';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.error('Get playlist history request received');

    // Support both query params and body (backward compatibility)
    const inputData =
      event.queryStringParameters || JSON.parse(event.body || '{}');

    // Validate input
    const validation = validateSchema(GetPlaylistHistoryQuerySchema, inputData);
    if (!validation.success) {
      return validation.response;
    }

    const { userId, limit, status } = validation.data;

    // Get playlists from DynamoDB
    const playlistRepo = new DynamoDBPlaylistRepository();
    const result = await playlistRepo.listPlaylists({
      userId,
      status,
      limit,
    });

    console.error(
      `Retrieved ${result.playlists.length} playlists for user ${userId}${
        status ? ` with status ${status}` : ''
      }`
    );

    return successResponse({
      userId,
      count: result.playlists.length,
      playlists: result.playlists,
      lastEvaluatedKey: result.lastEvaluatedKey,
    });
  } catch (error) {
    console.error('Error in getPlaylistHistory:', error);
    return errorResponse(error);
  }
}

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBPlaylistRepository } from '../../storage/dynamodb-playlist-repository.js';
import { successResponse, errorResponse } from '../shared/response.js';
import { PlaylistStatus } from '../../types.js';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.error('Get playlist history request received');

    // Support both query params and body
    const userId =
      event.queryStringParameters?.userId ||
      JSON.parse(event.body || '{}').userId;
    const limit = parseInt(
      event.queryStringParameters?.limit ||
        JSON.parse(event.body || '{}').limit ||
        '10'
    );
    const status = (event.queryStringParameters?.status ||
      JSON.parse(event.body || '{}').status) as PlaylistStatus | undefined;

    if (!userId) {
      return errorResponse(new Error('userId is required'));
    }

    // Validate status if provided
    if (status && !['draft', 'expanding', 'complete'].includes(status)) {
      return errorResponse(
        new Error('status must be one of: draft, expanding, complete')
      );
    }

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

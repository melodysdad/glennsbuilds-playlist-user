/**
 * POST /user/{userId}/playlist/{playlistId}/complete
 * User approves the preview and requests full 50-track generation
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PlaylistServiceClient } from '../../services/playlist-service-client.js';
import { DynamoDBPlaylistRepository } from '../../storage/dynamodb-playlist-repository.js';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '../shared/response.js';

const playlistClient = new PlaylistServiceClient();
const playlistRepo = new DynamoDBPlaylistRepository();

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.pathParameters?.userId;
    const playlistId = event.pathParameters?.playlistId;

    if (!userId || !playlistId) {
      return validationErrorResponse('userId and playlistId are required');
    }

    console.error('Complete request for user:', userId, 'playlist:', playlistId);

    // 1. Verify user owns this playlist
    const playlist = await playlistRepo.getPlaylist(userId, playlistId);
    if (!playlist) {
      return notFoundResponse('Playlist');
    }

    // 2. Check if already complete
    if (playlist.status === 'complete') {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Playlist already complete',
          playlist,
        }),
      };
    }

    // 3. Call playlist service to start async generation
    const result = await playlistClient.complete({ playlistId });

    console.error('Generation started:', result.executionArn);

    // 4. Update playlist status to 'expanding'
    await playlistRepo.updatePlaylistStatus(
      userId,
      playlistId,
      'expanding',
      result.executionArn
    );

    // 5. Return generation status
    return successResponse({
      ...result,
      message: `Generating your 50-song playlist. Check status with GET /user/${userId}/playlist/${playlistId}`,
    });
  } catch (error) {
    console.error('Error completing playlist:', error);
    return errorResponse(error, 502);
  }
}

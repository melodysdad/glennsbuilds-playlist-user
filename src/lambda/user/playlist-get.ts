/**
 * GET /user/{userId}/playlist/{playlistId}
 * Poll for playlist status and retrieve completed playlist
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

    console.error('Get playlist for user:', userId, 'playlist:', playlistId);

    // 1. Verify user owns this playlist
    const userPlaylist = await playlistRepo.getPlaylist(userId, playlistId);
    if (!userPlaylist) {
      return notFoundResponse('Playlist');
    }

    // 2. Fetch current status from playlist service
    const playlist = await playlistClient.getPlaylist({ playlistId });

    console.error('Playlist status:', playlist.status);

    // 3. Update local status if changed
    if (playlist.status !== userPlaylist.status) {
      await playlistRepo.updatePlaylistStatus(
        userId,
        playlistId,
        playlist.status
      );
    }

    // 4. Add helpful message based on status
    let message: string | undefined;
    if (playlist.status === 'generating') {
      const elapsed = Date.now() - new Date(playlist.createdAt).getTime();
      message = `Still generating... (${Math.floor(elapsed / 1000)} seconds elapsed)`;
    } else if (playlist.status === 'complete') {
      message = `Your 50-song playlist is ready!`;
    } else if (playlist.status === 'failed') {
      message = `Generation failed: ${playlist.error}`;
    }

    return successResponse({
      ...playlist,
      message,
    });
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return errorResponse(error, 502);
  }
}

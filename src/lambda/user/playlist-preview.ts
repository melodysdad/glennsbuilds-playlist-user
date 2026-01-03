/**
 * POST /user/{userId}/playlist/preview
 * Generate a 10-track preview playlist for the user
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PlaylistServiceClient } from '../../services/playlist-service-client.js';
import { DynamoDBPlaylistRepository } from '../../storage/dynamodb-playlist-repository.js';
import { DynamoDBUserRepository } from '../../storage/dynamodb-user-repository.js';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '../shared/response.js';

const playlistClient = new PlaylistServiceClient();
const playlistRepo = new DynamoDBPlaylistRepository();
const userRepo = new DynamoDBUserRepository();

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.pathParameters?.userId;
    const body = JSON.parse(event.body || '{}');
    const { prompt } = body;

    if (!userId || !prompt) {
      return validationErrorResponse('userId and prompt are required');
    }

    console.error('Preview request for user:', userId, 'prompt:', prompt);

    // 1. Fetch user context (optional - use defaults if not found)
    const [userProfile, suppressions] = await Promise.all([
      userRepo.getUserProfile(userId),
      userRepo.getActiveSuppressions(userId),
    ]);

    // Use default preferences if user has no profile
    const preferences = userProfile?.preferences || {
      varietyLevel: 5,
      energyPreference: 'mixed' as const,
      explicitOk: true,
    };

    // 2. Call playlist service with user context (microservice generates playlistId)
    const preview = await playlistClient.fetchPreview({
      prompt,
      preferences,
      suppressions: suppressions.map((s) => ({
        type: s.type as 'artist' | 'genre' | 'tag',
        value: s.value,
      })),
    });

    console.error('Preview received:', preview.playlistId);

    // 3. Save playlist to DynamoDB for tracking (using playlistId from microservice)
    await playlistRepo.savePlaylist(
      userId,
      prompt,
      preview.tracks.map((t, idx) => ({
        spotifyId: `preview-${idx}`,
        title: t.title,
        artist: t.artist,
        album: t.album,
        reasonIncluded: t.reasonIncluded,
      })),
      preferences,
      'draft',
      { playlistId: preview.playlistId }
    );

    // 5. Return preview with helpful message
    return successResponse({
      ...preview,
      message:
        'Here are your first 10 songs. Call POST /complete to generate the full 50-track playlist.',
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    return errorResponse(error, 502);
  }
}

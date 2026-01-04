/**
 * Response schemas for API endpoints
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
  UserProfileSchema,
  TrackSchema,
  SuppressionSchema,
  StoredPlaylistSchema,
  PlaylistStatusSchema,
} from './common.js';

// Enable OpenAPI extensions on Zod
extendZodWithOpenApi(z);

/**
 * GET /user/preferences - Response
 */
export const GetPreferencesResponseSchema = z
  .object({
    userId: z.string().openapi({ description: 'User identifier' }),
    profile: UserProfileSchema.nullable().openapi({
      description: 'User profile if exists, null otherwise',
    }),
    message: z
      .string()
      .optional()
      .openapi({
        description: 'Additional context message',
        example: 'No profile found for user',
      }),
  })
  .openapi('GetPreferencesResponse');

/**
 * PUT /user/preferences - Response
 */
export const UpdatePreferencesResponseSchema = z
  .object({
    message: z
      .string()
      .openapi({
        description: 'Success message',
        example: 'Preferences updated',
      }),
    profile: UserProfileSchema.openapi({
      description: 'Updated user profile',
    }),
  })
  .openapi('UpdatePreferencesResponse');

/**
 * POST /user/suppressions - Response
 */
export const AddSuppressionResponseSchema = z
  .object({
    message: z
      .string()
      .openapi({
        description: 'Success message',
        example: 'Suppressed genre "pop" for 30 days',
      }),
    suppression: SuppressionSchema.openapi({
      description: 'Created suppression details',
    }),
  })
  .openapi('AddSuppressionResponse');

/**
 * GET /user/playlists - Response
 */
export const GetPlaylistHistoryResponseSchema = z
  .object({
    userId: z.string().openapi({ description: 'User identifier' }),
    count: z
      .number()
      .int()
      .openapi({
        description: 'Number of playlists returned',
        example: 5,
      }),
    playlists: z
      .array(StoredPlaylistSchema)
      .openapi({
        description: 'List of playlists',
      }),
    lastEvaluatedKey: z
      .object({
        userId: z.string(),
        playlistId: z.string(),
      })
      .optional()
      .openapi({
        description: 'Pagination key for next page of results',
      }),
  })
  .openapi('GetPlaylistHistoryResponse');

/**
 * POST /user/playlist/preview - Response
 */
export const PlaylistPreviewResponseSchema = z
  .object({
    playlistId: z
      .string()
      .openapi({
        description: 'Unique playlist identifier',
        example: '2024-01-15T10:30:00.000Z',
      }),
    status: z
      .literal('preview')
      .openapi({
        description: 'Playlist status',
        example: 'preview',
      }),
    tracks: z
      .array(TrackSchema)
      .openapi({
        description: 'Preview tracks (typically 10)',
      }),
    reasoning: z
      .string()
      .openapi({
        description: 'LLM-generated explanation of playlist curation',
        example:
          'Based on your love for classic rock, I selected these high-energy anthems...',
      }),
    createdAt: z
      .string()
      .datetime()
      .openapi({
        description: 'ISO 8601 timestamp of playlist creation',
      }),
    message: z
      .string()
      .optional()
      .openapi({
        description: 'Additional context message',
        example:
          'Here are your first 10 songs. Call POST /complete to generate the full 50-track playlist.',
      }),
  })
  .openapi('PlaylistPreviewResponse');

/**
 * POST /user/playlist/{playlistId}/complete - Response
 */
export const PlaylistCompleteResponseSchema = z
  .object({
    playlistId: z
      .string()
      .openapi({
        description: 'Playlist identifier',
      }),
    status: z
      .literal('generating')
      .openapi({
        description: 'Playlist status after starting generation',
        example: 'generating',
      }),
    executionArn: z
      .string()
      .openapi({
        description: 'AWS Step Functions execution ARN for tracking async generation',
        example: 'arn:aws:states:us-east-1:123456789:execution:playlist-gen:abc123',
      }),
    message: z
      .string()
      .openapi({
        description: 'Instructions for checking status',
        example:
          'Generating your 50-song playlist. Check status with GET /user/{userId}/playlist/{playlistId}',
      }),
  })
  .openapi('PlaylistCompleteResponse');

/**
 * GET /user/playlist/{playlistId} - Response
 */
export const PlaylistGetResponseSchema = z
  .object({
    playlistId: z.string().openapi({ description: 'Playlist identifier' }),
    status: PlaylistStatusSchema.openapi({
      description: 'Current playlist generation status',
    }),
    tracks: z
      .array(TrackSchema)
      .openapi({
        description: 'Tracks in the playlist (count depends on status)',
      }),
    reasoning: z
      .string()
      .openapi({
        description: 'LLM-generated explanation of playlist curation',
      }),
    createdAt: z
      .string()
      .datetime()
      .openapi({
        description: 'ISO 8601 timestamp of playlist creation',
      }),
    completedAt: z
      .string()
      .datetime()
      .optional()
      .openapi({
        description: 'ISO 8601 timestamp when playlist generation completed',
      }),
    error: z
      .string()
      .optional()
      .openapi({
        description: 'Error message if generation failed',
      }),
    message: z
      .string()
      .optional()
      .openapi({
        description: 'Context-specific status message',
      }),
  })
  .openapi('PlaylistGetResponse');

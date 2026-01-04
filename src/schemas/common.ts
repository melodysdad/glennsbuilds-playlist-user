/**
 * Common Zod schemas for shared types
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Enable OpenAPI extensions on Zod
extendZodWithOpenApi(z);

/**
 * User Preferences Schema
 */
export const UserPreferencesSchema = z
  .object({
    varietyLevel: z
      .number()
      .int()
      .min(1)
      .max(10)
      .openapi({
        description:
          'How much variety in song selection (1=similar songs, 10=diverse mix)',
        example: 5,
      }),
    energyPreference: z
      .enum(['high', 'mixed', 'low'])
      .openapi({
        description: 'Preferred energy level for tracks',
        example: 'mixed',
      }),
    explicitOk: z
      .boolean()
      .openapi({
        description: 'Whether explicit content is acceptable',
        example: true,
      }),
  })
  .openapi('UserPreferences');

/**
 * User Profile Schema
 */
export const UserProfileSchema = z
  .object({
    userId: z
      .string()
      .openapi({
        description: 'Unique user identifier',
        example: 'user-12345',
      }),
    preferences: UserPreferencesSchema,
    favoriteArtists: z
      .array(z.string())
      .openapi({
        description: 'List of favorite artist names',
        example: ['Queen', 'The Beatles', 'Pink Floyd'],
      }),
    favoriteGenres: z
      .array(z.string())
      .openapi({
        description: 'List of favorite music genres',
        example: ['rock', 'classical', 'jazz'],
      }),
    createdAt: z
      .string()
      .datetime()
      .openapi({
        description: 'ISO 8601 timestamp of profile creation',
        example: '2024-01-15T10:30:00Z',
      }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({
        description: 'ISO 8601 timestamp of last update',
        example: '2024-01-15T14:45:00Z',
      }),
  })
  .openapi('UserProfile');

/**
 * Track Schema
 */
export const TrackSchema = z
  .object({
    spotifyId: z
      .string()
      .openapi({
        description: 'Spotify track identifier',
        example: 'preview-0',
      }),
    title: z
      .string()
      .openapi({
        description: 'Track title',
        example: 'Bohemian Rhapsody',
      }),
    artist: z
      .string()
      .openapi({
        description: 'Primary artist name',
        example: 'Queen',
      }),
    album: z
      .string()
      .optional()
      .openapi({
        description: 'Album name',
        example: 'A Night at the Opera',
      }),
    reasonIncluded: z
      .string()
      .openapi({
        description: 'LLM-generated explanation for why this track was selected',
        example: 'Classic rock anthem matching your love for dramatic vocals and complex arrangements',
      }),
  })
  .openapi('Track');

/**
 * Suppression Schema
 */
export const SuppressionSchema = z
  .object({
    type: z
      .enum(['genre', 'artist', 'tag'])
      .openapi({
        description: 'Type of suppression',
        example: 'genre',
      }),
    value: z
      .string()
      .openapi({
        description: 'The genre/artist/tag to suppress',
        example: 'pop',
      }),
    until: z
      .string()
      .datetime()
      .openapi({
        description: 'ISO 8601 timestamp when suppression expires',
        example: '2024-02-15T10:30:00Z',
      }),
    createdAt: z
      .string()
      .datetime()
      .openapi({
        description: 'ISO 8601 timestamp when suppression was created',
        example: '2024-01-15T10:30:00Z',
      }),
  })
  .openapi('Suppression');

/**
 * Playlist Status Enum
 */
export const PlaylistStatusSchema = z
  .enum(['draft', 'preview', 'expanding', 'generating', 'complete', 'failed'])
  .openapi({
    description: 'Current status of playlist generation',
    example: 'complete',
  });

/**
 * Stored Playlist Schema
 */
export const StoredPlaylistSchema = z
  .object({
    userId: z.string().openapi({ description: 'User who owns the playlist' }),
    playlistId: z
      .string()
      .openapi({
        description: 'Unique playlist identifier (timestamp-based for sortability)',
        example: '2024-01-15T10:30:00.000Z',
      }),
    status: PlaylistStatusSchema,
    prompt: z
      .string()
      .openapi({
        description: 'Original user prompt for playlist generation',
        example: 'Upbeat songs for a morning workout',
      }),
    tracks: z.array(TrackSchema),
    preferences: UserPreferencesSchema,
    targetCount: z
      .number()
      .int()
      .optional()
      .openapi({
        description: 'Target number of tracks (default 50)',
        example: 50,
      }),
    executionArn: z
      .string()
      .optional()
      .openapi({
        description: 'AWS Step Functions execution ARN for async generation',
        example: 'arn:aws:states:us-east-1:123456789:execution:playlist-gen:abc123',
      }),
    createdAt: z
      .string()
      .datetime()
      .openapi({
        description: 'ISO 8601 timestamp of playlist creation',
      }),
    ttl: z
      .number()
      .int()
      .openapi({
        description: 'Unix timestamp for DynamoDB TTL (auto-deletion)',
        example: 1705329000,
      }),
    bedrockRequest: z
      .unknown()
      .optional()
      .openapi({
        description: 'Original Bedrock request for debugging',
      }),
    bedrockResponse: z
      .unknown()
      .optional()
      .openapi({
        description: 'Raw Bedrock response for debugging',
      }),
  })
  .openapi('StoredPlaylist');

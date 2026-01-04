/**
 * Request schemas for API endpoints
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { UserPreferencesSchema, PlaylistStatusSchema } from './common.js';

// Enable OpenAPI extensions on Zod
extendZodWithOpenApi(z);

/**
 * GET /user/preferences - Query parameters
 */
export const GetPreferencesQuerySchema = z
  .object({
    userId: z
      .string()
      .min(1)
      .openapi({
        description: 'User identifier',
        example: 'user-12345',
      }),
  })
  .openapi('GetPreferencesQuery');

/**
 * PUT /user/preferences - Request body
 */
export const UpdatePreferencesBodySchema = z
  .object({
    userId: z
      .string()
      .min(1)
      .openapi({
        description: 'User identifier',
        example: 'user-12345',
      }),
    preferences: UserPreferencesSchema.partial().optional().openapi({
      description: 'Partial user preferences to update',
    }),
    favoriteArtists: z
      .array(z.string())
      .optional()
      .openapi({
        description: 'List of favorite artist names',
        example: ['Queen', 'The Beatles'],
      }),
    favoriteGenres: z
      .array(z.string())
      .optional()
      .openapi({
        description: 'List of favorite music genres',
        example: ['rock', 'classical'],
      }),
  })
  .refine(
    (data) => data.preferences || data.favoriteArtists || data.favoriteGenres,
    {
      message:
        'At least one of preferences, favoriteArtists, or favoriteGenres is required',
    }
  )
  .openapi('UpdatePreferencesBody');

/**
 * POST /user/suppressions - Request body
 */
export const AddSuppressionBodySchema = z
  .object({
    userId: z
      .string()
      .min(1)
      .openapi({
        description: 'User identifier',
        example: 'user-12345',
      }),
    type: z
      .enum(['genre', 'artist', 'tag'])
      .openapi({
        description: 'Type of suppression',
        example: 'genre',
      }),
    value: z
      .string()
      .min(1)
      .openapi({
        description: 'The genre/artist/tag to suppress',
        example: 'pop',
      }),
    days: z
      .number()
      .int()
      .positive()
      .openapi({
        description: 'Number of days to suppress for',
        example: 30,
      }),
  })
  .openapi('AddSuppressionBody');

/**
 * GET /user/playlists - Query parameters
 */
export const GetPlaylistHistoryQuerySchema = z
  .object({
    userId: z
      .string()
      .min(1)
      .openapi({
        description: 'User identifier',
        example: 'user-12345',
      }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().positive().max(100))
      .openapi({
        description: 'Maximum number of playlists to return (default 10, max 100)',
        example: '10',
      }),
    status: PlaylistStatusSchema.optional().openapi({
      description: 'Filter by playlist status',
      example: 'complete',
    }),
  })
  .openapi('GetPlaylistHistoryQuery');

/**
 * POST /user/playlist/preview - Request body
 */
export const PlaylistPreviewBodySchema = z
  .object({
    prompt: z
      .string()
      .min(1)
      .openapi({
        description: 'Natural language description of desired playlist',
        example: 'Upbeat songs for a morning workout',
      }),
  })
  .openapi('PlaylistPreviewBody');

/**
 * POST /user/playlist/preview - Path parameters
 */
export const PlaylistPreviewPathSchema = z
  .object({
    userId: z
      .string()
      .min(1)
      .openapi({
        description: 'User identifier',
        example: 'user-12345',
      }),
  })
  .openapi('PlaylistPreviewPath');

/**
 * POST /user/playlist/{playlistId}/complete - Path parameters
 */
export const PlaylistCompletePathSchema = z
  .object({
    userId: z
      .string()
      .min(1)
      .openapi({
        description: 'User identifier',
        example: 'user-12345',
      }),
    playlistId: z
      .string()
      .min(1)
      .openapi({
        description: 'Playlist identifier',
        example: '2024-01-15T10:30:00.000Z',
      }),
  })
  .openapi('PlaylistCompletePath');

/**
 * GET /user/playlist/{playlistId} - Path parameters
 */
export const PlaylistGetPathSchema = z
  .object({
    userId: z
      .string()
      .min(1)
      .openapi({
        description: 'User identifier',
        example: 'user-12345',
      }),
    playlistId: z
      .string()
      .min(1)
      .openapi({
        description: 'Playlist identifier',
        example: '2024-01-15T10:30:00.000Z',
      }),
  })
  .openapi('PlaylistGetPath');

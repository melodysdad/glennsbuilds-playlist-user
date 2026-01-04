/**
 * OpenAPI Registry
 * Registers all API routes and generates OpenAPI documentation
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import {
  // Common schemas
  UserProfileSchema,
  TrackSchema,
  SuppressionSchema,
  StoredPlaylistSchema,
  // Request schemas
  GetPreferencesQuerySchema,
  UpdatePreferencesBodySchema,
  AddSuppressionBodySchema,
  GetPlaylistHistoryQuerySchema,
  PlaylistPreviewBodySchema,
  PlaylistCompletePathSchema,
  PlaylistGetPathSchema,
  // Response schemas
  GetPreferencesResponseSchema,
  UpdatePreferencesResponseSchema,
  AddSuppressionResponseSchema,
  GetPlaylistHistoryResponseSchema,
  PlaylistPreviewResponseSchema,
  PlaylistCompleteResponseSchema,
  PlaylistGetResponseSchema,
  // Error schemas
  ErrorResponseSchema,
  NotFoundResponseSchema,
  ConflictResponseSchema,
  ServiceErrorResponseSchema,
} from '../schemas/index.js';

// Create the OpenAPI registry
const registry = new OpenAPIRegistry();

// Register shared component schemas
registry.register('UserProfile', UserProfileSchema);
registry.register('Track', TrackSchema);
registry.register('Suppression', SuppressionSchema);
registry.register('StoredPlaylist', StoredPlaylistSchema);
registry.register('Error', ErrorResponseSchema);
registry.register('NotFound', NotFoundResponseSchema);
registry.register('Conflict', ConflictResponseSchema);
registry.register('ServiceError', ServiceErrorResponseSchema);

// ============================================
// Route: GET /user/preferences
// ============================================
registry.registerPath({
  method: 'get',
  path: '/user/preferences',
  summary: 'Get user preferences',
  description: 'Retrieve user profile including preferences, favorite artists, and genres',
  tags: ['User Preferences'],
  request: {
    query: GetPreferencesQuerySchema,
  },
  responses: {
    200: {
      description: 'User preferences retrieved successfully',
      content: {
        'application/json': {
          schema: GetPreferencesResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error - missing or invalid parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Route: PUT /user/preferences
// ============================================
registry.registerPath({
  method: 'put',
  path: '/user/preferences',
  summary: 'Update user preferences',
  description:
    'Update user profile preferences, favorite artists, or favorite genres. At least one field must be provided.',
  tags: ['User Preferences'],
  request: {
    body: {
      description: 'Updated user preferences',
      content: {
        'application/json': {
          schema: UpdatePreferencesBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Preferences updated successfully',
      content: {
        'application/json': {
          schema: UpdatePreferencesResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error - missing userId or no fields to update',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Route: POST /user/suppressions
// ============================================
registry.registerPath({
  method: 'post',
  path: '/user/suppressions',
  summary: 'Add a suppression',
  description:
    'Suppress a genre, artist, or tag from playlist generation for a specified number of days',
  tags: ['Suppressions'],
  request: {
    body: {
      description: 'Suppression details',
      content: {
        'application/json': {
          schema: AddSuppressionBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Suppression added successfully',
      content: {
        'application/json': {
          schema: AddSuppressionResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error - missing or invalid parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Route: GET /user/playlists
// ============================================
registry.registerPath({
  method: 'get',
  path: '/user/playlists',
  summary: 'Get playlist history',
  description:
    'Retrieve user\'s playlist history with optional filtering by status and pagination',
  tags: ['History'],
  request: {
    query: GetPlaylistHistoryQuerySchema,
  },
  responses: {
    200: {
      description: 'Playlist history retrieved successfully',
      content: {
        'application/json': {
          schema: GetPlaylistHistoryResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error - missing or invalid parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Route: POST /user/{userId}/playlist/preview
// ============================================
registry.registerPath({
  method: 'post',
  path: '/user/{userId}/playlist/preview',
  summary: 'Generate playlist preview',
  description:
    'Generate a 10-track playlist preview based on user prompt and preferences. Use this to preview before generating the full 50-track playlist.',
  tags: ['Playlists'],
  request: {
    params: PlaylistCompletePathSchema.pick({ userId: true }), // Only userId param
    body: {
      description: 'Playlist generation prompt',
      content: {
        'application/json': {
          schema: PlaylistPreviewBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Preview playlist generated successfully',
      content: {
        'application/json': {
          schema: PlaylistPreviewResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error - missing or invalid prompt',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    502: {
      description: 'Playlist generation service error',
      content: {
        'application/json': {
          schema: ServiceErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Route: POST /user/{userId}/playlist/{playlistId}/complete
// ============================================
registry.registerPath({
  method: 'post',
  path: '/user/{userId}/playlist/{playlistId}/complete',
  summary: 'Complete playlist generation',
  description:
    'Start async generation of full 50-track playlist from a preview. Returns immediately with execution ARN for status tracking.',
  tags: ['Playlists'],
  request: {
    params: PlaylistCompletePathSchema,
  },
  responses: {
    200: {
      description: 'Full playlist generation started successfully',
      content: {
        'application/json': {
          schema: PlaylistCompleteResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error - missing parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Playlist not found',
      content: {
        'application/json': {
          schema: NotFoundResponseSchema,
        },
      },
    },
    409: {
      description: 'Playlist already complete',
      content: {
        'application/json': {
          schema: ConflictResponseSchema,
        },
      },
    },
    502: {
      description: 'Playlist generation service error',
      content: {
        'application/json': {
          schema: ServiceErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ============================================
// Route: GET /user/{userId}/playlist/{playlistId}
// ============================================
registry.registerPath({
  method: 'get',
  path: '/user/{userId}/playlist/{playlistId}',
  summary: 'Get playlist status',
  description:
    'Check the status and retrieve tracks for a playlist. Use this to poll for completion after starting async generation.',
  tags: ['Playlists'],
  request: {
    params: PlaylistGetPathSchema,
  },
  responses: {
    200: {
      description: 'Playlist status retrieved successfully',
      content: {
        'application/json': {
          schema: PlaylistGetResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error - missing parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Playlist not found',
      content: {
        'application/json': {
          schema: NotFoundResponseSchema,
        },
      },
    },
    502: {
      description: 'Playlist generation service error',
      content: {
        'application/json': {
          schema: ServiceErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

/**
 * Generate the complete OpenAPI document
 */
export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Playlist User Service API',
      version: '1.0.0',
      description:
        'User management and playlist generation service for glennsbuilds playlist application. This service manages user preferences, suppressions, and orchestrates playlist generation via the playlist-generation microservice.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'https://api.glennsbuilds.com',
        description: 'Production',
      },
      {
        url: 'https://api-dev.glennsbuilds.com',
        description: 'Development',
      },
    ],
    tags: [
      {
        name: 'User Preferences',
        description: 'User profile and preferences management',
      },
      {
        name: 'Suppressions',
        description: 'Manage genre/artist/tag suppressions for playlist generation',
      },
      {
        name: 'Playlists',
        description: 'Playlist preview, generation, and status retrieval',
      },
      {
        name: 'History',
        description: 'Playlist generation history',
      },
    ],
  });
}

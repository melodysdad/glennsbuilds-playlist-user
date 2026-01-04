/**
 * Central export for all schemas
 */

// Common schemas
export {
  UserPreferencesSchema,
  UserProfileSchema,
  TrackSchema,
  SuppressionSchema,
  PlaylistStatusSchema,
  StoredPlaylistSchema,
} from './common.js';

// Request schemas
export {
  GetPreferencesQuerySchema,
  UpdatePreferencesBodySchema,
  AddSuppressionBodySchema,
  GetPlaylistHistoryQuerySchema,
  PlaylistPreviewBodySchema,
  PlaylistPreviewPathSchema,
  PlaylistCompletePathSchema,
  PlaylistGetPathSchema,
} from './requests.js';

// Response schemas
export {
  GetPreferencesResponseSchema,
  UpdatePreferencesResponseSchema,
  AddSuppressionResponseSchema,
  GetPlaylistHistoryResponseSchema,
  PlaylistPreviewResponseSchema,
  PlaylistCompleteResponseSchema,
  PlaylistGetResponseSchema,
} from './responses.js';

// Error schemas
export {
  ErrorResponseSchema,
  NotFoundResponseSchema,
  ConflictResponseSchema,
  ServiceErrorResponseSchema,
} from './errors.js';

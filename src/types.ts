/**
 * Core types for the playlist MCP server
 */

export interface UserProfile {
  userId: string;
  preferences: {
    varietyLevel: number; // 1-10
    energyPreference: 'high' | 'mixed' | 'low';
    explicitOk: boolean;
  };
  favoriteArtists: string[];
  favoriteGenres: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Suppression {
  type: 'genre' | 'artist' | 'tag';
  value: string;
  until: string; // ISO date
  createdAt: string;
}

export interface Track {
  spotifyId: string;
  title: string;
  artist: string;
  album?: string;
  reasonIncluded: string; // Why LLM chose this track
}

export interface PlaylistGeneration {
  playlistId: string;
  userId: string;
  version: number;
  generatedAt: string;
  generationParams: {
    prompt: string;
    varietyLevel: number;
    activeSuppressions: string[];
    model: string;
  };
  tracks: Track[];
  userFeedback: Array<{
    trackId: string;
    action: 'skipped' | 'liked' | 'saved';
    timestamp: string;
  }>;
}

export interface MusicServiceCredentials {
  service: 'spotify' | 'apple' | 'youtube';
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Tool input/output types
 */

export interface GeneratePlaylistInput {
  userId: string;
  prompt: string;
  length?: number;
}

export interface GeneratePlaylistOutput {
  playlistId: string;
  summary: string;
  tracks: Track[];
}

export interface UpdatePreferencesInput {
  userId: string;
  preferences: Partial<UserProfile['preferences']>;
  favoriteArtists?: string[];
  favoriteGenres?: string[];
}

export interface AddSuppressionInput {
  userId: string;
  type: 'genre' | 'artist' | 'tag';
  value: string;
  days: number;
}

export interface GetPlaylistHistoryInput {
  userId: string;
  limit?: number;
}

/**
 * DynamoDB persistence types
 */

export type PlaylistStatus =
  | 'draft' // Initial 10-20 track draft
  | 'preview' // 10-track preview from playlist service
  | 'expanding' // Generating full 50-track playlist
  | 'generating' // Alias for expanding (from playlist service)
  | 'complete' // Full playlist ready
  | 'failed'; // Generation failed

export interface StoredPlaylist {
  userId: string;
  playlistId: string; // timestamp-based for sortability
  status: PlaylistStatus;
  prompt: string;
  tracks: Track[];
  preferences: UserProfile['preferences']; // snapshot at generation time
  targetCount?: number; // for expanding playlists
  executionArn?: string; // Step Functions ARN if async job running
  createdAt: string; // ISO timestamp
  ttl: number; // Unix timestamp for DynamoDB TTL (7 days for drafts, 30 for complete)
  bedrockRequest?: unknown; // full request for debugging
  bedrockResponse?: unknown; // full response for debugging
}

export interface ListPlaylistsOptions {
  userId: string;
  status?: PlaylistStatus;
  limit?: number;
  lastEvaluatedKey?: {
    userId: string;
    playlistId: string;
  };
}

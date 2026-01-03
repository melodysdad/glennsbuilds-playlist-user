/**
 * Abstract storage layer interface
 * Allows swapping between local filesystem and cloud storage (S3)
 */

import {
  UserProfile,
  Suppression,
  PlaylistGeneration,
  MusicServiceCredentials,
} from '../types.js';

export interface StorageLayer {
  // User profile
  getUserProfile(userId: string): Promise<UserProfile | null>;
  saveUserProfile(userId: string, profile: UserProfile): Promise<void>;

  // Suppressions
  getActiveSuppressions(userId: string): Promise<Suppression[]>;
  getAllSuppressions(userId: string): Promise<Suppression[]>;
  saveSuppressions(userId: string, suppressions: Suppression[]): Promise<void>;

  // Playlist history
  savePlaylistGeneration(
    userId: string,
    playlist: PlaylistGeneration
  ): Promise<void>;
  getPlaylistHistory(
    userId: string,
    limit?: number
  ): Promise<PlaylistGeneration[]>;

  // Service credentials
  getServiceCredentials(
    userId: string,
    service: string
  ): Promise<MusicServiceCredentials | null>;
  saveServiceCredentials(
    userId: string,
    credentials: MusicServiceCredentials
  ): Promise<void>;
}

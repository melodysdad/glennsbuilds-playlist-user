/**
 * Mock storage layer for testing
 * Provides in-memory storage implementation for tests
 */

import {
  UserProfile,
  Suppression,
  PlaylistGeneration,
  MusicServiceCredentials,
} from '../../src/types.js';
import { StorageLayer } from '../../src/storage/storage-interface.js';

export class MockStorage implements StorageLayer {
  private profiles: Map<string, UserProfile> = new Map();
  private suppressions: Map<string, Suppression[]> = new Map();
  private playlists: Map<string, PlaylistGeneration[]> = new Map();
  private credentials: Map<string, MusicServiceCredentials> = new Map();

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) || null;
  }

  async saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
    this.profiles.set(userId, profile);
  }

  async getActiveSuppressions(userId: string): Promise<Suppression[]> {
    const allSuppressions = this.suppressions.get(userId) || [];
    const now = new Date();
    return allSuppressions.filter((s) => new Date(s.until) > now);
  }

  async getAllSuppressions(userId: string): Promise<Suppression[]> {
    return this.suppressions.get(userId) || [];
  }

  async saveSuppressions(
    userId: string,
    suppressions: Suppression[]
  ): Promise<void> {
    this.suppressions.set(userId, suppressions);
  }

  async addSuppression(userId: string, suppression: Suppression): Promise<string> {
    const existingSuppressions = this.suppressions.get(userId) || [];
    existingSuppressions.push(suppression);
    this.suppressions.set(userId, existingSuppressions);

    // Generate a mock suppression ID
    const timestamp = new Date(suppression.until).getTime();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${suppression.type}-${suppression.value}-${random}`;
  }

  async savePlaylistGeneration(
    userId: string,
    playlist: PlaylistGeneration
  ): Promise<void> {
    const userPlaylists = this.playlists.get(userId) || [];
    userPlaylists.push(playlist);
    this.playlists.set(userId, userPlaylists);
  }

  async getPlaylistHistory(
    userId: string,
    limit = 10
  ): Promise<PlaylistGeneration[]> {
    const userPlaylists = this.playlists.get(userId) || [];
    return userPlaylists
      .sort(
        (a, b) =>
          new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      )
      .slice(0, limit);
  }

  async getServiceCredentials(
    userId: string,
    service: string
  ): Promise<MusicServiceCredentials | null> {
    const key = `${userId}:${service}`;
    return this.credentials.get(key) || null;
  }

  async saveServiceCredentials(
    userId: string,
    credentials: MusicServiceCredentials
  ): Promise<void> {
    const key = `${userId}:${credentials.service}`;
    this.credentials.set(key, credentials);
  }

  // Test utility methods
  clear(): void {
    this.profiles.clear();
    this.suppressions.clear();
    this.playlists.clear();
    this.credentials.clear();
  }

  seedUserProfile(userId: string, overrides?: Partial<UserProfile>): void {
    const profile: UserProfile = {
      userId,
      preferences: {
        varietyLevel: 5,
        energyPreference: 'mixed',
        explicitOk: true,
      },
      favoriteArtists: ['The Beatles', 'Radiohead'],
      favoriteGenres: ['rock', 'indie'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
    this.profiles.set(userId, profile);
  }

  seedSuppressions(userId: string, suppressions: Suppression[]): void {
    this.suppressions.set(userId, suppressions);
  }
}

/**
 * Create default test user profile
 */
export function createTestUserProfile(
  userId = 'test-user'
): UserProfile {
  return {
    userId,
    preferences: {
      varietyLevel: 7,
      energyPreference: 'mixed',
      explicitOk: true,
    },
    favoriteArtists: ['Kendrick Lamar', 'Miles Davis', 'Radiohead'],
    favoriteGenres: ['hip-hop', 'jazz', 'indie'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create test suppressions
 */
export function createTestSuppressions(): Suppression[] {
  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  const past = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

  return [
    {
      type: 'genre',
      value: 'country',
      until: future.toISOString(),
      createdAt: now.toISOString(),
    },
    {
      type: 'artist',
      value: 'Nickelback',
      until: future.toISOString(),
      createdAt: now.toISOString(),
    },
    {
      type: 'genre',
      value: 'metal',
      until: past.toISOString(), // Expired
      createdAt: past.toISOString(),
    },
  ];
}

/**
 * Create test playlist generation
 */
export function createTestPlaylistGeneration(
  userId = 'test-user'
): PlaylistGeneration {
  return {
    playlistId: `playlist-${Math.random().toString(36).substring(7)}`,
    userId,
    version: 1,
    generatedAt: new Date().toISOString(),
    generationParams: {
      prompt: 'high energy hip-hop',
      varietyLevel: 7,
      activeSuppressions: ['country', 'Nickelback'],
      model: 'claude-sonnet-4-5-20250929',
    },
    tracks: [
      {
        spotifyId: 'spotify:track:123',
        title: 'Lose Yourself',
        artist: 'Eminem',
        album: '8 Mile Soundtrack',
        reasonIncluded: 'High-energy hip-hop classic',
      },
    ],
    userFeedback: [],
  };
}

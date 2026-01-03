/**
 * Tests for local filesystem storage implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorage } from '../../src/storage/local-storage.js';
import {
  UserProfile,
  Suppression,
  PlaylistGeneration,
} from '../../src/types.js';
import { TEST_DATA_DIR } from '../setup.js';

describe('LocalStorage', () => {
  let storage: LocalStorage;

  beforeEach(() => {
    storage = new LocalStorage(TEST_DATA_DIR);
  });

  describe('User Profile Management', () => {
    it('should return null for non-existent user profile', async () => {
      const profile = await storage.getUserProfile('nonexistent');
      expect(profile).toBeNull();
    });

    it('should save and retrieve user profile', async () => {
      const profile: UserProfile = {
        userId: 'user123',
        preferences: {
          varietyLevel: 7,
          energyPreference: 'high',
          explicitOk: true,
        },
        favoriteArtists: ['Miles Davis', 'Nas'],
        favoriteGenres: ['jazz', 'hip-hop'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await storage.saveUserProfile('user123', profile);
      const retrieved = await storage.getUserProfile('user123');

      expect(retrieved).toEqual(profile);
    });

    it('should overwrite existing user profile', async () => {
      const profile1: UserProfile = {
        userId: 'user123',
        preferences: {
          varietyLevel: 5,
          energyPreference: 'mixed',
          explicitOk: true,
        },
        favoriteArtists: ['Artist 1'],
        favoriteGenres: ['genre1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const profile2: UserProfile = {
        ...profile1,
        preferences: {
          ...profile1.preferences,
          varietyLevel: 8,
        },
        favoriteArtists: ['Artist 2'],
      };

      await storage.saveUserProfile('user123', profile1);
      await storage.saveUserProfile('user123', profile2);

      const retrieved = await storage.getUserProfile('user123');
      expect(retrieved?.preferences.varietyLevel).toBe(8);
      expect(retrieved?.favoriteArtists).toEqual(['Artist 2']);
    });
  });

  describe('Suppression Management', () => {
    it('should return empty array for user with no suppressions', async () => {
      const suppressions = await storage.getActiveSuppressions('user123');
      expect(suppressions).toEqual([]);
    });

    it('should save and retrieve active suppressions', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const suppressions: Suppression[] = [
        {
          type: 'genre',
          value: 'country',
          until: futureDate.toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      await storage.saveSuppressions('user123', suppressions);
      const retrieved = await storage.getActiveSuppressions('user123');

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].value).toBe('country');
    });

    it('should filter out expired suppressions', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const suppressions: Suppression[] = [
        {
          type: 'genre',
          value: 'expired-genre',
          until: pastDate.toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          type: 'artist',
          value: 'active-artist',
          until: futureDate.toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      await storage.saveSuppressions('user123', suppressions);
      const retrieved = await storage.getActiveSuppressions('user123');

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].value).toBe('active-artist');
    });

    it('should handle multiple suppressions of different types', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const suppressions: Suppression[] = [
        {
          type: 'genre',
          value: 'country',
          until: futureDate.toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          type: 'artist',
          value: 'Taylor Swift',
          until: futureDate.toISOString(),
          createdAt: new Date().toISOString(),
        },
        {
          type: 'tag',
          value: 'party',
          until: futureDate.toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      await storage.saveSuppressions('user123', suppressions);
      const retrieved = await storage.getActiveSuppressions('user123');

      expect(retrieved).toHaveLength(3);
      expect(retrieved.map((s) => s.type)).toContain('genre');
      expect(retrieved.map((s) => s.type)).toContain('artist');
      expect(retrieved.map((s) => s.type)).toContain('tag');
    });
  });

  describe('Playlist History Management', () => {
    it('should return empty array for user with no playlists', async () => {
      const history = await storage.getPlaylistHistory('user123');
      expect(history).toEqual([]);
    });

    it('should save and retrieve playlist generation', async () => {
      const playlist: PlaylistGeneration = {
        playlistId: 'playlist_001',
        userId: 'user123',
        version: 1,
        generatedAt: new Date().toISOString(),
        generationParams: {
          prompt: 'jazz hip hop',
          varietyLevel: 7,
          activeSuppressions: [],
          model: 'test-model',
        },
        tracks: [
          {
            spotifyId: 'track_001',
            title: 'Test Track',
            artist: 'Test Artist',
            reasonIncluded: 'Test reason',
          },
        ],
        userFeedback: [],
      };

      await storage.savePlaylistGeneration('user123', playlist);
      const history = await storage.getPlaylistHistory('user123');

      expect(history).toHaveLength(1);
      expect(history[0].playlistId).toBe('playlist_001');
    });

    it('should respect limit parameter', async () => {
      // Create 5 playlists
      for (let i = 0; i < 5; i++) {
        const playlist: PlaylistGeneration = {
          playlistId: `playlist_${i}`,
          userId: 'user123',
          version: 1,
          generatedAt: new Date(Date.now() + i * 1000).toISOString(),
          generationParams: {
            prompt: `test ${i}`,
            varietyLevel: 5,
            activeSuppressions: [],
            model: 'test-model',
          },
          tracks: [],
          userFeedback: [],
        };
        await storage.savePlaylistGeneration('user123', playlist);
        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const history = await storage.getPlaylistHistory('user123', 3);
      expect(history).toHaveLength(3);
    });

    it('should return playlists in descending order (newest first)', async () => {
      const playlist1: PlaylistGeneration = {
        playlistId: 'playlist_old',
        userId: 'user123',
        version: 1,
        generatedAt: '2024-01-01T00:00:00.000Z',
        generationParams: {
          prompt: 'old',
          varietyLevel: 5,
          activeSuppressions: [],
          model: 'test-model',
        },
        tracks: [],
        userFeedback: [],
      };

      const playlist2: PlaylistGeneration = {
        playlistId: 'playlist_new',
        userId: 'user123',
        version: 1,
        generatedAt: '2024-12-01T00:00:00.000Z',
        generationParams: {
          prompt: 'new',
          varietyLevel: 5,
          activeSuppressions: [],
          model: 'test-model',
        },
        tracks: [],
        userFeedback: [],
      };

      await storage.savePlaylistGeneration('user123', playlist1);
      await storage.savePlaylistGeneration('user123', playlist2);

      const history = await storage.getPlaylistHistory('user123');
      expect(history[0].playlistId).toBe('playlist_new');
      expect(history[1].playlistId).toBe('playlist_old');
    });
  });

  describe('Service Credentials Management', () => {
    it('should return null for non-existent credentials', async () => {
      const creds = await storage.getServiceCredentials('user123', 'spotify');
      expect(creds).toBeNull();
    });

    it('should save and retrieve service credentials', async () => {
      const credentials = {
        service: 'spotify' as const,
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      await storage.saveServiceCredentials('user123', credentials);
      const retrieved = await storage.getServiceCredentials(
        'user123',
        'spotify'
      );

      expect(retrieved).toEqual(credentials);
    });

    it('should handle multiple service credentials for same user', async () => {
      const spotifyCreds = {
        service: 'spotify' as const,
        accessToken: 'spotify_token',
        refreshToken: 'spotify_refresh',
        expiresAt: new Date().toISOString(),
      };

      const appleCreds = {
        service: 'apple' as const,
        accessToken: 'apple_token',
        refreshToken: 'apple_refresh',
        expiresAt: new Date().toISOString(),
      };

      await storage.saveServiceCredentials('user123', spotifyCreds);
      await storage.saveServiceCredentials('user123', appleCreds);

      const spotify = await storage.getServiceCredentials('user123', 'spotify');
      const apple = await storage.getServiceCredentials('user123', 'apple');

      expect(spotify?.accessToken).toBe('spotify_token');
      expect(apple?.accessToken).toBe('apple_token');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in userId', async () => {
      const userId = 'user@email.com';
      const profile: UserProfile = {
        userId,
        preferences: {
          varietyLevel: 5,
          energyPreference: 'mixed',
          explicitOk: true,
        },
        favoriteArtists: [],
        favoriteGenres: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await storage.saveUserProfile(userId, profile);
      const retrieved = await storage.getUserProfile(userId);

      expect(retrieved?.userId).toBe(userId);
    });

    it('should handle concurrent writes gracefully', async () => {
      const profile1: UserProfile = {
        userId: 'user123',
        preferences: {
          varietyLevel: 5,
          energyPreference: 'mixed',
          explicitOk: true,
        },
        favoriteArtists: ['Artist 1'],
        favoriteGenres: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const profile2: UserProfile = {
        ...profile1,
        favoriteArtists: ['Artist 2'],
      };

      // Write both concurrently
      await Promise.all([
        storage.saveUserProfile('user123', profile1),
        storage.saveUserProfile('user123', profile2),
      ]);

      // Should have one of them (last write wins)
      const retrieved = await storage.getUserProfile('user123');
      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe('user123');
    });
  });
});

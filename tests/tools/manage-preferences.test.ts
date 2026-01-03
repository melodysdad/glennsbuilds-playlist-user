/**
 * Tests for preference management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PreferenceManager } from '../../src/tools/manage-preferences.js';
import { LocalStorage } from '../../src/storage/local-storage.js';
import { TEST_DATA_DIR } from '../setup.js';

describe('PreferenceManager', () => {
  let storage: LocalStorage;
  let manager: PreferenceManager;

  beforeEach(() => {
    storage = new LocalStorage(TEST_DATA_DIR);
    manager = new PreferenceManager(storage);
  });

  describe('updatePreferences', () => {
    it('should create new profile for new user', async () => {
      const result = await manager.updatePreferences({
        userId: 'newuser',
        preferences: {
          varietyLevel: 8,
          energyPreference: 'high',
        },
      });

      expect(result.userId).toBe('newuser');
      expect(result.preferences.varietyLevel).toBe(8);
      expect(result.preferences.energyPreference).toBe('high');
      expect(result.preferences.explicitOk).toBe(true); // default
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should merge preferences for existing user', async () => {
      // Create initial profile
      await manager.updatePreferences({
        userId: 'user123',
        preferences: {
          varietyLevel: 5,
          energyPreference: 'mixed',
          explicitOk: true,
        },
      });

      // Update only varietyLevel
      const result = await manager.updatePreferences({
        userId: 'user123',
        preferences: {
          varietyLevel: 9,
        },
      });

      expect(result.preferences.varietyLevel).toBe(9);
      expect(result.preferences.energyPreference).toBe('mixed'); // unchanged
      expect(result.preferences.explicitOk).toBe(true); // unchanged
    });

    it('should update favorite artists', async () => {
      await manager.updatePreferences({
        userId: 'user123',
        favoriteArtists: ['Miles Davis', 'Nas'],
      });

      const result = await manager.updatePreferences({
        userId: 'user123',
        favoriteArtists: ['John Coltrane', 'Kendrick Lamar'],
      });

      expect(result.favoriteArtists).toEqual([
        'John Coltrane',
        'Kendrick Lamar',
      ]);
    });

    it('should update favorite genres', async () => {
      const result = await manager.updatePreferences({
        userId: 'user123',
        favoriteGenres: ['jazz', 'hip-hop', 'electronic'],
      });

      expect(result.favoriteGenres).toEqual(['jazz', 'hip-hop', 'electronic']);
    });

    it('should update timestamp on each update', async () => {
      const first = await manager.updatePreferences({
        userId: 'user123',
        preferences: { varietyLevel: 5 },
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await manager.updatePreferences({
        userId: 'user123',
        preferences: { varietyLevel: 6 },
      });

      expect(second.updatedAt).not.toBe(first.updatedAt);
      expect(new Date(second.updatedAt).getTime()).toBeGreaterThan(
        new Date(first.updatedAt).getTime()
      );
    });

    it('should preserve createdAt timestamp', async () => {
      const first = await manager.updatePreferences({
        userId: 'user123',
        preferences: { varietyLevel: 5 },
      });

      const second = await manager.updatePreferences({
        userId: 'user123',
        preferences: { varietyLevel: 6 },
      });

      expect(second.createdAt).toBe(first.createdAt);
    });
  });

  describe('getPreferences', () => {
    it('should return null for non-existent user', async () => {
      const result = await manager.getPreferences('nonexistent');
      expect(result).toBeNull();
    });

    it('should return user preferences', async () => {
      await manager.updatePreferences({
        userId: 'user123',
        preferences: {
          varietyLevel: 7,
          energyPreference: 'high',
          explicitOk: false,
        },
        favoriteArtists: ['Artist 1'],
        favoriteGenres: ['Genre 1'],
      });

      const result = await manager.getPreferences('user123');

      expect(result).not.toBeNull();
      expect(result?.preferences.varietyLevel).toBe(7);
      expect(result?.favoriteArtists).toEqual(['Artist 1']);
    });
  });

  describe('validatePreferences', () => {
    it('should accept valid varietyLevel', () => {
      const errors = manager.validatePreferences({ varietyLevel: 5 });
      expect(errors).toHaveLength(0);
    });

    it('should reject varietyLevel < 1', () => {
      const errors = manager.validatePreferences({ varietyLevel: 0 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('varietyLevel');
    });

    it('should reject varietyLevel > 10', () => {
      const errors = manager.validatePreferences({ varietyLevel: 11 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('varietyLevel');
    });

    it('should accept valid energyPreference', () => {
      expect(
        manager.validatePreferences({ energyPreference: 'high' })
      ).toHaveLength(0);
      expect(
        manager.validatePreferences({ energyPreference: 'mixed' })
      ).toHaveLength(0);
      expect(
        manager.validatePreferences({ energyPreference: 'low' })
      ).toHaveLength(0);
    });

    it('should reject invalid energyPreference', () => {
      const errors = manager.validatePreferences({
        energyPreference: 'invalid' as never,
      });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('energyPreference');
    });

    it('should return multiple errors for multiple invalid fields', () => {
      const errors = manager.validatePreferences({
        varietyLevel: 15,
        energyPreference: 'invalid' as never,
      });
      expect(errors).toHaveLength(2);
    });
  });
});

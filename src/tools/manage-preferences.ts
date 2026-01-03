/**
 * User preference management
 * Handles creating and updating user profiles
 */

import { UserProfile, UpdatePreferencesInput } from '../types.js';
import { StorageLayer } from '../storage/storage-interface.js';

export class PreferenceManager {
  constructor(private storage: StorageLayer) {}

  async updatePreferences(input: UpdatePreferencesInput): Promise<UserProfile> {
    const { userId, preferences, favoriteArtists, favoriteGenres } = input;

    // Load existing profile or create new one
    let profile = await this.storage.getUserProfile(userId);

    if (!profile) {
      // Create new profile with defaults
      profile = {
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
    }

    // Merge preferences
    if (preferences) {
      profile.preferences = {
        ...profile.preferences,
        ...preferences,
      };
    }

    // Update favorite artists (replace if provided)
    if (favoriteArtists !== undefined) {
      profile.favoriteArtists = favoriteArtists;
    }

    // Update favorite genres (replace if provided)
    if (favoriteGenres !== undefined) {
      profile.favoriteGenres = favoriteGenres;
    }

    // Update timestamp
    profile.updatedAt = new Date().toISOString();

    // Save to storage
    await this.storage.saveUserProfile(userId, profile);

    return profile;
  }

  async getPreferences(userId: string): Promise<UserProfile | null> {
    return this.storage.getUserProfile(userId);
  }

  /**
   * Validate preference values
   */
  validatePreferences(
    preferences: Partial<UserProfile['preferences']>
  ): string[] {
    const errors: string[] = [];

    if (
      preferences.varietyLevel !== undefined &&
      (preferences.varietyLevel < 1 || preferences.varietyLevel > 10)
    ) {
      errors.push('varietyLevel must be between 1 and 10');
    }

    if (
      preferences.energyPreference !== undefined &&
      !['high', 'mixed', 'low'].includes(preferences.energyPreference)
    ) {
      errors.push('energyPreference must be "high", "mixed", or "low"');
    }

    return errors;
  }
}

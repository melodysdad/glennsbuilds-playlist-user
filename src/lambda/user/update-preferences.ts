import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBUserRepository } from '../../storage/dynamodb-user-repository.js';
import { successResponse, errorResponse } from '../shared/response.js';
import { validateSchema } from '../shared/validation.js';
import { UpdatePreferencesBodySchema } from '../../schemas/index.js';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.error('Update preferences request received:', event.body);

    const body = JSON.parse(event.body || '{}');

    // Validate input
    const validation = validateSchema(UpdatePreferencesBodySchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const { userId, preferences, favoriteArtists, favoriteGenres } =
      validation.data;

    const userRepo = new DynamoDBUserRepository();

    // Get existing profile or create new one
    let profile = await userRepo.getUserProfile(userId);

    if (!profile) {
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

    if (favoriteArtists) {
      profile.favoriteArtists = favoriteArtists;
    }

    if (favoriteGenres) {
      profile.favoriteGenres = favoriteGenres;
    }

    profile.updatedAt = new Date().toISOString();

    await userRepo.saveUserProfile(userId, profile);

    console.error('Preferences updated successfully for user:', userId);
    return successResponse({
      message: 'Preferences updated',
      profile,
    });
  } catch (error) {
    console.error('Error in updateUserPreferences:', error);
    return errorResponse(error);
  }
}

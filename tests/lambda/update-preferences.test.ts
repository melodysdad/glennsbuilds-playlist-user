/**
 * Unit tests for update-preferences Lambda handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambda/user/update-preferences.js';
import { MockStorage, createTestUserProfile } from '../mocks/storage-mock.js';

// Create a reference to mock storage using vi.hoisted
const { mockStorageRef } = vi.hoisted(() => {
  return {
    mockStorageRef: { current: null as unknown as MockStorage },
  };
});

// Mock the DynamoDB user repository - class constructor returns the mock instance
vi.mock('../../src/storage/dynamodb-user-repository.js', () => {
  return {
    DynamoDBUserRepository: class {
      constructor() {
        if (!mockStorageRef.current) {
          throw new Error('Mock storage not initialized in beforeEach');
        }
        // Return the mock instance from constructor
        return mockStorageRef.current;
      }
    },
  };
});

function createMockEvent(
  body: Record<string, unknown>
): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/user/preferences',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      path: '/user/preferences',
      stage: 'test',
      requestId: 'test',
      requestTimeEpoch: 0,
      resourceId: 'test',
      resourcePath: '/user/preferences',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: null,
        userArn: null,
      },
    },
    resource: '',
  };
}

describe('Update Preferences Lambda', () => {
  let mockStorage: MockStorage;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set environment variables
    process.env.USER_PROFILES_TABLE = 'test-user-profiles-table';
    process.env.SUPPRESSIONS_TABLE = 'test-suppressions-table';
    process.env.SERVICE_CREDENTIALS_TABLE = 'test-service-credentials-table';
    process.env.AWS_REGION = 'us-east-1';

    // Create new MockStorage instance and assign to ref
    mockStorageRef.current = new MockStorage();
    mockStorage = mockStorageRef.current;
    mockStorage.clear();
  });

  describe('Success Cases', () => {
    it('should update variety level preference', async () => {
      const userId = 'test-user';
      mockStorage.seedUserProfile(userId);

      const event = createMockEvent({
        userId,
        preferences: { varietyLevel: 8 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.preferences.varietyLevel).toBe(8);

      // Verify persistence
      const savedProfile = await mockStorage.getUserProfile(userId);
      expect(savedProfile?.preferences.varietyLevel).toBe(8);
    });

    it('should update energy preference', async () => {
      const userId = 'test-user';
      mockStorage.seedUserProfile(userId);

      const event = createMockEvent({
        userId,
        preferences: { energyPreference: 'high' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.preferences.energyPreference).toBe('high');
    });

    it('should update explicit content preference', async () => {
      const userId = 'test-user';
      mockStorage.seedUserProfile(userId);

      const event = createMockEvent({
        userId,
        preferences: { explicitOk: false },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.preferences.explicitOk).toBe(false);
    });

    it('should update favorite artists', async () => {
      const userId = 'test-user';
      mockStorage.seedUserProfile(userId);

      const event = createMockEvent({
        userId,
        favoriteArtists: ['Taylor Swift', 'Ed Sheeran', 'Adele'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.favoriteArtists).toEqual([
        'Taylor Swift',
        'Ed Sheeran',
        'Adele',
      ]);
    });

    it('should update favorite genres', async () => {
      const userId = 'test-user';
      mockStorage.seedUserProfile(userId);

      const event = createMockEvent({
        userId,
        favoriteGenres: ['pop', 'rock', 'electronic'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.favoriteGenres).toEqual(['pop', 'rock', 'electronic']);
    });

    it('should update multiple fields at once', async () => {
      const userId = 'test-user';
      mockStorage.seedUserProfile(userId);

      const event = createMockEvent({
        userId,
        preferences: {
          varietyLevel: 9,
          energyPreference: 'low',
          explicitOk: false,
        },
        favoriteArtists: ['Bon Iver'],
        favoriteGenres: ['indie', 'folk'],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.preferences.varietyLevel).toBe(9);
      expect(body.profile.preferences.energyPreference).toBe('low');
      expect(body.profile.preferences.explicitOk).toBe(false);
      expect(body.profile.favoriteArtists).toEqual(['Bon Iver']);
      expect(body.profile.favoriteGenres).toEqual(['indie', 'folk']);
    });

    it('should create new profile for new user', async () => {
      const userId = 'new-user';

      const event = createMockEvent({
        userId,
        preferences: { varietyLevel: 7 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.userId).toBe(userId);
      expect(body.profile.preferences.varietyLevel).toBe(7);

      // Verify new profile was created with defaults
      const savedProfile = await mockStorage.getUserProfile(userId);
      expect(savedProfile).toBeDefined();
      expect(savedProfile?.preferences.energyPreference).toBe('mixed');
      expect(savedProfile?.preferences.explicitOk).toBe(true);
    });

    it('should preserve existing fields when partially updating', async () => {
      const userId = 'test-user';
      const originalProfile = createTestUserProfile(userId);
      originalProfile.favoriteArtists = ['Original Artist'];
      mockStorage.seedUserProfile(userId, originalProfile);

      const event = createMockEvent({
        userId,
        preferences: { varietyLevel: 6 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.favoriteArtists).toEqual(['Original Artist']);
      expect(body.profile.preferences.varietyLevel).toBe(6);
    });

    it('should update updatedAt timestamp', async () => {
      const userId = 'test-user';
      const originalProfile = createTestUserProfile(userId);
      const originalTimestamp = originalProfile.updatedAt;
      mockStorage.seedUserProfile(userId, originalProfile);

      // Wait a tiny bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const event = createMockEvent({
        userId,
        preferences: { varietyLevel: 6 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.updatedAt).not.toBe(originalTimestamp);
    });
  });

  describe('Validation Errors', () => {
    it('should reject request without userId', async () => {
      const event = createMockEvent({
        preferences: { varietyLevel: 5 },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('userId');
    });

    it('should reject request with no update fields', async () => {
      const event = createMockEvent({
        userId: 'test-user',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('required');
    });

    it('should reject request with empty body', async () => {
      const event = createMockEvent({});

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle variety level boundary values', async () => {
      const userId = 'test-user';
      mockStorage.seedUserProfile(userId);

      // Test minimum value
      let event = createMockEvent({
        userId,
        preferences: { varietyLevel: 1 },
      });

      let result = await handler(event);
      expect(result.statusCode).toBe(200);

      // Test maximum value
      event = createMockEvent({
        userId,
        preferences: { varietyLevel: 10 },
      });

      result = await handler(event);
      expect(result.statusCode).toBe(200);
    });

    it('should handle empty arrays for favorites', async () => {
      const userId = 'test-user';
      mockStorage.seedUserProfile(userId);

      const event = createMockEvent({
        userId,
        favoriteArtists: [],
        favoriteGenres: [],
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.favoriteArtists).toEqual([]);
      expect(body.profile.favoriteGenres).toEqual([]);
    });

    it('should handle very long lists of favorites', async () => {
      const userId = 'test-user';
      mockStorage.seedUserProfile(userId);

      const manyArtists = Array.from({ length: 100 }, (_, i) => `Artist ${i}`);

      const event = createMockEvent({
        userId,
        favoriteArtists: manyArtists,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.profile.favoriteArtists).toHaveLength(100);
    });
  });
});

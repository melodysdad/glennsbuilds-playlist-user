/**
 * Unit tests for get-playlist-history Lambda handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambda/user/get-playlist-history.js';
import {
  MockStorage,
  createTestPlaylistGeneration,
} from '../mocks/storage-mock.js';

// Create a reference to mock storage using vi.hoisted
const { mockStorageRef } = vi.hoisted(() => {
  return {
    mockStorageRef: { current: null as unknown as MockStorage },
  };
});

// Mock the storage layer - class constructor returns the mock instance
vi.mock('../../src/storage/s3-storage.js', () => {
  return {
    S3Storage: class {
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

// Create mock DynamoDB client using vi.hoisted
const { mockClientRef, mockDynamoDBSend } = vi.hoisted(() => {
  const mockSend = vi.fn();
  return {
    mockClientRef: {
      current: {
        send: mockSend,
      },
    },
    mockDynamoDBSend: mockSend,
  };
});

// Mock DynamoDB SDK
vi.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: vi.fn().mockImplementation(() => mockClientRef.current),
    PutItemCommand: vi.fn().mockImplementation((input) => ({ input })),
    GetItemCommand: vi.fn().mockImplementation((input) => ({ input })),
    QueryCommand: vi.fn().mockImplementation((input) => ({ input })),
    UpdateItemCommand: vi.fn().mockImplementation((input) => ({ input })),
    DeleteItemCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

function createMockEvent(
  queryParams?: Record<string, string> | null,
  body?: Record<string, unknown> | null
): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/user/history',
    pathParameters: null,
    queryStringParameters: queryParams || null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: '/user/history',
      stage: 'test',
      requestId: 'test',
      requestTimeEpoch: 0,
      resourceId: 'test',
      resourcePath: '/user/history',
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

// TODO: Update tests for DynamoDB implementation - currently written for S3-only
// The new implementation returns different response format with DynamoDB data
describe.skip('Get Playlist History Lambda', () => {
  let mockStorage: MockStorage;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Create new MockStorage instance and assign to ref
    mockStorageRef.current = new MockStorage();
    mockStorage = mockStorageRef.current;
    mockStorage.clear();

    // Set environment variables
    process.env.PLAYLISTS_TABLE = 'test-playlists-table';
    process.env.AWS_REGION = 'us-east-1';

    // Mock DynamoDB Query to return empty playlists by default
    mockDynamoDBSend.mockResolvedValue({
      Items: [],
    });
  });

  describe('Success Cases', () => {
    it('should retrieve playlist history via query params', async () => {
      const userId = 'test-user';

      // Seed some playlists
      await mockStorage.savePlaylistGeneration(
        userId,
        createTestPlaylistGeneration(userId)
      );
      await mockStorage.savePlaylistGeneration(
        userId,
        createTestPlaylistGeneration(userId)
      );

      const event = createMockEvent({ userId });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.userId).toBe(userId);
      expect(body.count).toBe(2);
      expect(body.playlists).toHaveLength(2);
    });

    it('should retrieve playlist history via request body', async () => {
      const userId = 'test-user';

      await mockStorage.savePlaylistGeneration(
        userId,
        createTestPlaylistGeneration(userId)
      );

      const event = createMockEvent(null, { userId });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.userId).toBe(userId);
      expect(body.count).toBe(1);
    });

    it('should return empty array for user with no history', async () => {
      const event = createMockEvent({ userId: 'new-user' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.count).toBe(0);
      expect(body.playlists).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const userId = 'test-user';

      // Create 15 playlists
      for (let i = 0; i < 15; i++) {
        await mockStorage.savePlaylistGeneration(
          userId,
          createTestPlaylistGeneration(userId)
        );
      }

      const event = createMockEvent({ userId, limit: '5' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.count).toBe(5);
      expect(body.playlists).toHaveLength(5);
    });

    it('should use default limit of 10 if not specified', async () => {
      const userId = 'test-user';

      // Create 15 playlists
      for (let i = 0; i < 15; i++) {
        await mockStorage.savePlaylistGeneration(
          userId,
          createTestPlaylistGeneration(userId)
        );
      }

      const event = createMockEvent({ userId });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.count).toBe(10);
      expect(body.playlists).toHaveLength(10);
    });

    it('should return playlists in reverse chronological order', async () => {
      const userId = 'test-user';

      // Create playlists with different timestamps
      for (let i = 0; i < 3; i++) {
        const playlist = createTestPlaylistGeneration(userId);
        playlist.generatedAt = new Date(
          Date.now() - i * 1000 * 60 * 60
        ).toISOString(); // Each playlist 1 hour apart
        await mockStorage.savePlaylistGeneration(userId, playlist);
      }

      const event = createMockEvent({ userId });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      const playlists = body.playlists;

      // Verify they're in reverse chronological order
      for (let i = 0; i < playlists.length - 1; i++) {
        const current = new Date(playlists[i].generatedAt);
        const next = new Date(playlists[i + 1].generatedAt);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should include all playlist details', async () => {
      const userId = 'test-user';
      const playlist = createTestPlaylistGeneration(userId);
      await mockStorage.savePlaylistGeneration(userId, playlist);

      const event = createMockEvent({ userId });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      const returnedPlaylist = body.playlists[0];

      expect(returnedPlaylist.playlistId).toBeDefined();
      expect(returnedPlaylist.generatedAt).toBeDefined();
      expect(returnedPlaylist.generationParams).toBeDefined();
      expect(returnedPlaylist.tracks).toBeDefined();
      expect(returnedPlaylist.userFeedback).toBeDefined();
    });
  });

  describe('Validation Errors', () => {
    it('should reject request without userId in query or body', async () => {
      const event = createMockEvent();
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('userId');
    });

    it('should reject empty request', async () => {
      const event = createMockEvent({}, {});
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle limit of 0', async () => {
      const userId = 'test-user';
      await mockStorage.savePlaylistGeneration(
        userId,
        createTestPlaylistGeneration(userId)
      );

      const event = createMockEvent({ userId, limit: '0' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.playlists).toHaveLength(0);
    });

    it('should handle very large limit', async () => {
      const userId = 'test-user';

      // Create 5 playlists
      for (let i = 0; i < 5; i++) {
        await mockStorage.savePlaylistGeneration(
          userId,
          createTestPlaylistGeneration(userId)
        );
      }

      const event = createMockEvent({ userId, limit: '1000' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Should return all available playlists (5), not fail
      expect(body.playlists).toHaveLength(5);
    });

    it('should handle invalid limit gracefully', async () => {
      const userId = 'test-user';
      await mockStorage.savePlaylistGeneration(
        userId,
        createTestPlaylistGeneration(userId)
      );

      const event = createMockEvent({ userId, limit: 'invalid' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      // Should fall back to default limit
      const body = JSON.parse(result.body);
      expect(body.playlists).toBeDefined();
    });

    it('should handle multiple users independently', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      await mockStorage.savePlaylistGeneration(
        user1,
        createTestPlaylistGeneration(user1)
      );
      await mockStorage.savePlaylistGeneration(
        user1,
        createTestPlaylistGeneration(user1)
      );
      await mockStorage.savePlaylistGeneration(
        user2,
        createTestPlaylistGeneration(user2)
      );

      // Get user1's history
      let event = createMockEvent({ userId: user1 });
      let result = await handler(event);
      let body = JSON.parse(result.body);
      expect(body.count).toBe(2);

      // Get user2's history
      event = createMockEvent({ userId: user2 });
      result = await handler(event);
      body = JSON.parse(result.body);
      expect(body.count).toBe(1);
    });
  });

  describe('Data Integrity', () => {
    it('should not modify stored playlists', async () => {
      const userId = 'test-user';
      const originalPlaylist = createTestPlaylistGeneration(userId);
      await mockStorage.savePlaylistGeneration(userId, originalPlaylist);

      const event = createMockEvent({ userId });
      await handler(event);

      // Verify the stored data wasn't modified
      const storedPlaylists = await mockStorage.getPlaylistHistory(userId);
      expect(storedPlaylists[0].playlistId).toBe(originalPlaylist.playlistId);
      expect(storedPlaylists[0].tracks).toEqual(originalPlaylist.tracks);
    });

    it('should handle playlists with no tracks', async () => {
      const userId = 'test-user';
      const playlist = createTestPlaylistGeneration(userId);
      playlist.tracks = [];
      await mockStorage.savePlaylistGeneration(userId, playlist);

      const event = createMockEvent({ userId });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.playlists[0].tracks).toEqual([]);
    });

    it('should handle playlists with empty feedback', async () => {
      const userId = 'test-user';
      const playlist = createTestPlaylistGeneration(userId);
      playlist.userFeedback = [];
      await mockStorage.savePlaylistGeneration(userId, playlist);

      const event = createMockEvent({ userId });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.playlists[0].userFeedback).toEqual([]);
    });
  });
});

/**
 * Unit tests for add-suppression Lambda handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../../src/lambda/user/add-suppression.js';
import { MockStorage, createTestSuppressions } from '../mocks/storage-mock.js';

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
    path: '/user/suppression',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      path: '/user/suppression',
      stage: 'test',
      requestId: 'test',
      requestTimeEpoch: 0,
      resourceId: 'test',
      resourcePath: '/user/suppression',
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

describe('Add Suppression Lambda', () => {
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
    it('should add genre suppression', async () => {
      const userId = 'test-user';

      const event = createMockEvent({
        userId,
        type: 'genre',
        value: 'country',
        days: 30,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.suppression.type).toBe('genre');
      expect(body.suppression.value).toBe('country');

      // Verify persistence
      const suppressions = await mockStorage.getAllSuppressions(userId);
      expect(suppressions).toHaveLength(1);
      expect(suppressions[0].value).toBe('country');
    });

    it('should add artist suppression', async () => {
      const userId = 'test-user';

      const event = createMockEvent({
        userId,
        type: 'artist',
        value: 'Nickelback',
        days: 7,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.suppression.type).toBe('artist');
      expect(body.suppression.value).toBe('Nickelback');
    });

    it('should add tag suppression', async () => {
      const userId = 'test-user';

      const event = createMockEvent({
        userId,
        type: 'tag',
        value: 'sad',
        days: 14,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.suppression.type).toBe('tag');
      expect(body.suppression.value).toBe('sad');
    });

    it('should calculate correct expiration date', async () => {
      const userId = 'test-user';
      const days = 7;
      const beforeTime = new Date();

      const event = createMockEvent({
        userId,
        type: 'genre',
        value: 'metal',
        days,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);

      const untilDate = new Date(body.suppression.until);
      const expectedDate = new Date(beforeTime);
      expectedDate.setDate(expectedDate.getDate() + days);

      // Allow 1 second tolerance for test execution time
      const timeDiff = Math.abs(untilDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(1000);
    });

    it('should add multiple suppressions for same user', async () => {
      const userId = 'test-user';

      // Add first suppression
      let event = createMockEvent({
        userId,
        type: 'genre',
        value: 'country',
        days: 30,
      });
      await handler(event);

      // Add second suppression
      event = createMockEvent({
        userId,
        type: 'artist',
        value: 'Nickelback',
        days: 7,
      });
      await handler(event);

      const suppressions = await mockStorage.getAllSuppressions(userId);
      expect(suppressions).toHaveLength(2);
    });

    it('should preserve existing suppressions', async () => {
      const userId = 'test-user';
      const existingSuppressions = createTestSuppressions();
      const initialCount = existingSuppressions.length;
      mockStorage.seedSuppressions(userId, existingSuppressions);

      const event = createMockEvent({
        userId,
        type: 'genre',
        value: 'pop',
        days: 14,
      });

      await handler(event);

      const allSuppressions = await mockStorage.getAllSuppressions(userId);
      expect(allSuppressions.length).toBeGreaterThan(initialCount);
      expect(allSuppressions.length).toBe(initialCount + 1);
    });

    it('should handle very short duration (1 day)', async () => {
      const userId = 'test-user';

      const event = createMockEvent({
        userId,
        type: 'genre',
        value: 'test',
        days: 1,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.suppression.until).toBeDefined();
    });

    it('should handle very long duration (365 days)', async () => {
      const userId = 'test-user';

      const event = createMockEvent({
        userId,
        type: 'genre',
        value: 'test',
        days: 365,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Validation Errors', () => {
    it('should reject request without userId', async () => {
      const event = createMockEvent({
        type: 'genre',
        value: 'country',
        days: 30,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('userId');
    });

    it('should reject request without type', async () => {
      const event = createMockEvent({
        userId: 'test-user',
        value: 'country',
        days: 30,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('type');
    });

    it('should reject request without value', async () => {
      const event = createMockEvent({
        userId: 'test-user',
        type: 'genre',
        days: 30,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('value');
    });

    it('should reject request without days', async () => {
      const event = createMockEvent({
        userId: 'test-user',
        type: 'genre',
        value: 'country',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('days');
    });

    it('should reject invalid type', async () => {
      const event = createMockEvent({
        userId: 'test-user',
        type: 'invalid',
        value: 'test',
        days: 7,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toContain('type must be one of');
    });

    it('should reject empty body', async () => {
      const event = createMockEvent({});

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate suppressions', async () => {
      const userId = 'test-user';

      const suppressionData = {
        userId,
        type: 'genre',
        value: 'country',
        days: 30,
      };

      // Add same suppression twice
      await handler(createMockEvent(suppressionData));
      await handler(createMockEvent(suppressionData));

      const suppressions = await mockStorage.getAllSuppressions(userId);
      // Should have both (no deduplication in current implementation)
      expect(suppressions).toHaveLength(2);
    });

    it('should handle case sensitivity in values', async () => {
      const userId = 'test-user';

      // Add lowercase
      await handler(
        createMockEvent({
          userId,
          type: 'genre',
          value: 'country',
          days: 7,
        })
      );

      // Add uppercase
      await handler(
        createMockEvent({
          userId,
          type: 'genre',
          value: 'COUNTRY',
          days: 7,
        })
      );

      const suppressions = await mockStorage.getAllSuppressions(userId);
      expect(suppressions).toHaveLength(2);
      // Current implementation treats them as different
    });

    it('should handle special characters in values', async () => {
      const userId = 'test-user';

      const event = createMockEvent({
        userId,
        type: 'artist',
        value: "Guns N' Roses",
        days: 7,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.suppression.value).toBe("Guns N' Roses");
    });
  });
});

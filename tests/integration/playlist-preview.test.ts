/**
 * Integration tests for playlist preview endpoint
 * Tests the full flow including microservice integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from '../../src/lambda/user/playlist-preview.js';
import {
  APIGatewayProxyEvent,
  APIGatewayEventRequestContext,
} from 'aws-lambda';

// Mock the Lambda client
vi.mock('@aws-sdk/client-lambda', () => {
  const mockSend = vi.fn();
  return {
    LambdaClient: vi.fn(() => ({
      send: mockSend,
    })),
    InvokeCommand: vi.fn((params) => params),
  };
});

// Mock DynamoDB clients
vi.mock('@aws-sdk/client-dynamodb', () => {
  const mockSend = vi.fn().mockResolvedValue({ Item: null });
  return {
    DynamoDBClient: vi.fn(() => ({
      send: mockSend,
    })),
    PutItemCommand: vi.fn((params) => params),
    GetItemCommand: vi.fn((params) => params),
    QueryCommand: vi.fn((params) => params),
  };
});

describe('Playlist Preview Integration', () => {
  let mockLambdaSend: ReturnType<typeof vi.fn>;
  let mockDynamoSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import Lambda client mock
    const { LambdaClient } = await import('@aws-sdk/client-lambda');
    const lambdaClient = new LambdaClient({});
    mockLambdaSend = lambdaClient.send as ReturnType<typeof vi.fn>;

    // Import DynamoDB client mock
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const dynamoClient = new DynamoDBClient({});
    mockDynamoSend = dynamoClient.send as ReturnType<typeof vi.fn>;

    // Mock successful microservice response
    mockLambdaSend.mockResolvedValue({
      StatusCode: 200,
      Payload: new TextEncoder().encode(
        JSON.stringify({
          playlistId: '1234567890-abc123',
          status: 'preview',
          tracks: [
            {
              title: 'Test Song 1',
              artist: 'Test Artist 1',
              album: 'Test Album 1',
              reasonIncluded: 'Matches prompt',
            },
            {
              title: 'Test Song 2',
              artist: 'Test Artist 2',
              album: 'Test Album 2',
              reasonIncluded: 'Good vibe',
            },
          ],
        })
      ),
    });

    // Mock DynamoDB responses (no user profile, no suppressions)
    mockDynamoSend.mockResolvedValue({ Item: null, Items: [] });
  });

  const createEvent = (body: Record<string, unknown>): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/user/test-user/playlist/preview',
    pathParameters: { userId: 'test-user' },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as APIGatewayEventRequestContext,
    resource: '',
  });

  describe('Request Validation', () => {
    it('should reject request without userId', async () => {
      const event = createEvent({ prompt: 'test playlist' });
      event.pathParameters = null;

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('userId and prompt are required');
    });

    it('should reject request without prompt', async () => {
      const event = createEvent({});

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('userId and prompt are required');
    });
  });

  describe('Microservice Integration', () => {
    it('should NOT send playlistId to microservice (let it generate one)', async () => {
      const event = createEvent({
        prompt: 'chill indie folk',
      });

      const response = await handler(event);

      // Verify microservice was called
      expect(mockLambdaSend).toHaveBeenCalled();

      // Extract the InvokeCommand params
      const invokeCommand = mockLambdaSend.mock.calls[0][0];
      expect(invokeCommand.FunctionName).toBe('test-preview-function');

      // Parse the payload sent to microservice
      const payload = JSON.parse(invokeCommand.Payload);

      // CRITICAL: Verify playlistId is NOT sent (microservice generates it)
      expect(payload.playlistId).toBeUndefined();

      // Verify required fields
      expect(payload.prompt).toBe('chill indie folk');
      expect(payload.preferences).toBeDefined();
      expect(payload.suppressions).toBeDefined();

      expect(response.statusCode).toBe(200);
    });

    it('should include user preferences in microservice request', async () => {
      const event = createEvent({
        prompt: 'upbeat pop music',
      });

      await handler(event);

      const invokeCommand = mockLambdaSend.mock.calls[0][0];
      const payload = JSON.parse(invokeCommand.Payload);

      expect(payload.preferences).toEqual({
        varietyLevel: 5,
        energyPreference: 'mixed',
        explicitOk: true,
      });
    });

    it('should handle microservice error responses', async () => {
      // Mock error response from microservice
      mockLambdaSend.mockResolvedValue({
        StatusCode: 200,
        FunctionError: 'Unhandled',
        Payload: new TextEncoder().encode(
          JSON.stringify({
            errorType: 'Error',
            errorMessage: 'playlistId is required',
          })
        ),
      });

      const event = createEvent({
        prompt: 'test playlist',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should handle microservice timeout', async () => {
      mockLambdaSend.mockRejectedValue(new Error('Task timed out'));

      const event = createEvent({
        prompt: 'test playlist',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(502);
    });
  });

  describe('Response Format', () => {
    it('should return preview with tracks', async () => {
      const event = createEvent({
        prompt: 'chill music',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.playlistId).toBeDefined();
      expect(body.status).toBe('preview');
      expect(body.tracks).toBeInstanceOf(Array);
      expect(body.tracks.length).toBeGreaterThan(0);
      expect(body.message).toContain('10 songs');
    });

    it('should include helpful message about completing playlist', async () => {
      const event = createEvent({
        prompt: 'test',
      });

      const response = await handler(event);
      const body = JSON.parse(response.body);

      expect(body.message).toContain('POST /complete');
      expect(body.message).toContain('50-track');
    });
  });
});

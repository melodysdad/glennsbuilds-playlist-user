/**
 * DynamoDB data access layer for playlist persistence
 * Handles CRUD operations for playlists with status tracking and TTL management
 */

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  QueryCommandInput,
  UpdateItemCommand,
  DeleteItemCommand,
  AttributeValue,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  StoredPlaylist,
  PlaylistStatus,
  ListPlaylistsOptions,
  Track,
  UserProfile,
} from '../types.js';

export class DynamoDBPlaylistRepository {
  private readonly client: DynamoDBClient;
  private readonly tableName: string;

  constructor(tableName?: string, region?: string) {
    this.tableName = tableName || process.env.PLAYLISTS_TABLE || '';
    this.client = new DynamoDBClient({ region: region || process.env.AWS_REGION });

    if (!this.tableName) {
      throw new Error('PLAYLISTS_TABLE environment variable is not set');
    }
  }

  /**
   * Generate a timestamp-based playlist ID for sortability
   */
  private generatePlaylistId(): string {
    const now = new Date();
    const timestamp = now.getTime();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Calculate TTL based on playlist status
   * - drafts: 7 days
   * - complete: 30 days
   */
  private calculateTTL(status: PlaylistStatus): number {
    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const daysToAdd = status === 'draft' ? 7 : 30;
    return now + daysToAdd * 24 * 60 * 60;
  }

  /**
   * Save a new playlist to DynamoDB
   */
  async savePlaylist(
    userId: string,
    prompt: string,
    tracks: Track[],
    preferences: UserProfile['preferences'],
    status: PlaylistStatus = 'draft',
    options?: {
      playlistId?: string;
      targetCount?: number;
      bedrockRequest?: unknown;
      bedrockResponse?: unknown;
    }
  ): Promise<StoredPlaylist> {
    const playlistId = options?.playlistId || this.generatePlaylistId();
    const createdAt = new Date().toISOString();
    const ttl = this.calculateTTL(status);

    const playlist: StoredPlaylist = {
      userId,
      playlistId,
      status,
      prompt,
      tracks,
      preferences,
      createdAt,
      ttl,
    };

    // Add optional fields if provided
    if (options?.targetCount !== undefined) {
      playlist.targetCount = options.targetCount;
    }
    if (options?.bedrockRequest !== undefined) {
      playlist.bedrockRequest = options.bedrockRequest;
    }
    if (options?.bedrockResponse !== undefined) {
      playlist.bedrockResponse = options.bedrockResponse;
    }

    await this.client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(playlist, { removeUndefinedValues: true }),
      })
    );

    return playlist;
  }

  /**
   * Get a specific playlist by userId and playlistId
   */
  async getPlaylist(
    userId: string,
    playlistId: string
  ): Promise<StoredPlaylist | null> {
    const result = await this.client.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ userId, playlistId }),
      })
    );

    if (!result.Item) {
      return null;
    }

    return unmarshall(result.Item) as StoredPlaylist;
  }

  /**
   * List playlists for a user, optionally filtered by status
   */
  async listPlaylists(
    options: ListPlaylistsOptions
  ): Promise<{
    playlists: StoredPlaylist[];
    lastEvaluatedKey?: { userId: string; playlistId: string };
  }> {
    const { userId, status, limit = 10, lastEvaluatedKey } = options;

    // Build query parameters
    const queryParams: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId,
      }),
      ScanIndexForward: false, // Sort by playlistId descending (newest first)
      Limit: limit,
    };

    // Add status filter if provided
    if (status) {
      queryParams.FilterExpression = '#status = :status';
      queryParams.ExpressionAttributeNames = {
        '#status': 'status',
      };
      queryParams.ExpressionAttributeValues = marshall({
        ':userId': userId,
        ':status': status,
      });
    }

    // Add pagination if provided
    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = marshall(lastEvaluatedKey);
    }

    const result = await this.client.send(new QueryCommand(queryParams));

    const playlists = (result.Items || []).map(
      (item) => unmarshall(item) as StoredPlaylist
    );

    return {
      playlists,
      lastEvaluatedKey: result.LastEvaluatedKey
        ? (unmarshall(result.LastEvaluatedKey) as {
            userId: string;
            playlistId: string;
          })
        : undefined,
    };
  }

  /**
   * Update playlist status and optionally set execution ARN
   */
  async updatePlaylistStatus(
    userId: string,
    playlistId: string,
    status: PlaylistStatus,
    executionArn?: string
  ): Promise<void> {
    const ttl = this.calculateTTL(status);

    // Build update expression
    let updateExpression = 'SET #status = :status, #ttl = :ttl';
    const expressionAttributeNames: Record<string, string> = {
      '#status': 'status',
      '#ttl': 'ttl',
    };
    const expressionAttributeValues: Record<string, AttributeValue> = {
      ':status': { S: status },
      ':ttl': { N: ttl.toString() },
    };

    if (executionArn) {
      updateExpression += ', executionArn = :executionArn';
      expressionAttributeValues[':executionArn'] = { S: executionArn };
    }

    await this.client.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: marshall({ userId, playlistId }),
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  /**
   * Delete a playlist (mainly for testing/cleanup)
   */
  async deletePlaylist(userId: string, playlistId: string): Promise<void> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ userId, playlistId }),
      })
    );
  }

  /**
   * Query playlists by status using the GSI (useful for admin/monitoring)
   */
  async listPlaylistsByStatus(
    status: PlaylistStatus,
    limit = 100
  ): Promise<StoredPlaylist[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'status-index',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: marshall({
          ':status': status,
        }),
        ScanIndexForward: false,
        Limit: limit,
      })
    );

    return (result.Items || []).map((item) => unmarshall(item) as StoredPlaylist);
  }
}

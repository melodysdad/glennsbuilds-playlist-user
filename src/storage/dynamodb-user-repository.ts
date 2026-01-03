/**
 * DynamoDB User Repository
 * Data access layer for user profiles and suppressions
 */

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { UserProfile, Suppression, MusicServiceCredentials } from '../types.js';

export interface UserPlaylistRecord {
  playlistId: string;
  status: 'preview' | 'generating' | 'complete' | 'failed';
  prompt: string;
  createdAt: string;
  completedAt?: string;
}

export class DynamoDBUserRepository {
  private readonly client: DynamoDBClient;
  private readonly profilesTableName: string;
  private readonly suppressionsTableName: string;
  private readonly credentialsTableName: string;
  private readonly playlistsTableName: string;

  constructor() {
    this.client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    this.profilesTableName = process.env.USER_PROFILES_TABLE || '';
    this.suppressionsTableName = process.env.SUPPRESSIONS_TABLE || '';
    this.credentialsTableName = process.env.SERVICE_CREDENTIALS_TABLE || '';
    this.playlistsTableName = process.env.PLAYLISTS_TABLE || '';

    if (!this.profilesTableName || !this.suppressionsTableName || !this.credentialsTableName || !this.playlistsTableName) {
      throw new Error(
        'USER_PROFILES_TABLE, SUPPRESSIONS_TABLE, SERVICE_CREDENTIALS_TABLE, and PLAYLISTS_TABLE environment variables are required'
      );
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const command = new GetItemCommand({
      TableName: this.profilesTableName,
      Key: marshall({ userId }),
    });

    const result = await this.client.send(command);

    if (!result.Item) {
      return null;
    }

    return unmarshall(result.Item) as UserProfile;
  }

  /**
   * Save user profile
   */
  async saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.profilesTableName,
      Item: marshall(profile),
    });

    await this.client.send(command);
  }

  /**
   * Generate timestamp-based suppression ID
   */
  private generateSuppressionId(until: string, type: string, value: string): string {
    const timestamp = new Date(until).getTime();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${type}-${value}-${random}`;
  }

  /**
   * Calculate TTL from until date (add 7 days buffer for cleanup)
   */
  private calculateTTL(until: string): number {
    const untilDate = new Date(until);
    const bufferDays = 7;
    const ttlDate = new Date(untilDate.getTime() + bufferDays * 24 * 60 * 60 * 1000);
    return Math.floor(ttlDate.getTime() / 1000);
  }

  /**
   * Add suppression
   */
  async addSuppression(userId: string, suppression: Suppression): Promise<string> {
    const suppressionId = this.generateSuppressionId(
      suppression.until,
      suppression.type,
      suppression.value
    );

    const item = {
      userId,
      suppressionId,
      ...suppression,
      ttl: this.calculateTTL(suppression.until),
    };

    const command = new PutItemCommand({
      TableName: this.suppressionsTableName,
      Item: marshall(item),
    });

    await this.client.send(command);
    return suppressionId;
  }

  /**
   * Get all suppressions for a user (including expired ones)
   */
  async getAllSuppressions(userId: string): Promise<Suppression[]> {
    const command = new QueryCommand({
      TableName: this.suppressionsTableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId,
      }),
    });

    const result = await this.client.send(command);

    if (!result.Items || result.Items.length === 0) {
      return [];
    }

    return result.Items.map((item) => {
      const unmarshalled = unmarshall(item);
      // Return only the Suppression fields
      return {
        type: unmarshalled.type,
        value: unmarshalled.value,
        until: unmarshalled.until,
        createdAt: unmarshalled.createdAt,
      } as Suppression;
    });
  }

  /**
   * Get active suppressions for a user (filter out expired)
   */
  async getActiveSuppressions(userId: string): Promise<Suppression[]> {
    const allSuppressions = await this.getAllSuppressions(userId);
    const now = new Date();

    return allSuppressions.filter((s) => new Date(s.until) > now);
  }

  /**
   * Delete suppression
   */
  async deleteSuppression(userId: string, suppressionId: string): Promise<void> {
    const command = new DeleteItemCommand({
      TableName: this.suppressionsTableName,
      Key: marshall({
        userId,
        suppressionId,
      }),
    });

    await this.client.send(command);
  }

  /**
   * Save all suppressions (for migration/bulk update)
   * This replaces all existing suppressions with the provided list
   */
  async saveSuppressions(userId: string, suppressions: Suppression[]): Promise<void> {
    // First, delete all existing suppressions
    // Get the full items with suppressionId for deletion
    const command = new QueryCommand({
      TableName: this.suppressionsTableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId,
      }),
    });

    const result = await this.client.send(command);

    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        const unmarshalled = unmarshall(item);
        await this.deleteSuppression(userId, unmarshalled.suppressionId);
      }
    }

    // Then add new suppressions
    for (const suppression of suppressions) {
      await this.addSuppression(userId, suppression);
    }
  }

  /**
   * Get service credentials (OAuth tokens)
   */
  async getServiceCredentials(
    userId: string,
    service: string
  ): Promise<MusicServiceCredentials | null> {
    const command = new GetItemCommand({
      TableName: this.credentialsTableName,
      Key: marshall({ userId, service }),
    });

    const result = await this.client.send(command);

    if (!result.Item) {
      return null;
    }

    return unmarshall(result.Item) as MusicServiceCredentials;
  }

  /**
   * Save service credentials (OAuth tokens)
   * Data is encrypted at rest using KMS
   */
  async saveServiceCredentials(
    userId: string,
    credentials: MusicServiceCredentials
  ): Promise<void> {
    const item = {
      userId,
      ...credentials,
      updatedAt: new Date().toISOString(),
    };

    const command = new PutItemCommand({
      TableName: this.credentialsTableName,
      Item: marshall(item),
    });

    await this.client.send(command);
  }

  /**
   * Add playlist to user's history
   */
  async addPlaylistToHistory(
    userId: string,
    playlist: UserPlaylistRecord
  ): Promise<void> {
    const item = {
      userId,
      ...playlist,
    };

    const command = new PutItemCommand({
      TableName: this.playlistsTableName,
      Item: marshall(item),
    });

    await this.client.send(command);
  }

  /**
   * Get specific playlist from user's history
   */
  async getUserPlaylist(
    userId: string,
    playlistId: string
  ): Promise<UserPlaylistRecord | null> {
    const command = new GetItemCommand({
      TableName: this.playlistsTableName,
      Key: marshall({ userId, playlistId }),
    });

    const result = await this.client.send(command);

    if (!result.Item) {
      return null;
    }

    return unmarshall(result.Item) as UserPlaylistRecord;
  }

  /**
   * Update playlist status
   */
  async updatePlaylistStatus(
    userId: string,
    playlistId: string,
    status: 'preview' | 'generating' | 'complete' | 'failed'
  ): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.playlistsTableName,
      Item: marshall({
        userId,
        playlistId,
        status,
      }),
      // Use ConditionExpression to ensure we only update existing items
      ConditionExpression: 'attribute_exists(userId)',
    });

    await this.client.send(command);
  }

  /**
   * Update playlist completedAt timestamp
   */
  async updatePlaylistCompletedAt(
    userId: string,
    playlistId: string,
    completedAt: string
  ): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.playlistsTableName,
      Item: marshall({
        userId,
        playlistId,
        completedAt,
      }),
      ConditionExpression: 'attribute_exists(userId)',
    });

    await this.client.send(command);
  }
}

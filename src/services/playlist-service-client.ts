/**
 * Client for invoking the playlist generation microservice
 * Handles Lambda-to-Lambda invocation for playlist operations
 * Uses AWS Cloud Map for service discovery with fallback to environment variables
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import {
  ServiceDiscoveryClient,
  DiscoverInstancesCommand,
} from '@aws-sdk/client-servicediscovery';

const lambda = new LambdaClient({ region: process.env.AWS_REGION });
const serviceDiscovery = new ServiceDiscoveryClient({
  region: process.env.AWS_REGION,
});

export interface PreviewRequest {
  prompt: string;
  preferences?: {
    varietyLevel: number;
    energyPreference: 'high' | 'mixed' | 'low';
    explicitOk: boolean;
  };
  suppressions?: Array<{
    type: 'artist' | 'genre' | 'tag';
    value: string;
  }>;
}

export interface PreviewResponse {
  playlistId: string;
  status: 'preview';
  tracks: Array<{
    title: string;
    artist: string;
    album?: string;
    reasonIncluded: string;
  }>;
  reasoning: string;
  createdAt: string;
}

export interface CompleteRequest {
  playlistId: string;
}

export interface CompleteResponse {
  playlistId: string;
  status: 'generating';
  executionArn: string;
  message: string;
}

export interface GetPlaylistRequest {
  playlistId: string;
}

export interface GetPlaylistResponse {
  playlistId: string;
  status: 'preview' | 'generating' | 'complete' | 'failed';
  tracks: Array<{
    title: string;
    artist: string;
    album?: string;
    reasonIncluded: string;
  }>;
  reasoning: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export class PlaylistServiceClient {
  // Cache discovered function names to avoid repeated Cloud Map lookups
  private previewFunctionName?: string;
  private completeFunctionName?: string;
  private getFunctionName?: string;
  private discoveryAttempted = false;

  /**
   * Discover playlist-generation service from Cloud Map
   * Falls back to environment variables if discovery fails
   */
  private async discoverService(): Promise<void> {
    if (this.discoveryAttempted) {
      return; // Only attempt discovery once per Lambda instance
    }

    this.discoveryAttempted = true;

    const namespace = process.env.CLOUD_MAP_NAMESPACE;
    const serviceName = process.env.CLOUD_MAP_SERVICE_NAME;

    if (!namespace || !serviceName) {
      console.error('Cloud Map not configured, using environment variables');
      return; // Fall back to env vars
    }

    try {
      console.error('Discovering service from Cloud Map:', {
        namespace,
        serviceName,
      });

      const response = await serviceDiscovery.send(
        new DiscoverInstancesCommand({
          NamespaceName: namespace,
          ServiceName: serviceName,
        })
      );

      const instance = response.Instances?.[0];
      if (!instance?.Attributes) {
        console.error('No instances found in Cloud Map, using environment variables');
        return; // Fall back to env vars
      }

      // Extract function names from Cloud Map attributes
      this.previewFunctionName = instance.Attributes.previewFunction;
      this.completeFunctionName = instance.Attributes.completeFunction;
      this.getFunctionName = instance.Attributes.getFunction;

      console.error('Service discovered from Cloud Map:', {
        previewFunction: this.previewFunctionName,
        completeFunction: this.completeFunctionName,
        getFunction: this.getFunctionName,
      });
    } catch (error) {
      console.error('Cloud Map discovery failed, using environment variables:', error);
      // Fall back to env vars (no-op, properties remain undefined)
    }
  }

  /**
   * Fetch a 10-track preview playlist
   */
  async fetchPreview(request: PreviewRequest): Promise<PreviewResponse> {
    // Try Cloud Map discovery first
    await this.discoverService();

    // Use discovered function name, fall back to environment variable
    const functionName =
      this.previewFunctionName || process.env.PLAYLIST_SERVICE_PREVIEW_FUNCTION;

    if (!functionName) {
      throw new Error(
        'PLAYLIST_SERVICE_PREVIEW_FUNCTION not configured and not found in Cloud Map'
      );
    }

    console.error('Invoking playlist service:', {
      functionName,
      request: JSON.stringify(request),
    });

    const response = await lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(request),
      })
    );

    console.error('Lambda response metadata:', {
      FunctionError: response.FunctionError,
      StatusCode: response.StatusCode,
      ExecutedVersion: response.ExecutedVersion,
    });

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? new TextDecoder().decode(response.Payload)
        : 'Unknown error';
      console.error('Lambda error payload:', errorPayload);
      throw new Error(
        `Playlist service error (${response.FunctionError}): ${errorPayload}`
      );
    }

    if (!response.Payload) {
      throw new Error('No response from playlist service');
    }

    const payload = JSON.parse(new TextDecoder().decode(response.Payload));

    // Handle API Gateway response format
    if (payload.statusCode) {
      const body = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body;
      console.error('Playlist preview generated:', body.playlistId);
      return body;
    }

    console.error('Playlist preview generated:', payload.playlistId);
    return payload;
  }

  /**
   * Start full 50-track playlist generation (async)
   */
  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    // Try Cloud Map discovery first
    await this.discoverService();

    // Use discovered function name, fall back to environment variable
    const functionName =
      this.completeFunctionName || process.env.PLAYLIST_SERVICE_COMPLETE_FUNCTION;

    if (!functionName) {
      throw new Error(
        'PLAYLIST_SERVICE_COMPLETE_FUNCTION not configured and not found in Cloud Map'
      );
    }

    console.error('Invoking complete service:', {
      functionName,
      playlistId: request.playlistId,
    });

    const response = await lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(request),
      })
    );

    console.error('Lambda response metadata:', {
      FunctionError: response.FunctionError,
      StatusCode: response.StatusCode,
    });

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? new TextDecoder().decode(response.Payload)
        : 'Unknown error';
      console.error('Lambda error payload:', errorPayload);
      throw new Error(
        `Playlist service error (${response.FunctionError}): ${errorPayload}`
      );
    }

    if (!response.Payload) {
      throw new Error('No response from playlist service');
    }

    const payload = JSON.parse(new TextDecoder().decode(response.Payload));

    // Handle API Gateway response format
    if (payload.statusCode) {
      const body = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body;
      console.error('Complete request submitted:', body.executionArn);
      return body;
    }

    console.error('Complete request submitted:', payload.executionArn);
    return payload;
  }

  /**
   * Get playlist status and tracks
   */
  async getPlaylist(
    request: GetPlaylistRequest
  ): Promise<GetPlaylistResponse> {
    // Try Cloud Map discovery first
    await this.discoverService();

    // Use discovered function name, fall back to environment variable
    const functionName =
      this.getFunctionName || process.env.PLAYLIST_SERVICE_GET_FUNCTION;

    if (!functionName) {
      throw new Error(
        'PLAYLIST_SERVICE_GET_FUNCTION not configured and not found in Cloud Map'
      );
    }

    console.error('Invoking get playlist service:', {
      functionName,
      playlistId: request.playlistId,
    });

    const response = await lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(request),
      })
    );

    console.error('Lambda response metadata:', {
      FunctionError: response.FunctionError,
      StatusCode: response.StatusCode,
    });

    if (response.FunctionError) {
      const errorPayload = response.Payload
        ? new TextDecoder().decode(response.Payload)
        : 'Unknown error';
      console.error('Lambda error payload:', errorPayload);
      throw new Error(
        `Playlist service error (${response.FunctionError}): ${errorPayload}`
      );
    }

    if (!response.Payload) {
      throw new Error('No response from playlist service');
    }

    const payload = JSON.parse(new TextDecoder().decode(response.Payload));

    // Handle API Gateway response format
    if (payload.statusCode) {
      const body = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body;
      console.error('Playlist retrieved:', {
        playlistId: body.playlistId,
        status: body.status,
      });
      return body;
    }

    console.error('Playlist retrieved:', {
      playlistId: payload.playlistId,
      status: payload.status,
    });
    return payload;
  }
}

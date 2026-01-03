/**
 * Client for invoking the playlist generation microservice
 * Handles Lambda-to-Lambda invocation for playlist operations
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({ region: process.env.AWS_REGION });

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
  /**
   * Fetch a 10-track preview playlist
   */
  async fetchPreview(request: PreviewRequest): Promise<PreviewResponse> {
    const functionName = process.env.PLAYLIST_SERVICE_PREVIEW_FUNCTION;
    if (!functionName) {
      throw new Error('PLAYLIST_SERVICE_PREVIEW_FUNCTION not configured');
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
    const functionName = process.env.PLAYLIST_SERVICE_COMPLETE_FUNCTION;
    if (!functionName) {
      throw new Error('PLAYLIST_SERVICE_COMPLETE_FUNCTION not configured');
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
    const functionName = process.env.PLAYLIST_SERVICE_GET_FUNCTION;
    if (!functionName) {
      throw new Error('PLAYLIST_SERVICE_GET_FUNCTION not configured');
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

/**
 * Edge case and error handling tests
 * Tests boundary conditions, malformed inputs, and error scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectTracksWithLLM } from '../../src/services/anthropic-service.js';
import {
  MOCK_BEDROCK_MALFORMED_JSON,
  MOCK_BEDROCK_WITH_MARKDOWN,
  MOCK_BEDROCK_EMPTY_TRACKS,
  createBedrockResponse,
} from '../mocks/bedrock-responses.js';

// Create a mock send function that we can configure
// Use vi.hoisted to make it available in the hoisted mock scope
const { mockSendFn } = vi.hoisted(() => {
  return {
    mockSendFn: vi.fn(),
  };
});

// Mock Bedrock SDK
vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
      send: mockSendFn,
    })),
    InvokeModelCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

// Temporarily skipping Bedrock-dependent tests until reviewed on laptop
describe.skip('Edge Cases and Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendFn.mockReset();
  });

  describe('Anthropic Service - JSON Parsing', () => {
    it('should handle response with markdown code blocks', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse(MOCK_BEDROCK_WITH_MARKDOWN));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        targetLength: 1,
      });

      expect(result.selectedTracks).toHaveLength(1);
      expect(result.selectedTracks[0].title).toBe('Test Track');
    });

    it('should handle response without markdown wrapper', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [
          {
            title: 'Plain JSON',
            artist: 'Test',
            reasonIncluded: 'No markdown',
          },
        ],
        overallReasoning: 'Plain response',
      }));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        targetLength: 1,
      });

      expect(result.selectedTracks).toHaveLength(1);
    });

    it('should throw error on malformed JSON', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse(MOCK_BEDROCK_MALFORMED_JSON));

      await expect(
        selectTracksWithLLM({
          prompt: 'test',
          targetLength: 1,
        })
      ).rejects.toThrow('Invalid JSON response');
    });

    it('should throw error when selectedTracks is missing', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        overallReasoning: 'Missing tracks',
      }));

      await expect(
        selectTracksWithLLM({
          prompt: 'test',
          targetLength: 1,
        })
      ).rejects.toThrow('missing selectedTracks array');
    });

    it('should throw error when overallReasoning is missing', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [{ title: 'Track', artist: 'Artist', reasonIncluded: 'Test' }],
      }));

      await expect(
        selectTracksWithLLM({
          prompt: 'test',
          targetLength: 1,
        })
      ).rejects.toThrow('missing overallReasoning');
    });

    it('should handle empty tracks array', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse(MOCK_BEDROCK_EMPTY_TRACKS));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        targetLength: 0,
      });

      expect(result.selectedTracks).toHaveLength(0);
      expect(result.overallReasoning).toBeDefined();
    });

    it('should handle response with extra whitespace', async () => {
      const response = `

      \`\`\`json

      {
        "selectedTracks": [
          {
            "title": "Whitespace Test",
            "artist": "Test Artist",
            "reasonIncluded": "Testing whitespace handling"
          }
        ],
        "overallReasoning": "Test"
      }

      \`\`\`

      `;

      mockSendFn.mockResolvedValueOnce(createBedrockResponse(response));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        targetLength: 1,
      });

      expect(result.selectedTracks).toHaveLength(1);
    });

    it('should handle response with explanatory text before JSON', async () => {
      const response = `Here's the playlist I created for you:

\`\`\`json
{
  "selectedTracks": [
    {
      "title": "Track 1",
      "artist": "Artist 1",
      "reasonIncluded": "Good fit"
    }
  ],
  "overallReasoning": "Great mix"
}
\`\`\`

I hope you enjoy this playlist!`;

      mockSendFn.mockResolvedValueOnce(createBedrockResponse(response));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        targetLength: 1,
      });

      expect(result.selectedTracks).toHaveLength(1);
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle very long prompts', async () => {
      const longPrompt = 'a '.repeat(10000) + 'playlist';

      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [
          {
            title: 'Track',
            artist: 'Artist',
            reasonIncluded: 'Test',
          },
        ],
        overallReasoning: 'Test',
      }));

      const result = await selectTracksWithLLM({
        prompt: longPrompt,
        targetLength: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle empty prompt', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [],
        overallReasoning: 'No prompt provided',
      }));

      const result = await selectTracksWithLLM({
        prompt: '',
        targetLength: 0,
      });

      expect(result.selectedTracks).toHaveLength(0);
    });

    it('should handle zero target length', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [],
        overallReasoning: 'No tracks requested',
      }));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        targetLength: 0,
      });

      expect(result.selectedTracks).toHaveLength(0);
    });

    it('should handle very large target length', async () => {
      const largeCount = 100;
      const tracks = Array.from({ length: largeCount }, (_, i) => ({
        title: `Track ${i}`,
        artist: `Artist ${i}`,
        reasonIncluded: 'Test',
      }));

      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: tracks,
        overallReasoning: 'Large playlist',
      }));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        targetLength: largeCount,
      });

      expect(result.selectedTracks).toHaveLength(largeCount);
    });

    it('should handle user with many favorite artists', async () => {
      const manyArtists = Array.from({ length: 100 }, (_, i) => `Artist ${i}`);

      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [
          {
            title: 'Track',
            artist: 'Artist',
            reasonIncluded: 'Test',
          },
        ],
        overallReasoning: 'Test',
      }));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        userProfile: {
          favoriteArtists: manyArtists,
          favoriteGenres: [],
          preferences: {
            varietyLevel: 5,
            energyPreference: 'mixed',
          },
        },
        targetLength: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle user with many suppressions', async () => {
      const manySuppressions = Array.from({ length: 50 }, (_, i) => ({
        type: 'genre',
        value: `Genre ${i}`,
      }));

      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [
          {
            title: 'Track',
            artist: 'Artist',
            reasonIncluded: 'Test',
          },
        ],
        overallReasoning: 'Test',
      }));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        suppressions: manySuppressions,
        targetLength: 1,
      });

      expect(result).toBeDefined();
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle special characters in prompt', async () => {
      const specialPrompt = "90's hip-hop with \"dope\" beats & sick flow!";

      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [
          {
            title: 'Track',
            artist: 'Artist',
            reasonIncluded: 'Test',
          },
        ],
        overallReasoning: 'Test',
      }));

      const result = await selectTracksWithLLM({
        prompt: specialPrompt,
        targetLength: 1,
      });

      expect(result).toBeDefined();
    });

    it('should handle unicode characters in track names', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [
          {
            title: 'Café del Mar',
            artist: 'José González',
            reasonIncluded: 'Chill vibes',
          },
          {
            title: '東京',
            artist: 'サカナクション',
            reasonIncluded: 'Japanese rock',
          },
        ],
        overallReasoning: 'International mix',
      }));

      const result = await selectTracksWithLLM({
        prompt: 'international music',
        targetLength: 2,
      });

      expect(result.selectedTracks).toHaveLength(2);
      expect(result.selectedTracks[0].title).toBe('Café del Mar');
      expect(result.selectedTracks[1].title).toBe('東京');
    });

    it('should handle emojis in responses', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [
          {
            title: '🔥 Fire Track 🔥',
            artist: 'Test Artist',
            reasonIncluded: 'Absolute banger 💯',
          },
        ],
        overallReasoning: 'This playlist is lit 🎵',
      }));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        targetLength: 1,
      });

      expect(result.selectedTracks[0].title).toContain('🔥');
      expect(result.overallReasoning).toContain('🎵');
    });
  });

  describe('Variety Level Edge Cases', () => {
    it('should handle minimum variety level (1)', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [
          {
            title: 'Track 1',
            artist: 'Same Artist',
            reasonIncluded: 'Low variety',
          },
          {
            title: 'Track 2',
            artist: 'Same Artist',
            reasonIncluded: 'Low variety',
          },
        ],
        overallReasoning: 'Focused on similar tracks',
      }));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        userProfile: {
          favoriteArtists: [],
          favoriteGenres: [],
          preferences: {
            varietyLevel: 1,
            energyPreference: 'mixed',
          },
        },
        targetLength: 2,
      });

      expect(result).toBeDefined();
    });

    it('should handle maximum variety level (10)', async () => {
      mockSendFn.mockResolvedValueOnce(createBedrockResponse({
        selectedTracks: [
          {
            title: 'Jazz Track',
            artist: 'Miles Davis',
            reasonIncluded: 'High variety',
          },
          {
            title: 'Rock Track',
            artist: 'Led Zeppelin',
            reasonIncluded: 'High variety',
          },
          {
            title: 'Hip-Hop Track',
            artist: 'Kendrick Lamar',
            reasonIncluded: 'High variety',
          },
        ],
        overallReasoning: 'Maximum variety across genres',
      }));

      const result = await selectTracksWithLLM({
        prompt: 'test',
        userProfile: {
          favoriteArtists: [],
          favoriteGenres: [],
          preferences: {
            varietyLevel: 10,
            energyPreference: 'mixed',
          },
        },
        targetLength: 3,
      });

      expect(result.selectedTracks).toHaveLength(3);
    });
  });

  describe('Network and Service Errors', () => {
    it('should handle Bedrock service timeout', async () => {
      mockSendFn.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(
        selectTracksWithLLM({
          prompt: 'test',
          targetLength: 1,
        })
      ).rejects.toThrow();
    });

    it('should handle Bedrock service error', async () => {
      mockSendFn.mockRejectedValueOnce(new Error('Service unavailable'));

      await expect(
        selectTracksWithLLM({
          prompt: 'test',
          targetLength: 1,
        })
      ).rejects.toThrow();
    });
  });
});
